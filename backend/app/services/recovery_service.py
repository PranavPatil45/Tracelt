import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func, desc

from app.models.user import User
from app.models.claim import Claim
from app.models.match import Match
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.conversation import Conversation
from app.models.recovery import Recovery
from app.services.notification_service import (
    notify_item_returned,
    notify_recovery_confirmed,
    notify_handover_otp_verified,
    notify_dispute_raised,
    notify_dispute_resolved,
)


def _is_otp_expired(otp_expires_at: Optional[datetime]) -> bool:
    """Timezone-safe comparison for OTP expiration against SQLite stored datetimes."""
    if not otp_expires_at:
        return True
    now = datetime.now(timezone.utc)
    exp = otp_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return now > exp


def create_recovery_for_claim(
    db: Session,
    claim: Claim,
    commit: bool = True,
) -> Recovery:
    """
    Creates a new Recovery tracking record for an approved claim.
    Inherits hybrid workflow parameters, review decisions, and handover method.
    If a recovery already exists for this claim, returns it idempotently.
    """
    existing = db.query(Recovery).filter(Recovery.claim_id == claim.id).first()
    if existing:
        return existing

    lost_id = claim.lost_item_id or (claim.match.lost_item_id if claim.match else None)
    found_id = claim.found_item_id or (claim.match.found_item_id if claim.match else None)

    finder_id = 0
    if claim.found_item and claim.found_item.user_id:
        finder_id = claim.found_item.user_id
    elif claim.match and claim.match.found_item and claim.match.found_item.user_id:
        finder_id = claim.match.found_item.user_id
    elif found_id:
        f_item = db.query(FoundItem).filter(FoundItem.id == found_id).first()
        if f_item:
            finder_id = f_item.user_id

    recovery = Recovery(
        claim_id=claim.id,
        match_id=claim.match_id,
        lost_item_id=lost_id,
        found_item_id=found_id,
        claimant_id=claim.claimant_id,
        finder_id=finder_id,
        status="RETURN_PENDING",
        review_status=claim.review_status or "NOT_REQUIRED",
        review_reason=claim.review_reason,
        review_decision_notes=claim.review_decision_notes,
        review_decision_by=claim.review_decision_by,
        review_decision_at=claim.review_decision_at,
        handover_method=claim.handover_method or "DIRECT",
        is_mandatory_review=bool(claim.is_mandatory_review),
        is_mandatory_otp=bool(claim.is_mandatory_otp),
    )
    db.add(recovery)
    if commit:
        db.commit()
        db.refresh(recovery)
    else:
        db.flush()

    return recovery


def get_recovery_by_id(db: Session, recovery_id: int) -> Optional[Recovery]:
    """Retrieves a recovery record with all related entities eagerly loaded."""
    return (
        db.query(Recovery)
        .filter(Recovery.id == recovery_id)
        .options(
            joinedload(Recovery.claim),
            joinedload(Recovery.match),
            joinedload(Recovery.lost_item),
            joinedload(Recovery.found_item),
            joinedload(Recovery.claimant),
            joinedload(Recovery.finder),
        )
        .first()
    )


def get_recovery_for_claim(db: Session, claim_id: int) -> Optional[Recovery]:
    """Retrieves a recovery record for a given claim ID."""
    return (
        db.query(Recovery)
        .filter(Recovery.claim_id == claim_id)
        .options(
            joinedload(Recovery.claim),
            joinedload(Recovery.match),
            joinedload(Recovery.lost_item),
            joinedload(Recovery.found_item),
            joinedload(Recovery.claimant),
            joinedload(Recovery.finder),
        )
        .first()
    )


def build_timeline_steps(recovery: Recovery) -> List[Dict[str, Any]]:
    """Constructs the visual lifecycle timeline for the recovery flow."""
    rec_status = (recovery.status or "").upper()
    match_time = recovery.match.created_at if recovery.match else recovery.created_at
    claim_sub_time = recovery.claim.created_at if recovery.claim else recovery.created_at
    claim_appr_time = (
        recovery.claim.reviewed_at
        if recovery.claim and recovery.claim.reviewed_at
        else recovery.created_at
    )

    steps = [
        {
            "key": "match_found",
            "title": "Match Correlated" if recovery.match else "Item Identified",
            "status": "completed",
            "timestamp": match_time,
            "description": (
                "Matching engine detected high-confidence match on campus."
                if recovery.match
                else "Item identified and selected directly on campus."
            ),
        },
        {
            "key": "claim_submitted",
            "title": "Claim Submitted",
            "status": "completed",
            "timestamp": claim_sub_time,
            "description": "Claimant submitted ownership verification evidence.",
        },
        {
            "key": "claim_approved",
            "title": "Claim Approved" if recovery.review_status != "APPROVED" else "Reviewer Approved",
            "status": "completed",
            "timestamp": claim_appr_time,
            "description": (
                "Staff Reviewer authorized ownership and recovery."
                if recovery.review_status == "APPROVED"
                else "Ownership verification reviewed and accepted."
            ),
        },
        {
            "key": "return_pending",
            "title": "Dispute Under Review" if recovery.review_status == "DISPUTED" else "Return Coordination",
            "status": "completed" if rec_status in ("RETURNED", "RECOVERED") else "current",
            "timestamp": recovery.created_at,
            "description": (
                f"Dispute raised: {recovery.dispute_reason or 'Under staff review.'}"
                if recovery.review_status == "DISPUTED"
                else (
                    "Claimant generates handover OTP for finder verification."
                    if recovery.handover_method == "OTP"
                    else "Participants coordinate physical handover through messaging."
                )
            ),
        },
        {
            "key": "item_returned",
            "title": "Handover Verified" if recovery.handover_method == "OTP" else "Item Handed Over",
            "status": (
                "completed"
                if rec_status == "RECOVERED"
                else ("current" if rec_status == "RETURNED" else "upcoming")
            ),
            "timestamp": recovery.returned_at,
            "description": (
                f"Finder verified OTP at {recovery.return_location or 'campus meeting point'}."
                if (recovery.handover_method == "OTP" and recovery.returned_at)
                else (
                    f"Finder marked item returned at {recovery.return_location}."
                    if recovery.return_location
                    else "Finder marks item as physically handed over."
                )
            ),
        },
        {
            "key": "recovery_confirmed",
            "title": "Recovery Confirmed",
            "status": "completed" if rec_status == "RECOVERED" else "upcoming",
            "timestamp": recovery.confirmed_at,
            "description": "Claimant confirms receipt and item is officially recovered.",
        },
    ]

    return steps


def format_recovery_response(recovery: Recovery, current_user: User, db: Session) -> Dict[str, Any]:
    """Formats full recovery object with permissions, OTP capabilities, and contextual data."""
    lost = recovery.lost_item
    found = recovery.found_item
    claimant = recovery.claimant
    finder = recovery.finder

    # Conversation ID lookup
    conv = db.query(Conversation).filter(Conversation.claim_id == recovery.claim_id).first()
    conversation_id = conv.id if conv else None

    # Role-based action permissions
    rec_status = (recovery.status or "").upper()
    rev_status = (recovery.review_status or "NOT_REQUIRED").upper()

    is_blocked_by_review = rev_status in ("PENDING", "DISPUTED", "REJECTED")
    is_otp = (recovery.handover_method or "").upper() == "OTP"

    can_mark_returned = (
        current_user.id == recovery.finder_id
        and rec_status == "RETURN_PENDING"
        and not is_blocked_by_review
        and not is_otp
    )
    can_confirm_recovery = (
        current_user.id == recovery.claimant_id
        and rec_status == "RETURNED"
        and not is_blocked_by_review
        and (not is_otp or recovery.otp_verified_at is not None)
    )

    can_raise_dispute = (
        current_user.id in (recovery.claimant_id, recovery.finder_id)
        and rec_status not in ("RECOVERED", "CANCELLED")
        and rev_status != "DISPUTED"
    )

    can_generate_otp = (
        current_user.id == recovery.claimant_id
        and rec_status == "RETURN_PENDING"
        and not is_blocked_by_review
        and is_otp
    )

    has_active_otp = bool(
        recovery.otp_hash
        and recovery.otp_expires_at
        and not _is_otp_expired(recovery.otp_expires_at)
    )

    can_verify_otp = (
        current_user.id == recovery.finder_id
        and rec_status == "RETURN_PENDING"
        and not is_blocked_by_review
        and is_otp
    )

    can_request_otp = (
        current_user.id in (recovery.claimant_id, recovery.finder_id)
        and rec_status == "RETURN_PENDING"
        and not is_blocked_by_review
        and not is_otp
    )

    lost_summary = {
        "id": lost.id,
        "title": lost.title,
        "category": lost.category,
        "location": lost.location,
        "date": lost.lost_date,
        "time": lost.lost_time,
        "description": lost.description,
        "image_url": lost.image_url,
        "status": lost.status,
    } if lost else None

    found_summary = {
        "id": found.id,
        "title": found.title,
        "category": found.category,
        "location": found.location,
        "date": found.found_date,
        "time": found.found_time,
        "description": found.description,
        "image_url": found.image_url,
        "status": found.status,
    } if found else None

    claimant_summary = {
        "id": claimant.id,
        "full_name": claimant.full_name,
        "campus": claimant.campus or "Campus",
        "role": "Claimant",
    } if claimant else None

    finder_summary = {
        "id": finder.id,
        "full_name": finder.full_name,
        "campus": finder.campus or "Campus",
        "role": "Finder",
    } if finder else None

    return {
        "id": recovery.id,
        "claim_id": recovery.claim_id,
        "match_id": recovery.match_id,
        "claimant_id": recovery.claimant_id,
        "finder_id": recovery.finder_id,
        "status": recovery.status,
        "return_location": recovery.return_location,
        "return_notes": recovery.return_notes,
        "returned_at": recovery.returned_at,
        "confirmed_at": recovery.confirmed_at,
        "created_at": recovery.created_at,
        "updated_at": recovery.updated_at or recovery.created_at,
        "lost_item": lost_summary,
        "found_item": found_summary,
        "claimant": claimant_summary,
        "finder": finder_summary,
        "conversation_id": conversation_id,
        "can_mark_returned": can_mark_returned,
        "can_confirm_recovery": can_confirm_recovery,
        "timeline": build_timeline_steps(recovery),
        # Hybrid Reviewer Workflow fields
        "review_status": recovery.review_status or "NOT_REQUIRED",
        "review_reason": recovery.review_reason,
        "review_decision_notes": recovery.review_decision_notes,
        "review_decision_by": recovery.review_decision_by,
        "review_decision_at": recovery.review_decision_at,
        "handover_method": recovery.handover_method or "DIRECT",
        "is_mandatory_review": bool(recovery.is_mandatory_review),
        "is_mandatory_otp": bool(recovery.is_mandatory_otp),
        "has_active_otp": has_active_otp,
        "otp_attempts_left": max(0, 5 - (recovery.otp_attempts or 0)),
        "otp_expires_at": recovery.otp_expires_at,
        "otp_verified_at": recovery.otp_verified_at,
        "dispute_reason": recovery.dispute_reason,
        "disputed_by": recovery.disputed_by,
        "disputed_at": recovery.disputed_at,
        "can_raise_dispute": can_raise_dispute,
        "can_generate_otp": can_generate_otp,
        "can_verify_otp": can_verify_otp,
        "can_request_otp": can_request_otp,
    }


def generate_handover_otp(
    db: Session,
    recovery_id: int,
    current_user: User,
) -> Dict[str, Any]:
    """
    Claimant generates a single-use 6-digit handover OTP.
    Plaintext OTP is returned ONLY in this response and is NEVER persisted directly.
    A salted SHA-256 hash is stored in the database with a 30-minute expiration.
    """
    recovery = get_recovery_by_id(db, recovery_id=recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    if current_user.id != recovery.claimant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the verified claimant can generate a handover verification code.",
        )

    if (recovery.handover_method or "").upper() != "OTP":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP generation is only available for recoveries using OTP handover mode.",
        )

    rec_status = (recovery.status or "").upper()
    if rec_status != "RETURN_PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate OTP while recovery is in '{recovery.status}' status.",
        )

    rev_status = (recovery.review_status or "NOT_REQUIRED").upper()
    if rev_status in ("PENDING", "DISPUTED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate OTP while recovery is in '{recovery.review_status}' status. Resolution required first.",
        )

    # Cryptographically secure 6-digit OTP
    otp_code = f"{secrets.randbelow(1000000):06d}"
    salt = secrets.token_hex(16)
    otp_hash = hashlib.sha256(f"{salt}:{otp_code}".encode("utf-8")).hexdigest()

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=30)

    recovery.otp_hash = otp_hash
    recovery.otp_salt = salt
    recovery.otp_expires_at = expires_at
    recovery.otp_attempts = 0
    recovery.updated_at = now

    db.commit()
    db.refresh(recovery)

    from app.services.notification_service import notify_otp_generated
    notify_otp_generated(db, recovery=recovery)

    return {
        "otp": otp_code,
        "expires_at": expires_at,
        "expires_in_seconds": 1800,
        "is_active": True,
        "attempts_remaining": 5,
    }


def request_handover_otp(
    db: Session,
    recovery_id: int,
    current_user: User,
) -> Recovery:
    """
    Either Claimant or Finder requests OTP verification for an active recovery.
    Upgrades handover_method from DIRECT to OTP.
    Once requested, handover_method cannot be downgraded back to DIRECT.
    """
    recovery = get_recovery_by_id(db, recovery_id=recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    reviewer_role = getattr(current_user, "role", "").strip().lower()
    is_staff = reviewer_role in ("admin", "superadmin", "administrator", "reviewer")
    if current_user.id not in (recovery.claimant_id, recovery.finder_id) and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the claimant or finder involved in this recovery may request OTP verification.",
        )

    rec_status = (recovery.status or "").upper()
    if rec_status != "RETURN_PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change handover method while recovery is in '{recovery.status}' status.",
        )

    rev_status = (recovery.review_status or "NOT_REQUIRED").upper()
    if rev_status in ("PENDING", "DISPUTED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change handover method while recovery is in '{recovery.review_status}' status. Resolution required first.",
        )

    # Idempotent if already OTP
    if (recovery.handover_method or "").upper() == "OTP":
        return recovery

    now = datetime.now(timezone.utc)
    recovery.handover_method = "OTP"
    recovery.updated_at = now

    if recovery.claim:
        recovery.claim.handover_method = "OTP"
        recovery.claim.updated_at = now

    db.commit()
    db.refresh(recovery)

    from app.services.notification_service import notify_otp_requested
    notify_otp_requested(db, recovery=recovery, requested_by=current_user)

    return recovery



def verify_handover_otp(
    db: Session,
    recovery_id: int,
    current_user: User,
    otp: str,
    return_location: str,
    return_notes: Optional[str] = None,
) -> Recovery:
    """
    Finder verifies the claimant's OTP at physical handover.
    Transitions status to RETURNED. (Claimant still must confirm recovery).
    """
    recovery = get_recovery_by_id(db, recovery_id=recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    if current_user.id != recovery.finder_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the finder who found this item is authorized to verify the handover OTP.",
        )

    if (recovery.handover_method or "").upper() != "OTP":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP verification is only available for recoveries using OTP handover mode.",
        )

    rec_status = (recovery.status or "").upper()
    if rec_status in ("RETURNED", "RECOVERED"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This recovery is already {rec_status.lower()} and cannot be verified again.",
        )

    if rec_status != "RETURN_PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot verify handover from status '{recovery.status}'.",
        )

    rev_status = (recovery.review_status or "NOT_REQUIRED").upper()
    if rev_status in ("PENDING", "DISPUTED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot verify handover while recovery is in '{recovery.review_status}' status.",
        )

    if not recovery.otp_hash or not recovery.otp_salt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found. Claimant must generate a handover OTP first.",
        )

    if (recovery.otp_attempts or 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum OTP verification attempts exceeded. Claimant must generate a new OTP.",
        )

    if recovery.otp_expires_at and _is_otp_expired(recovery.otp_expires_at):
        from app.services.notification_service import notify_otp_expired
        notify_otp_expired(db, recovery=recovery)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Claimant must generate a new OTP.",
        )

    now = datetime.now(timezone.utc)
    clean_otp = (otp or "").strip()
    check_hash = hashlib.sha256(f"{recovery.otp_salt}:{clean_otp}".encode("utf-8")).hexdigest()

    if check_hash != recovery.otp_hash:
        recovery.otp_attempts = (recovery.otp_attempts or 0) + 1
        recovery.updated_at = now
        db.commit()
        db.refresh(recovery)
        remaining = max(0, 5 - recovery.otp_attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP code. {remaining} attempt(s) remaining.",
        )

    # Valid OTP verified: mark RETURNED (not RECOVERED)
    clean_location = return_location.strip()
    clean_notes = return_notes.strip() if return_notes else None

    recovery.status = "RETURNED"
    recovery.return_location = clean_location
    recovery.return_notes = clean_notes
    recovery.returned_at = now
    recovery.otp_verified_at = now
    recovery.otp_hash = None  # Single-use: clear hash
    recovery.otp_salt = None
    recovery.updated_at = now

    if recovery.found_item:
        recovery.found_item.status = "RETURNED"
    if recovery.lost_item:
        recovery.lost_item.status = "RETURNED"

    db.commit()
    db.refresh(recovery)

    notify_handover_otp_verified(db, recovery)
    notify_item_returned(db, recovery, commit=True)

    return recovery


def mark_item_returned(
    db: Session,
    recovery_id: int,
    current_user: User,
    return_location: str,
    return_notes: Optional[str] = None,
) -> Recovery:
    """
    Finder marks the item as physically handed over via direct confirmation.
    Transitions status from RETURN_PENDING -> RETURNED.
    """
    recovery = get_recovery_by_id(db, recovery_id=recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    # Authorization: Only Finder
    if current_user.id != recovery.finder_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the finder who found this item is authorized to mark it as returned.",
        )

    # OTP mode check: Cannot mark returned directly if handover method is OTP
    if (recovery.handover_method or "").upper() == "OTP":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This recovery requires OTP handover verification. The finder must verify the claimant's OTP code instead of direct return confirmation.",
        )

    # Review status check
    rev_status = (recovery.review_status or "NOT_REQUIRED").upper()
    if rev_status in ("PENDING", "DISPUTED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot mark item returned while recovery is in '{recovery.review_status}' status.",
        )

    # State validation: Reject invalid transitions
    current_status = (recovery.status or "").upper()
    if current_status in ("RETURNED", "RECOVERED"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This recovery is already {current_status.lower()} and cannot be marked as returned again.",
        )

    if current_status != "RETURN_PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition to returned from status '{recovery.status}'.",
        )

    clean_location = return_location.strip()
    clean_notes = return_notes.strip() if return_notes else None
    now = datetime.now(timezone.utc)

    # Atomic updates
    recovery.status = "RETURNED"
    recovery.return_location = clean_location
    recovery.return_notes = clean_notes
    recovery.returned_at = now
    recovery.updated_at = now

    if recovery.found_item:
        recovery.found_item.status = "RETURNED"
    if recovery.lost_item:
        recovery.lost_item.status = "RETURNED"

    db.commit()
    db.refresh(recovery)

    # Trigger notification to claimant
    notify_item_returned(db, recovery, commit=True)

    return recovery


def confirm_recovery(
    db: Session,
    recovery_id: int,
    current_user: User,
) -> Recovery:
    """
    Claimant confirms receipt of their lost item.
    Transitions status from RETURNED -> RECOVERED in a single atomic transaction.
    Requires:
    1. Finder marked returned
    2. Claimant confirmed receipt
    3. Reviewer approved (or not required)
    4. No unresolved dispute
    """
    recovery = get_recovery_by_id(db, recovery_id=recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    # Authorization: Only Claimant
    if current_user.id != recovery.claimant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the claimant who lost this item is authorized to confirm recovery.",
        )

    # Review status check: No unresolved dispute or pending review
    rev_status = (recovery.review_status or "NOT_REQUIRED").upper()
    if rev_status in ("PENDING", "DISPUTED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm recovery while recovery is in '{recovery.review_status}' status. Resolution required first.",
        )

    # State validation
    current_status = (recovery.status or "").upper()
    if current_status == "RECOVERED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This item has already been confirmed as recovered.",
        )

    # Handover OTP verification enforcement: OTP must be verified before confirmation
    if (recovery.handover_method or "").upper() == "OTP" and not recovery.otp_verified_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot confirm recovery: Handover OTP has not been verified.",
        )

    if current_status != "RETURNED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot confirm recovery before the finder marks the item as returned.",
        )

    now = datetime.now(timezone.utc)

    # Atomic transaction
    recovery.status = "RECOVERED"
    recovery.confirmed_at = now
    recovery.updated_at = now

    if recovery.lost_item:
        recovery.lost_item.status = "RECOVERED"
    if recovery.found_item:
        recovery.found_item.status = "RETURNED"

    db.commit()
    db.refresh(recovery)

    # Trigger notification to finder
    notify_recovery_confirmed(db, recovery, commit=True)

    return recovery


def raise_recovery_dispute(
    db: Session,
    recovery_id: int,
    current_user: User,
    reason: str,
) -> Recovery:
    """
    Raises a dispute during the recovery lifecycle.
    Halts handover and finalization until resolved by a Reviewer.
    """
    recovery = get_recovery_by_id(db, recovery_id=recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    # Authorization: Claimant or Finder
    user_role = getattr(current_user, "role", "").strip().lower()
    is_staff = user_role in ("admin", "superadmin", "administrator", "reviewer")
    is_participant = current_user.id in (recovery.claimant_id, recovery.finder_id)

    if not (is_participant or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to raise a dispute on this recovery.",
        )

    if recovery.status in ("RECOVERED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot dispute a recovery that is already {recovery.status.lower()}.",
        )

    now = datetime.now(timezone.utc)
    clean_reason = reason.strip()

    recovery.review_status = "DISPUTED"
    recovery.review_reason = "DISPUTED"
    recovery.dispute_reason = clean_reason
    recovery.disputed_by = current_user.id
    recovery.disputed_at = now
    recovery.updated_at = now

    if recovery.claim:
        recovery.claim.review_status = "DISPUTED"
        recovery.claim.review_reason = "DISPUTED"
        recovery.claim.reviewer_notes = (recovery.claim.reviewer_notes or "") + f"\nDispute: {clean_reason}"

    db.commit()
    db.refresh(recovery)

    notify_dispute_raised(db, recovery_or_claim=recovery, reason=clean_reason, disputed_by_name=current_user.full_name)

    return recovery


def resolve_recovery_dispute(
    db: Session,
    recovery_id: int,
    reviewer: User,
    decision: str,
    notes: Optional[str] = None,
) -> Recovery:
    """
    Staff reviewer resolves a disputed recovery.
    Decision:
    - APPROVE: Resolves dispute in favor of claimant, unblocking handover.
    - REJECT: Cancels recovery and frees up the item for other claims.
    """
    recovery = get_recovery_by_id(db, recovery_id=recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    reviewer_role = getattr(reviewer, "role", "").strip().lower()
    if reviewer_role not in ("admin", "superadmin", "administrator", "reviewer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized reviewers or administrators can resolve disputes.",
        )

    # Conflict of interest check (Rule 4)
    if reviewer.id in (recovery.claimant_id, recovery.finder_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewers cannot resolve disputes on recoveries where they are a participant.",
        )

    now = datetime.now(timezone.utc)
    dec_norm = decision.strip().upper()

    if dec_norm in ("APPROVE", "RESOLVE"):
        recovery.review_status = "APPROVED"
        recovery.review_decision_notes = notes
        recovery.review_decision_by = reviewer.id
        recovery.review_decision_at = now
        recovery.updated_at = now

        if recovery.claim:
            recovery.claim.review_status = "APPROVED"
            recovery.claim.review_decision_notes = notes
            recovery.claim.review_decision_by = reviewer.id
            recovery.claim.review_decision_at = now

    elif dec_norm == "REJECT":
        recovery.review_status = "REJECTED"
        recovery.status = "CANCELLED"
        recovery.review_decision_notes = notes
        recovery.review_decision_by = reviewer.id
        recovery.review_decision_at = now
        recovery.updated_at = now

        if recovery.claim:
            recovery.claim.review_status = "REJECTED"
            recovery.claim.status = "REJECTED"
            recovery.claim.review_decision_notes = notes
            recovery.claim.review_decision_by = reviewer.id
            recovery.claim.review_decision_at = now

        # Free the found item for subsequent legitimate claims
        if recovery.found_item:
            recovery.found_item.status = "AVAILABLE"
        if recovery.lost_item:
            recovery.lost_item.status = "ACTIVE"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid resolution decision. Must be APPROVE or REJECT.",
        )

    db.commit()
    db.refresh(recovery)

    notify_dispute_resolved(db, recovery=recovery, decision=dec_norm, notes=notes)

    return recovery


def get_user_history(
    db: Session,
    current_user: User,
    page: int = 1,
    limit: int = 20,
    type_filter: str = "all",
    status_filter: str = "all",
    status: Optional[str] = None,
    role: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int, Dict[str, int]]:
    """
    Retrieves completed Lost & Found activity belonging to the authenticated user.
    Strictly isolated to current_user.id.
    """
    clean_type = (role or type_filter or "all").lower().strip()
    clean_status = (status or status_filter or "all").lower().strip()

    # User's recoveries as Claimant (Lost items or directly claimed found items)
    claimant_recoveries = (
        db.query(Recovery)
        .filter(Recovery.claimant_id == current_user.id)
        .options(joinedload(Recovery.lost_item), joinedload(Recovery.found_item))
        .all()
    )

    # User's recoveries as Finder (Found items)
    finder_recoveries = (
        db.query(Recovery)
        .filter(Recovery.finder_id == current_user.id)
        .options(joinedload(Recovery.found_item))
        .all()
    )

    # Also include any recovered LostItems owned by user (even if outside recovery table)
    user_lost_items = (
        db.query(LostItem)
        .filter(LostItem.user_id == current_user.id, LostItem.status.in_(["RECOVERED", "RETURNED"]))
        .all()
    )

    # User's returned FoundItems
    user_found_items = (
        db.query(FoundItem)
        .filter(FoundItem.user_id == current_user.id, FoundItem.status.in_(["RETURNED", "CLAIMED", "RECOVERED"]))
        .all()
    )

    history_entries = []
    seen_keys = set()

    # 1. From Claimant Recoveries
    for rec in claimant_recoveries:
        lost = rec.lost_item
        found = rec.found_item
        key = f"lost_{lost.id}" if lost else f"claimant_rec_{rec.id}"
        if key in seen_keys:
            continue
        seen_keys.add(key)

        status_label = "RECOVERED" if rec.status == "RECOVERED" else rec.status
        completed_date = rec.confirmed_at or rec.returned_at or rec.created_at

        item_id = lost.id if lost else (found.id if found else (rec.lost_item_id or rec.found_item_id))
        item_title = lost.title if lost else (found.title if found else "Claimed Item")
        item_category = lost.category if lost else (found.category if found else "General")
        item_location = lost.location if lost else (found.location if found else (rec.return_location or "Campus"))
        item_date = lost.lost_date if lost else (found.found_date if found else rec.created_at.strftime("%Y-%m-%d"))
        item_image = lost.image_url if lost else (found.image_url if found else None)

        history_entries.append({
            "id": item_id,
            "type": "LOST",
            "title": item_title,
            "category": item_category,
            "location": item_location,
            "status": status_label,
            "date": item_date,
            "image_url": item_image,
            "recovery_id": rec.id,
            "completed_at": completed_date,
            "return_location": rec.return_location,
            "user_role": "claimant",
        })

    # 2. From Finder Recoveries
    for rec in finder_recoveries:
        found = rec.found_item
        key = f"found_{found.id if found else rec.found_item_id}"
        if key in seen_keys:
            continue
        seen_keys.add(key)

        status_label = "RETURNED" if rec.status in ("RETURNED", "RECOVERED") else rec.status
        completed_date = rec.returned_at or rec.confirmed_at or rec.created_at

        history_entries.append({
            "id": found.id if found else rec.found_item_id,
            "type": "FOUND",
            "title": found.title if found else "Found Item",
            "category": found.category if found else "General",
            "location": found.location if found else "Campus",
            "status": status_label,
            "date": found.found_date if found else rec.created_at.strftime("%Y-%m-%d"),
            "image_url": found.image_url if found else None,
            "recovery_id": rec.id,
            "completed_at": completed_date,
            "return_location": rec.return_location,
            "user_role": "finder",
        })

    # 3. Direct items fallback
    for l in user_lost_items:
        key = f"lost_{l.id}"
        if key not in seen_keys:
            seen_keys.add(key)
            history_entries.append({
                "id": l.id,
                "type": "LOST",
                "title": l.title,
                "category": l.category,
                "location": l.location,
                "status": l.status,
                "date": l.lost_date,
                "image_url": l.image_url,
                "recovery_id": None,
                "completed_at": l.updated_at or l.created_at,
                "return_location": None,
                "user_role": "claimant",
            })

    for f in user_found_items:
        key = f"found_{f.id}"
        if key not in seen_keys:
            seen_keys.add(key)
            history_entries.append({
                "id": f.id,
                "type": "FOUND",
                "title": f.title,
                "category": f.category,
                "location": f.location,
                "status": f.status,
                "date": f.found_date,
                "image_url": f.image_url,
                "recovery_id": None,
                "completed_at": f.updated_at or f.created_at,
                "return_location": None,
                "user_role": "finder",
            })

    # Filter by type or role
    filtered = history_entries
    if clean_type in ("lost", "found"):
        filtered = [h for h in filtered if h["type"].lower() == clean_type]
    elif clean_type in ("claimant", "finder"):
        filtered = [h for h in filtered if h.get("user_role", "").lower() == clean_type]

    # Filter by status
    if clean_status != "all":
        filtered = [h for h in filtered if h["status"].lower() == clean_status]

    # Counts
    counts = {
        "all": len(history_entries),
        "lost": sum(1 for h in history_entries if h["type"] == "LOST"),
        "found": sum(1 for h in history_entries if h["type"] == "FOUND"),
        "recovered": sum(1 for h in history_entries if h["status"] == "RECOVERED"),
        "returned": sum(1 for h in history_entries if h["status"] == "RETURNED"),
    }

    # Sort newest first
    filtered.sort(
        key=lambda x: x["completed_at"] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    total = len(filtered)
    offset = (max(page, 1) - 1) * limit
    paginated = filtered[offset : offset + limit]

    return paginated, total, counts


def get_history_stats(db: Session, current_user: User) -> Dict[str, int]:
    """Returns statistics for dashboard cards and action badges."""
    recovered_count = (
        db.query(LostItem)
        .filter(LostItem.user_id == current_user.id, LostItem.status == "RECOVERED")
        .count()
    )

    returned_count = (
        db.query(FoundItem)
        .filter(FoundItem.user_id == current_user.id, FoundItem.status.in_(["RETURNED", "CLAIMED"]))
        .count()
    )

    pending_action_count = (
        db.query(Recovery)
        .filter(Recovery.claimant_id == current_user.id, Recovery.status == "RETURNED")
        .count()
    )

    return {
        "recovered_count": recovered_count,
        "returned_count": returned_count,
        "pending_action_count": pending_action_count,
    }
