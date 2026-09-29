from datetime import datetime, timezone
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
)


def create_recovery_for_claim(
    db: Session,
    claim: Claim,
    commit: bool = True,
) -> Recovery:
    """
    Creates a new Recovery tracking record for an approved claim.
    If a recovery already exists for this claim, returns it idempotently.
    """
    existing = db.query(Recovery).filter(Recovery.claim_id == claim.id).first()
    if existing:
        return existing

    lost_id = claim.match.lost_item_id if claim.match else claim.match_id
    found_id = claim.match.found_item_id if claim.match else claim.match_id
    finder_id = claim.match.found_item.user_id if claim.match and claim.match.found_item else 0

    recovery = Recovery(
        claim_id=claim.id,
        match_id=claim.match_id,
        lost_item_id=lost_id,
        found_item_id=found_id,
        claimant_id=claim.claimant_id,
        finder_id=finder_id,
        status="RETURN_PENDING",
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
    """Constructs the visual 6-stage lifecycle timeline for the recovery flow."""
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
            "title": "Match Correlated",
            "status": "completed",
            "timestamp": match_time,
            "description": "Matching engine detected high-confidence match on campus.",
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
            "title": "Claim Approved",
            "status": "completed",
            "timestamp": claim_appr_time,
            "description": "Finder reviewed and accepted ownership verification.",
        },
        {
            "key": "return_pending",
            "title": "Return Coordination",
            "status": "completed" if rec_status in ("RETURNED", "RECOVERED") else "current",
            "timestamp": recovery.created_at,
            "description": "Participants coordinate physical handover through messaging.",
        },
        {
            "key": "item_returned",
            "title": "Item Handed Over",
            "status": (
                "completed"
                if rec_status == "RECOVERED"
                else ("current" if rec_status == "RETURNED" else "upcoming")
            ),
            "timestamp": recovery.returned_at,
            "description": (
                f"Finder marked item returned at {recovery.return_location}."
                if recovery.return_location
                else "Finder marks item as physically handed over."
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
    """Formats full recovery object with permissions and contextual data."""
    lost = recovery.lost_item
    found = recovery.found_item
    claimant = recovery.claimant
    finder = recovery.finder

    # Conversation ID lookup
    conv = db.query(Conversation).filter(Conversation.claim_id == recovery.claim_id).first()
    conversation_id = conv.id if conv else None

    # Role-based action permissions
    rec_status = (recovery.status or "").upper()
    can_mark_returned = current_user.id == recovery.finder_id and rec_status == "RETURN_PENDING"
    can_confirm_recovery = current_user.id == recovery.claimant_id and rec_status == "RETURNED"

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
    }


def mark_item_returned(
    db: Session,
    recovery_id: int,
    current_user: User,
    return_location: str,
    return_notes: Optional[str] = None,
) -> Recovery:
    """
    Finder marks the item as physically handed over.
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

    # State validation
    current_status = (recovery.status or "").upper()
    if current_status == "RECOVERED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This item has already been confirmed as recovered.",
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

    # User's recoveries as Claimant (Lost items)
    claimant_recoveries = (
        db.query(Recovery)
        .filter(Recovery.claimant_id == current_user.id)
        .options(joinedload(Recovery.lost_item))
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
        key = f"lost_{lost.id if lost else rec.lost_item_id}"
        if key in seen_keys:
            continue
        seen_keys.add(key)

        status_label = "RECOVERED" if rec.status == "RECOVERED" else rec.status
        completed_date = rec.confirmed_at or rec.returned_at or rec.created_at

        history_entries.append({
            "id": lost.id if lost else rec.lost_item_id,
            "type": "LOST",
            "title": lost.title if lost else "Lost Item",
            "category": lost.category if lost else "General",
            "location": lost.location if lost else "Campus",
            "status": status_label,
            "date": lost.lost_date if lost else rec.created_at.strftime("%Y-%m-%d"),
            "image_url": lost.image_url if lost else None,
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
    # Count recovered items for user
    recovered_count = (
        db.query(LostItem)
        .filter(LostItem.user_id == current_user.id, LostItem.status == "RECOVERED")
        .count()
    )

    # Count returned items by user
    returned_count = (
        db.query(FoundItem)
        .filter(FoundItem.user_id == current_user.id, FoundItem.status.in_(["RETURNED", "CLAIMED"]))
        .count()
    )

    # Action required count: Claimant has an item with status RETURNED waiting for confirmation
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
