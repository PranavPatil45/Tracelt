from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.models.user import User
from app.models.match import Match
from app.models.claim import Claim
from app.models.found_item import FoundItem
from app.models.lost_item import LostItem
from app.crud.claim import (
    get_claim_by_id,
    get_active_claim_for_match,
    get_active_claim_for_found_item,
)

HIGH_RISK_CATEGORIES = {
    "high risk", "high-risk", "valuable", "valuables", "high-value", "jewelry", "jewellery", "cash",
}

HIGH_RISK_KEYWORDS = [
    "rolex", "diamond", "cash", "passport", "high-risk", "high risk", "high-value",
    "gold bar", "crypto hardware", "trezor", "ledger nano",
]


def is_high_risk_claim(found_item: Optional[FoundItem], lost_item: Optional[LostItem] = None) -> bool:
    """Evaluates whether an item or match is considered high-risk requiring mandatory reviewer intervention."""
    items = [i for i in (found_item, lost_item) if i is not None]
    for item in items:
        cat = (getattr(item, "category", "") or "").lower().strip()
        if cat in HIGH_RISK_CATEGORIES:
            return True
        text = f"{getattr(item, 'title', '')} {getattr(item, 'description', '')}".lower()
        if any(kw in text for kw in HIGH_RISK_KEYWORDS):
            return True
    return False


def get_all_active_claims_for_found_item(db: Session, found_item_id: int) -> List[Claim]:
    """Retrieves all claims in active statuses (PENDING, UNDER_REVIEW, APPROVED) for a found item."""
    return (
        db.query(Claim)
        .outerjoin(Match, Claim.match_id == Match.id)
        .filter(
            or_(
                Claim.found_item_id == found_item_id,
                and_(Claim.found_item_id.is_(None), Match.found_item_id == found_item_id),
            ),
            Claim.status.in_(["PENDING", "UNDER_REVIEW", "APPROVED"]),
        )
        .all()
    )


def create_claim(
    db: Session,
    match_id: int,
    claimant: User,
    verification_details: str,
    additional_message: Optional[str] = None,
    preferred_handover_method: Optional[str] = "DIRECT",
) -> Claim:
    """
    Submits a new ownership claim for an eligible match.
    Enforces that:
    - Match exists and is active
    - Claimant owns the lost item
    - Found item is available
    - No self-matching claim
    - No existing active claim on this found item (Rule 1.1)
    - Automatically assesses risk (Rule 2)
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matching report not found.",
        )

    # Permission check: Claimant must own the lost item
    if not match.lost_item or match.lost_item.user_id != claimant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the registered owner of the lost item in this match can submit a claim.",
        )

    # Self-claim check
    if match.found_item and match.found_item.user_id == claimant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot claim an item you reported as found yourself.",
        )

    # Match status check
    if (match.status or "").upper() == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit a claim on a rejected match.",
        )

    # Found item availability check
    if not match.found_item or (match.found_item.status or "").upper() not in ("AVAILABLE", "ACTIVE"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This found item has already been claimed, returned, or closed.",
        )

    # One active claim per found item enforcement (Rule 1.1)
    if match.found_item_id:
        active_claims = get_all_active_claims_for_found_item(db, match.found_item_id)
        if active_claims:
            for ac in active_claims:
                if ac.claimant_id == claimant.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"An active claim (Status: {ac.status}) already exists for this match.",
                    )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another active claim is currently being processed for this found item.",
            )

    high_risk = is_high_risk_claim(match.found_item, match.lost_item)
    review_status = "PENDING" if high_risk else "NOT_REQUIRED"
    review_reason = "HIGH_RISK" if high_risk else None
    is_otp_req = (preferred_handover_method or "").strip().upper() == "OTP"
    handover_method = "OTP" if (high_risk or is_otp_req) else "DIRECT"

    new_claim = Claim(
        match_id=match.id,
        found_item_id=match.found_item_id,
        lost_item_id=match.lost_item_id,
        claimant_id=claimant.id,
        verification_details=verification_details,
        additional_message=additional_message,
        status="PENDING",
        review_status=review_status,
        review_reason=review_reason,
        handover_method=handover_method,
        is_mandatory_review=high_risk,
        is_mandatory_otp=high_risk,
    )

    db.add(new_claim)
    db.commit()
    db.refresh(new_claim)

    from app.services.notification_service import (
        notify_claim_submitted,
        notify_reviewer_intervention_required,
    )
    notify_claim_submitted(db, claim=new_claim, match=match)
    if high_risk:
        notify_reviewer_intervention_required(db, claim=new_claim, reason="HIGH_RISK")

    return new_claim


def create_direct_claim(
    db: Session,
    found_item_id: int,
    claimant: User,
    verification_details: str,
    additional_message: Optional[str] = None,
    preferred_handover_method: Optional[str] = "DIRECT",
) -> Claim:
    """
    Submits a direct ownership claim for an eligible found item without requiring an automated match.
    Enforces that:
    - Found item exists and is eligible for claiming
    - Users cannot claim their own found item
    - No existing active claim on this found item (Rule 1.1)
    - Automatically assesses risk (Rule 2)
    """
    found_item = db.query(FoundItem).filter(FoundItem.id == found_item_id).first()
    if not found_item:
        lost_item = db.query(LostItem).filter(LostItem.id == found_item_id).first()
        if lost_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot claim a lost item report. Claims can only be submitted for found items.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Found item not found.",
        )

    # Self-claim check: Users cannot claim their own found item
    if found_item.user_id == claimant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot claim an item you reported as found yourself.",
        )

    # Eligibility check: Invalid or closed item states must not be bypassed
    if (found_item.status or "").upper() not in ("AVAILABLE", "ACTIVE"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This found item is not eligible for claiming (already claimed, returned, or closed).",
        )

    # One active claim per found item enforcement (Rule 1.1)
    active_claims = get_all_active_claims_for_found_item(db, found_item.id)
    if active_claims:
        for ac in active_claims:
            if ac.claimant_id == claimant.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"An active claim (Status: {ac.status}) already exists for this found item.",
                )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another active claim is currently being processed for this found item.",
        )

    high_risk = is_high_risk_claim(found_item, None)
    review_status = "PENDING" if high_risk else "NOT_REQUIRED"
    review_reason = "HIGH_RISK" if high_risk else None
    is_otp_req = (preferred_handover_method or "").strip().upper() == "OTP"
    handover_method = "OTP" if (high_risk or is_otp_req) else "DIRECT"

    new_claim = Claim(
        found_item_id=found_item.id,
        match_id=None,
        lost_item_id=None,
        claimant_id=claimant.id,
        verification_details=verification_details,
        additional_message=additional_message,
        status="PENDING",
        review_status=review_status,
        review_reason=review_reason,
        handover_method=handover_method,
        is_mandatory_review=high_risk,
        is_mandatory_otp=high_risk,
    )

    db.add(new_claim)
    db.commit()
    db.refresh(new_claim)

    from app.services.notification_service import (
        notify_claim_submitted,
        notify_reviewer_intervention_required,
    )
    notify_claim_submitted(db, claim=new_claim, match=None)
    if high_risk:
        notify_reviewer_intervention_required(db, claim=new_claim, reason="HIGH_RISK")

    return new_claim


def review_claim(
    db: Session,
    claim_id: int,
    reviewer: User,
    action: str,
    reviewer_notes: Optional[str] = None,
    requires_reviewer: Optional[bool] = None,
    handover_method: Optional[str] = None,
    review_reason: Optional[str] = None,
) -> Claim:
    """
    Processes claim review by finder or staff reviewer.
    Supports routine direct approval, finder-requested reviewer assistance,
    mandatory reviewer intervention, and competing claims resolution.
    """
    claim = get_claim_by_id(db, claim_id=claim_id)
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim request not found.",
        )

    target_found_item = claim.found_item or (claim.match.found_item if claim.match else None)
    if not target_found_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associated found item could not be determined.",
        )

    reviewer_role = getattr(reviewer, "role", "").strip().lower()
    is_staff = reviewer_role in ("admin", "superadmin", "administrator", "reviewer")
    is_finder = target_found_item.user_id == reviewer.id

    if not (is_staff or is_finder):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the finder who reported this found item or an authorized reviewer/administrator is permitted to review this claim.",
        )

    # Conflict of interest check (Rule 4)
    if reviewer.id == claim.claimant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot review a claim that you submitted.",
        )
    if is_staff and not is_finder and reviewer.id == target_found_item.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff reviewers cannot review their own reported found items.",
        )

    # Finalized state check
    if claim.status in ("APPROVED", "REJECTED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This claim is already {claim.status} and cannot be modified.",
        )

    action_norm = action.strip().upper()

    # Detect competing active claims on this found item (Rule 1.2)
    competing_active = [
        c for c in get_all_active_claims_for_found_item(db, target_found_item.id)
        if c.id != claim.id
    ]
    has_competing = len(competing_active) > 0

    if has_competing:
        # Automatically mark all competing claims for mandatory Reviewer intervention
        claim.review_status = "PENDING"
        claim.review_reason = "COMPETING_CLAIMS"
        claim.is_mandatory_review = True
        for comp in competing_active:
            if comp.review_status != "PENDING" or comp.review_reason != "COMPETING_CLAIMS":
                comp.review_status = "PENDING"
                comp.review_reason = "COMPETING_CLAIMS"
                comp.is_mandatory_review = True
        db.commit()
        db.refresh(claim)

    # Handle Request Review action (Finder choice or escalation)
    if action_norm in ("REQUEST_REVIEW", "UNDER_REVIEW") or requires_reviewer:
        claim.status = "UNDER_REVIEW"
        claim.review_status = "PENDING"
        claim.review_reason = review_reason or ("COMPETING_CLAIMS" if has_competing else "USER_REQUESTED_REVIEW")
        claim.reviewed_by = reviewer.id
        claim.reviewer_notes = reviewer_notes
        db.commit()
        db.refresh(claim)

        from app.services.notification_service import notify_reviewer_intervention_required
        notify_reviewer_intervention_required(db, claim=claim, reason=claim.review_reason)
        return claim

    if action_norm == "APPROVE":
        # Rule 1.2: Finder cannot approve when competing active claims exist
        if has_competing and not (is_staff and not is_finder):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple active claims exist for this item. Mandatory Reviewer intervention is required.",
            )

        # Rule 2: Finder cannot approve when mandatory review applies
        if (claim.is_mandatory_review or claim.review_status == "PENDING") and not is_staff:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This claim requires Reviewer intervention and cannot be approved directly by the finder.",
            )

        # Rule 4: Impartial reviewer required when mandatory review applies
        if (claim.is_mandatory_review or claim.review_status == "PENDING") and is_finder and is_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Reviewers cannot approve mandatory reviews for items they found themselves. An impartial reviewer is required.",
            )

        # Availability check
        found_status = (target_found_item.status or "").upper()
        if found_status not in ("AVAILABLE", "ACTIVE"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This item has already been claimed or returned. Another claim may have already been approved.",
            )

        now = datetime.now(timezone.utc)
        try:
            claim.status = "APPROVED"
            claim.reviewed_by = reviewer.id
            claim.reviewed_at = now
            claim.reviewer_notes = reviewer_notes

            # If staff approved, finalize review status
            if is_staff and not is_finder:
                claim.review_status = "APPROVED"
                claim.review_decision_by = reviewer.id
                claim.review_decision_at = now
                claim.review_decision_notes = reviewer_notes
            else:
                claim.review_status = "NOT_REQUIRED"

            # Determine handover method (once OTP is requested/mandatory, cannot downgrade to DIRECT)
            chosen_handover = (handover_method or "").strip().upper()
            if claim.is_mandatory_otp or (claim.handover_method or "").upper() == "OTP":
                claim.handover_method = "OTP"
            elif chosen_handover in ("DIRECT", "OTP"):
                claim.handover_method = chosen_handover
            else:
                claim.handover_method = "DIRECT"

            # Update item statuses: Claim approval authorizes recovery, does NOT mark item RECOVERED
            target_found_item.status = "CLAIMED"
            if claim.match:
                if claim.match.found_item:
                    claim.match.found_item.status = "CLAIMED"
                if claim.match.lost_item:
                    claim.match.lost_item.status = "CLAIMED"
                claim.match.status = "REVIEWED"
            elif claim.lost_item:
                claim.lost_item.status = "CLAIMED"

            # Automatically create Recovery tracking record
            from app.services.recovery_service import create_recovery_for_claim
            create_recovery_for_claim(db, claim, commit=False)

            # Safely resolve competing active claims when approved by Reviewer
            if competing_active:
                for comp in competing_active:
                    comp.status = "REJECTED"
                    comp.review_status = "REJECTED"
                    comp.review_decision_by = reviewer.id
                    comp.review_decision_at = now
                    comp.review_decision_notes = f"Reviewer resolved competing claims in favor of claim #{claim.id}."
                    comp.reviewed_by = reviewer.id
                    comp.reviewed_at = now
                    comp.reviewer_notes = f"Another ownership claim was approved (#{claim.id}) by a reviewer."

            db.commit()
            db.refresh(claim)

            from app.services.notification_service import (
                notify_claim_approved,
                notify_claim_rejected,
                notify_review_decision,
            )
            notify_claim_approved(db, claim=claim, match=claim.match, reviewer_notes=reviewer_notes)
            if is_staff and not is_finder:
                notify_review_decision(db, claim=claim, decision="APPROVED", reviewer_notes=reviewer_notes)
            for comp in competing_active:
                notify_claim_rejected(db, claim=comp, match=comp.match, reviewer_notes=comp.reviewer_notes)

            return claim
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process claim approval: {str(e)}",
            )

    elif action_norm == "REJECT":
        now = datetime.now(timezone.utc)
        claim.status = "REJECTED"
        claim.reviewed_by = reviewer.id
        claim.reviewed_at = now
        claim.reviewer_notes = reviewer_notes
        if is_staff and not is_finder:
            claim.review_status = "REJECTED"
            claim.review_decision_by = reviewer.id
            claim.review_decision_at = now
            claim.review_decision_notes = reviewer_notes

        db.commit()
        db.refresh(claim)

        from app.services.notification_service import (
            notify_claim_rejected,
            notify_review_decision,
        )
        notify_claim_rejected(db, claim=claim, match=claim.match, reviewer_notes=reviewer_notes)
        if is_staff and not is_finder:
            notify_review_decision(db, claim=claim, decision="REJECTED", reviewer_notes=reviewer_notes)

        return claim

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review action. Must be APPROVE, REJECT, UNDER_REVIEW, or REQUEST_REVIEW.",
        )


def raise_claim_dispute(
    db: Session,
    claim_id: int,
    current_user: User,
    reason: str,
) -> Claim:
    """
    Raises a dispute on a claim request.
    Transitions review_status to DISPUTED and halts routine processing.
    """
    claim = get_claim_by_id(db, claim_id=claim_id)
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim request not found.",
        )

    target_found = claim.found_item or (claim.match.found_item if claim.match else None)
    finder_id = target_found.user_id if target_found else None

    # Only claimant or finder (or staff) can dispute
    user_role = getattr(current_user, "role", "").strip().lower()
    is_staff = user_role in ("admin", "superadmin", "administrator", "reviewer")
    is_participant = current_user.id in (claim.claimant_id, finder_id)

    if not (is_participant or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to raise a dispute on this claim.",
        )

    if claim.status in ("REJECTED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot dispute a claim that is already {claim.status.lower()}.",
        )

    now = datetime.now(timezone.utc)
    claim.review_status = "DISPUTED"
    claim.review_reason = "DISPUTED"
    clean_reason = reason.strip()
    claim.reviewer_notes = (claim.reviewer_notes or "") + f"\nDispute raised by {current_user.full_name}: {clean_reason}"

    # Also sync with recovery if already created
    from app.models.recovery import Recovery
    rec = db.query(Recovery).filter(Recovery.claim_id == claim.id).first()
    if rec:
        rec.review_status = "DISPUTED"
        rec.review_reason = "DISPUTED"
        rec.dispute_reason = clean_reason
        rec.disputed_by = current_user.id
        rec.disputed_at = now
        rec.updated_at = now

    db.commit()
    db.refresh(claim)

    from app.services.notification_service import notify_dispute_raised
    notify_dispute_raised(db, recovery_or_claim=rec or claim, reason=clean_reason, disputed_by_name=current_user.full_name)

    return claim


def cancel_claim(
    db: Session,
    claim_id: int,
    claimant: User,
) -> Claim:
    """
    Cancels a pending claim request. Only permitted by the claimant while status is PENDING.
    """
    claim = get_claim_by_id(db, claim_id=claim_id)
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim request not found.",
        )

    if claim.claimant_id != claimant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel claims you submitted.",
        )

    if claim.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel claim in '{claim.status}' state. Only PENDING claims can be cancelled.",
        )

    claim.status = "CANCELLED"
    claim.review_status = "NOT_REQUIRED"
    db.commit()
    db.refresh(claim)

    from app.services.notification_service import notify_claim_cancelled
    notify_claim_cancelled(db, claim=claim, match=claim.match)

    return claim
