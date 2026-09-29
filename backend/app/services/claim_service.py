from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.models.user import User
from app.models.match import Match
from app.models.claim import Claim
from app.crud.claim import get_claim_by_id, get_active_claim_for_match


def create_claim(
    db: Session,
    match_id: int,
    claimant: User,
    verification_details: str,
    additional_message: Optional[str] = None,
) -> Claim:
    """
    Submits a new ownership claim for an eligible match.
    Enforces that:
    - Match exists and is active
    - Claimant owns the lost item
    - Found item is available
    - No self-matching claim
    - No existing active claim for this match
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

    # Duplicate active claim check
    existing_claim = get_active_claim_for_match(db, match_id=match.id, claimant_id=claimant.id)
    if existing_claim:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active claim (Status: {existing_claim.status}) already exists for this match.",
        )

    new_claim = Claim(
        match_id=match.id,
        claimant_id=claimant.id,
        verification_details=verification_details,
        additional_message=additional_message,
        status="PENDING",
    )

    db.add(new_claim)
    db.commit()
    db.refresh(new_claim)

    from app.services.notification_service import notify_claim_submitted
    notify_claim_submitted(db, claim=new_claim, match=match)

    return new_claim


def review_claim(
    db: Session,
    claim_id: int,
    reviewer: User,
    action: str,
    reviewer_notes: Optional[str] = None,
) -> Claim:
    """
    Processes finder review (APPROVE, REJECT, or UNDER_REVIEW).
    Approval is executed as a single atomic database transaction.
    """
    claim = get_claim_by_id(db, claim_id=claim_id)
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim request not found.",
        )

    # Authorization: only the finder or an authorized administrator can review
    is_admin = getattr(reviewer, "role", "").strip().lower() in ("admin", "superadmin", "administrator")
    is_finder = claim.match and claim.match.found_item and claim.match.found_item.user_id == reviewer.id
    if not (is_admin or is_finder):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the finder who reported this found item or an authorized administrator is permitted to review this claim.",
        )

    # Finalized state check
    if claim.status in ("APPROVED", "REJECTED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This claim is already {claim.status} and cannot be modified.",
        )

    action_norm = action.strip().upper()

    if action_norm == "APPROVE":
        # Check Found item has not been claimed/returned yet
        found_status = (claim.match.found_item.status or "").upper()
        if found_status not in ("AVAILABLE", "ACTIVE"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This item has already been claimed or returned.",
            )

        try:
            # Atomic Transaction
            claim.status = "APPROVED"
            claim.reviewed_by = reviewer.id
            claim.reviewed_at = datetime.now(timezone.utc)
            claim.reviewer_notes = reviewer_notes

            # Update item statuses
            claim.match.found_item.status = "CLAIMED"
            claim.match.lost_item.status = "RECOVERED"
            claim.match.status = "REVIEWED"

            # Automatically create Recovery tracking record
            from app.services.recovery_service import create_recovery_for_claim
            create_recovery_for_claim(db, claim, commit=False)

            db.commit()
            db.refresh(claim)

            from app.services.notification_service import notify_claim_approved
            notify_claim_approved(db, claim=claim, match=claim.match, reviewer_notes=reviewer_notes)

            return claim
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process claim approval: {str(e)}",
            )

    elif action_norm == "REJECT":
        claim.status = "REJECTED"
        claim.reviewed_by = reviewer.id
        claim.reviewed_at = datetime.now(timezone.utc)
        claim.reviewer_notes = reviewer_notes
        # Items remain in their existing status!
        db.commit()
        db.refresh(claim)

        from app.services.notification_service import notify_claim_rejected
        notify_claim_rejected(db, claim=claim, match=claim.match, reviewer_notes=reviewer_notes)

        return claim

    elif action_norm == "UNDER_REVIEW":
        claim.status = "UNDER_REVIEW"
        claim.reviewed_by = reviewer.id
        claim.reviewer_notes = reviewer_notes
        db.commit()
        db.refresh(claim)
        return claim

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review action. Must be APPROVE, REJECT, or UNDER_REVIEW.",
        )


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
    db.commit()
    db.refresh(claim)

    from app.services.notification_service import notify_claim_cancelled
    notify_claim_cancelled(db, claim=claim, match=claim.match)

    return claim
