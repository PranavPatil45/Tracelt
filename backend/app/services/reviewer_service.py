import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func, desc

from app.models.user import User
from app.models.claim import Claim
from app.models.recovery import Recovery
from app.models.found_item import FoundItem
from app.models.lost_item import LostItem
from app.models.reviewer_assignment import ReviewerAssignment
from app.services.claim_service import review_claim, get_all_active_claims_for_found_item
from app.services.recovery_service import resolve_recovery_dispute, get_recovery_by_id
from app.services.notification_service import create_notification

logger = logging.getLogger("tracelt.reviewer_service")

REVIEWER_ROLES = ("reviewer", "admin", "superadmin", "administrator")
ADMIN_ROLES = ("admin", "superadmin", "administrator")


def is_eligible_reviewer(user: Optional[User]) -> bool:
    """Verifies that a user has active reviewer or administrative privileges."""
    if not user or not user.is_active:
        return False
    role = (user.role or "").strip().lower()
    return role in REVIEWER_ROLES


def is_system_admin(user: Optional[User]) -> bool:
    """Verifies that a user is a system administrator."""
    if not user or not user.is_active:
        return False
    role = (user.role or "").strip().lower()
    return role in ADMIN_ROLES


def check_case_conflict(reviewer_id: int, claimant_id: int, finder_id: Optional[int]) -> bool:
    """
    Checks conflict of interest.
    A reviewer cannot review or be assigned to a case where they are the claimant or the finder.
    """
    if reviewer_id == claimant_id:
        return True
    if finder_id is not None and reviewer_id == finder_id:
        return True
    return False


# --- Workload & Eligible Reviewers ---

def get_eligible_reviewers_with_workload(
    db: Session,
    campus_scope: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetches all eligible reviewers (role in reviewer, admin, superadmin, administrator)
    along with their current active assigned workload.
    """
    query = db.query(User).filter(
        User.is_active == True,
        func.lower(User.role).in_(REVIEWER_ROLES),
    )
    if campus_scope and campus_scope.upper() != "ALL":
        query = query.filter(User.campus == campus_scope)

    reviewers = query.order_by(User.full_name.asc()).all()
    results = []

    for r in reviewers:
        # Active assigned claims: PENDING or UNDER_REVIEW
        active_claims = (
            db.query(Claim)
            .filter(
                Claim.assigned_reviewer_id == r.id,
                Claim.status.in_(["PENDING", "UNDER_REVIEW"]),
            )
            .all()
        )
        claims_pending = sum(1 for c in active_claims if c.status == "PENDING")
        claims_under_review = sum(1 for c in active_claims if c.status == "UNDER_REVIEW")

        # Active assigned recoveries: RETURN_PENDING with PENDING or DISPUTED review_status
        active_recoveries = (
            db.query(Recovery)
            .filter(
                Recovery.assigned_reviewer_id == r.id,
                Recovery.status == "RETURN_PENDING",
                Recovery.review_status.in_(["PENDING", "DISPUTED"]),
            )
            .all()
        )
        rec_pending = sum(1 for rec in active_recoveries if rec.review_status == "PENDING")
        rec_under_review = sum(1 for rec in active_recoveries if rec.review_status == "DISPUTED")

        # Resolved cases
        resolved_claims = (
            db.query(Claim)
            .filter(
                Claim.assigned_reviewer_id == r.id,
                Claim.status.in_(["APPROVED", "REJECTED"]),
            )
            .count()
        )
        resolved_recoveries = (
            db.query(Recovery)
            .filter(
                Recovery.assigned_reviewer_id == r.id,
                Recovery.review_status.in_(["APPROVED", "REJECTED"]),
            )
            .count()
        )

        # Last assigned at
        last_assign = (
            db.query(ReviewerAssignment)
            .filter(ReviewerAssignment.reviewer_id == r.id)
            .order_by(ReviewerAssignment.id.desc())
            .first()
        )

        active_total = len(active_claims) + len(active_recoveries)
        pending_total = claims_pending + rec_pending
        under_review_total = claims_under_review + rec_under_review
        resolved_total = resolved_claims + resolved_recoveries

        results.append({
            "id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "role": r.role,
            "campus": r.campus or "Campus",
            "department": r.department,
            "active_assigned_count": active_total,
            "pending_count": pending_total,
            "under_review_count": under_review_total,
            "resolved_count": resolved_total,
            "last_assigned_at": last_assign.created_at if last_assign else None,
        })

    return results


def get_unassigned_cases(
    db: Session,
    campus_scope: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetches all unassigned cases requiring reviewer intervention:
    1. Claims requiring review (review_status == 'PENDING') without assigned reviewer.
    2. Recoveries requiring review or disputed without assigned reviewer.
    """
    # Claims
    claims_query = (
        db.query(Claim)
        .options(
            joinedload(Claim.found_item),
            joinedload(Claim.lost_item),
            joinedload(Claim.claimant),
        )
        .filter(
            Claim.review_status == "PENDING",
            Claim.status.in_(["PENDING", "UNDER_REVIEW"]),
            Claim.assigned_reviewer_id.is_(None),
        )
    )
    if campus_scope and campus_scope.upper() != "ALL":
        claims_query = claims_query.join(FoundItem, Claim.found_item_id == FoundItem.id).filter(
            FoundItem.campus == campus_scope
        )
    unassigned_claims = claims_query.order_by(Claim.created_at.desc()).all()

    # Recoveries
    rec_query = (
        db.query(Recovery)
        .options(
            joinedload(Recovery.found_item),
            joinedload(Recovery.claimant),
            joinedload(Recovery.finder),
        )
        .filter(
            Recovery.review_status.in_(["PENDING", "DISPUTED"]),
            Recovery.assigned_reviewer_id.is_(None),
        )
    )
    if campus_scope and campus_scope.upper() != "ALL":
        rec_query = rec_query.join(FoundItem, Recovery.found_item_id == FoundItem.id).filter(
            FoundItem.campus == campus_scope
        )
    unassigned_recoveries = rec_query.order_by(Recovery.created_at.desc()).all()

    cases = []
    for c in unassigned_claims:
        finder_name = c.found_item.user.full_name if (c.found_item and c.found_item.user) else None
        cases.append({
            "case_type": "CLAIM",
            "case_id": c.id,
            "claim_id": c.id,
            "recovery_id": None,
            "status": c.status,
            "review_status": c.review_status,
            "review_reason": c.review_reason,
            "item_title": c.found_item.title if c.found_item else "Item",
            "item_category": c.found_item.category if c.found_item else "General",
            "item_image": c.found_item.image_url if c.found_item else None,
            "claimant_id": c.claimant_id,
            "claimant_name": c.claimant.full_name if c.claimant else "User",
            "finder_id": c.found_item.user_id if c.found_item else None,
            "finder_name": finder_name,
            "assigned_reviewer_id": None,
            "assigned_reviewer_name": None,
            "assigned_at": None,
            "created_at": c.created_at,
            "is_urgent": c.review_reason in ("COMPETING_CLAIMS", "HIGH_RISK"),
            "is_competing": c.review_reason == "COMPETING_CLAIMS",
        })

    for r in unassigned_recoveries:
        cases.append({
            "case_type": "RECOVERY",
            "case_id": r.id,
            "claim_id": r.claim_id,
            "recovery_id": r.id,
            "status": r.status,
            "review_status": r.review_status,
            "review_reason": r.review_reason,
            "item_title": r.found_item.title if r.found_item else "Item",
            "item_category": r.found_item.category if r.found_item else "General",
            "item_image": r.found_item.image_url if r.found_item else None,
            "claimant_id": r.claimant_id,
            "claimant_name": r.claimant.full_name if r.claimant else "Claimant",
            "finder_id": r.finder_id,
            "finder_name": r.finder.full_name if r.finder else "Finder",
            "assigned_reviewer_id": None,
            "assigned_reviewer_name": None,
            "assigned_at": None,
            "created_at": r.created_at,
            "is_urgent": r.review_status == "DISPUTED",
            "is_competing": False,
        })

    return {
        "cases": cases,
        "total": len(cases),
    }


# --- Assignment Operations ---

def assign_claim(
    db: Session,
    claim_id: int,
    reviewer_id: Optional[int],
    assigned_by: User,
    notes: Optional[str] = None,
) -> Claim:
    """
    Assigns, reassigns, or unassigns a reviewer to a claim.
    Enforces conflict-of-interest validation: Reviewer cannot be claimant or finder.
    """
    claim = (
        db.query(Claim)
        .options(joinedload(Claim.found_item))
        .filter(Claim.id == claim_id)
        .first()
    )
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim #{claim_id} not found.",
        )

    # If unassigning
    if reviewer_id is None:
        old_reviewer_id = claim.assigned_reviewer_id
        claim.assigned_reviewer_id = None
        claim.assigned_at = None
        claim.assignment_notes = notes

        if old_reviewer_id:
            assignment_entry = ReviewerAssignment(
                case_type="CLAIM",
                case_id=claim.id,
                claim_id=claim.id,
                reviewer_id=old_reviewer_id,
                assigned_by_id=assigned_by.id,
                assignment_action="UNASSIGNED",
                notes=notes or "Unassigned by administrator",
            )
            db.add(assignment_entry)

        db.commit()
        db.refresh(claim)
        return claim

    # Assigning to a reviewer
    target_reviewer = db.query(User).filter(User.id == reviewer_id).first()
    if not target_reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reviewer with ID {reviewer_id} not found.",
        )

    if not is_eligible_reviewer(target_reviewer):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User {target_reviewer.full_name} ({target_reviewer.email}) does not have an eligible reviewer role.",
        )

    finder_id = claim.found_item.user_id if claim.found_item else None
    if check_case_conflict(reviewer_id, claim.claimant_id, finder_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conflict of interest: A user cannot be assigned to review an item they claimed or reported finding.",
        )

    was_assigned = claim.assigned_reviewer_id is not None
    action_type = "REASSIGNED" if was_assigned else "ASSIGNED"
    now = datetime.now(timezone.utc)

    claim.assigned_reviewer_id = reviewer_id
    claim.assigned_at = now
    claim.assigned_by_id = assigned_by.id
    claim.assignment_notes = notes

    assignment_entry = ReviewerAssignment(
        case_type="CLAIM",
        case_id=claim.id,
        claim_id=claim.id,
        reviewer_id=reviewer_id,
        assigned_by_id=assigned_by.id,
        assignment_action=action_type,
        notes=notes,
    )
    db.add(assignment_entry)

    # In-app notification to reviewer
    item_title = claim.found_item.title if claim.found_item else "Item"
    create_notification(
        db=db,
        user_id=reviewer_id,
        type="CASE_ASSIGNED",
        title="New Case Assigned for Review",
        message=f"You have been assigned to review Claim #{claim.id} for '{item_title}'.",
        related_entity_type="claim",
        related_entity_id=claim.id,
        commit=False,
    )

    db.commit()
    db.refresh(claim)
    return claim


def assign_recovery(
    db: Session,
    recovery_id: int,
    reviewer_id: Optional[int],
    assigned_by: User,
    notes: Optional[str] = None,
) -> Recovery:
    """
    Assigns, reassigns, or unassigns a reviewer to a recovery.
    Enforces conflict-of-interest validation: Reviewer cannot be claimant or finder.
    """
    recovery = (
        db.query(Recovery)
        .options(joinedload(Recovery.found_item))
        .filter(Recovery.id == recovery_id)
        .first()
    )
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recovery #{recovery_id} not found.",
        )

    if reviewer_id is None:
        old_reviewer_id = recovery.assigned_reviewer_id
        recovery.assigned_reviewer_id = None
        recovery.assigned_at = None
        recovery.assignment_notes = notes

        if old_reviewer_id:
            assignment_entry = ReviewerAssignment(
                case_type="RECOVERY",
                case_id=recovery.id,
                recovery_id=recovery.id,
                reviewer_id=old_reviewer_id,
                assigned_by_id=assigned_by.id,
                assignment_action="UNASSIGNED",
                notes=notes or "Unassigned by administrator",
            )
            db.add(assignment_entry)

        db.commit()
        db.refresh(recovery)
        return recovery

    target_reviewer = db.query(User).filter(User.id == reviewer_id).first()
    if not target_reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reviewer with ID {reviewer_id} not found.",
        )

    if not is_eligible_reviewer(target_reviewer):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User {target_reviewer.full_name} does not have an eligible reviewer role.",
        )

    if check_case_conflict(reviewer_id, recovery.claimant_id, recovery.finder_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conflict of interest: A user cannot be assigned to review a recovery where they are claimant or finder.",
        )

    was_assigned = recovery.assigned_reviewer_id is not None
    action_type = "REASSIGNED" if was_assigned else "ASSIGNED"
    now = datetime.now(timezone.utc)

    recovery.assigned_reviewer_id = reviewer_id
    recovery.assigned_at = now
    recovery.assigned_by_id = assigned_by.id
    recovery.assignment_notes = notes

    assignment_entry = ReviewerAssignment(
        case_type="RECOVERY",
        case_id=recovery.id,
        recovery_id=recovery.id,
        reviewer_id=reviewer_id,
        assigned_by_id=assigned_by.id,
        assignment_action=action_type,
        notes=notes,
    )
    db.add(assignment_entry)

    item_title = recovery.found_item.title if recovery.found_item else "Item"
    create_notification(
        db=db,
        user_id=reviewer_id,
        type="CASE_ASSIGNED",
        title="Disputed Case Assigned for Review",
        message=f"You have been assigned to review Recovery #{recovery.id} for '{item_title}'.",
        related_entity_type="recovery",
        related_entity_id=recovery.id,
        commit=False,
    )

    db.commit()
    db.refresh(recovery)
    return recovery


def auto_assign_unassigned_cases(
    db: Session,
    campus_scope: Optional[str],
    assigned_by: User,
) -> Dict[str, Any]:
    """
    Automatically assigns unassigned review-required cases to the least-loaded eligible reviewers,
    strictly honoring conflict-of-interest constraints and campus boundaries where applicable.
    """
    unassigned = get_unassigned_cases(db=db, campus_scope=campus_scope)
    case_list = unassigned["cases"]
    if not case_list:
        return {
            "success": True,
            "assigned_count": 0,
            "message": "No unassigned cases requiring reviewer intervention.",
            "assignments": [],
        }

    # Fetch eligible reviewers with workload
    reviewers_workload = get_eligible_reviewers_with_workload(db=db, campus_scope=campus_scope)
    if not reviewers_workload:
        return {
            "success": False,
            "assigned_count": 0,
            "message": "No eligible reviewers available for assignment.",
            "assignments": [],
        }

    # Track active count dynamically during assignment loop
    reviewer_loads = {r["id"]: r["active_assigned_count"] for r in reviewers_workload}
    assigned_results = []

    for c in case_list:
        case_type = c["case_type"]
        case_id = c["case_id"]
        claimant_id = c["claimant_id"]
        finder_id = c["finder_id"]

        # Filter reviewers who do not have a conflict of interest
        eligible_candidates = [
            r for r in reviewers_workload
            if not check_case_conflict(r["id"], claimant_id, finder_id)
        ]

        if not eligible_candidates:
            logger.warning(f"Could not auto-assign {case_type} #{case_id}: no conflict-free reviewers available.")
            continue

        # Pick candidate with minimum current load
        chosen = min(eligible_candidates, key=lambda r: reviewer_loads[r["id"]])
        chosen_id = chosen["id"]

        try:
            if case_type == "CLAIM":
                assign_claim(
                    db=db,
                    claim_id=case_id,
                    reviewer_id=chosen_id,
                    assigned_by=assigned_by,
                    notes="Auto-assigned based on workload balance",
                )
            else:
                assign_recovery(
                    db=db,
                    recovery_id=case_id,
                    reviewer_id=chosen_id,
                    assigned_by=assigned_by,
                    notes="Auto-assigned based on workload balance",
                )

            reviewer_loads[chosen_id] += 1
            assigned_results.append({
                "case_type": case_type,
                "case_id": case_id,
                "reviewer_id": chosen_id,
                "reviewer_name": chosen["full_name"],
            })
        except Exception as e:
            logger.error(f"Error auto-assigning {case_type} #{case_id}: {e}")

    return {
        "success": True,
        "assigned_count": len(assigned_results),
        "message": f"Successfully assigned {len(assigned_results)} cases.",
        "assignments": assigned_results,
    }


def get_case_assignment_history(
    db: Session,
    case_type: str,
    case_id: int,
) -> List[Dict[str, Any]]:
    """Retrieves the complete audit history of reviewer assignments for a case."""
    assignments = (
        db.query(ReviewerAssignment)
        .options(
            joinedload(ReviewerAssignment.reviewer),
            joinedload(ReviewerAssignment.assigned_by),
        )
        .filter(
            ReviewerAssignment.case_type == case_type.upper(),
            ReviewerAssignment.case_id == case_id,
        )
        .order_by(ReviewerAssignment.id.desc())
        .all()
    )

    return [
        {
            "id": a.id,
            "case_type": a.case_type,
            "case_id": a.case_id,
            "reviewer_id": a.reviewer_id,
            "reviewer_name": a.reviewer.full_name if a.reviewer else "Unknown",
            "assigned_by_id": a.assigned_by_id,
            "assigned_by_name": a.assigned_by.full_name if a.assigned_by else "System",
            "action": a.assignment_action,
            "notes": a.notes,
            "created_at": a.created_at,
        }
        for a in assignments
    ]


# --- Reviewer Portal Views & Dashboard ---

def get_reviewer_dashboard_stats(
    db: Session,
    reviewer: User,
) -> Dict[str, Any]:
    """Retrieves aggregated statistics for the reviewer's dedicated dashboard."""
    is_admin = is_system_admin(reviewer)

    # Base filters
    claim_query = db.query(Claim)
    rec_query = db.query(Recovery)

    if not is_admin:
        claim_query = claim_query.filter(Claim.assigned_reviewer_id == reviewer.id)
        rec_query = rec_query.filter(Recovery.assigned_reviewer_id == reviewer.id)

    assigned_claims = claim_query.all()
    assigned_recoveries = rec_query.all()

    assigned_total = len(assigned_claims) + len(assigned_recoveries)
    pending_review = (
        sum(1 for c in assigned_claims if c.status == "PENDING" and c.review_status == "PENDING")
        + sum(1 for r in assigned_recoveries if r.review_status == "PENDING")
    )
    under_review = (
        sum(1 for c in assigned_claims if c.status == "UNDER_REVIEW")
    )
    disputes_count = (
        sum(1 for r in assigned_recoveries if r.review_status == "DISPUTED")
    )
    completed_count = (
        sum(1 for c in assigned_claims if c.status in ("APPROVED", "REJECTED"))
        + sum(1 for r in assigned_recoveries if r.review_status in ("APPROVED", "REJECTED"))
    )

    # Identify urgent cases (competing claims or disputes)
    urgent_cases = []
    for c in assigned_claims:
        if c.status in ("PENDING", "UNDER_REVIEW") and c.review_reason in ("COMPETING_CLAIMS", "HIGH_RISK"):
            urgent_cases.append({
                "case_type": "CLAIM",
                "case_id": c.id,
                "title": f"Competing Claim #{c.id}",
                "reason": c.review_reason,
                "created_at": c.created_at,
            })
    for r in assigned_recoveries:
        if r.review_status == "DISPUTED":
            urgent_cases.append({
                "case_type": "RECOVERY",
                "case_id": r.id,
                "title": f"Disputed Recovery #{r.id}",
                "reason": r.dispute_reason or "Dispute",
                "created_at": r.disputed_at or r.created_at,
            })

    return {
        "assigned_total": assigned_total,
        "pending_review": pending_review,
        "under_review": under_review,
        "disputes_count": disputes_count,
        "completed_count": completed_count,
        "urgent_cases": urgent_cases[:5],
    }


def get_reviewer_cases(
    db: Session,
    reviewer: User,
    case_type_filter: str = "ALL",
    status_filter: str = "ALL",
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Fetches the list of cases assigned to this reviewer, with support for filtering and search.
    If the reviewer is a system administrator, allows viewing all assigned cases.
    """
    is_admin = is_system_admin(reviewer)
    all_cases: List[Dict[str, Any]] = []

    # 1. Fetch claims
    if case_type_filter.upper() in ("ALL", "CLAIM", "CLAIMS"):
        c_query = (
            db.query(Claim)
            .options(
                joinedload(Claim.found_item),
                joinedload(Claim.claimant),
                joinedload(Claim.assigned_reviewer),
            )
        )
        if not is_admin:
            c_query = c_query.filter(Claim.assigned_reviewer_id == reviewer.id)

        claims = c_query.order_by(Claim.created_at.desc()).all()
        for c in claims:
            # Status filter
            c_status = (c.status or "").upper()
            c_rev_status = (c.review_status or "").upper()

            if status_filter != "ALL":
                sf = status_filter.upper()
                if sf in ("PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"):
                    if c_status != sf and c_rev_status != sf:
                        continue
                elif sf == "COMPLETED" and c_status not in ("APPROVED", "REJECTED"):
                    continue

            finder_name = c.found_item.user.full_name if (c.found_item and c.found_item.user) else None
            item_title = c.found_item.title if c.found_item else "Item"
            claimant_name = c.claimant.full_name if c.claimant else "User"

            if search:
                s_lower = search.lower()
                if (
                    s_lower not in item_title.lower()
                    and s_lower not in claimant_name.lower()
                    and s_lower not in str(c.id)
                ):
                    continue

            all_cases.append({
                "case_type": "CLAIM",
                "case_id": c.id,
                "claim_id": c.id,
                "recovery_id": None,
                "status": c.status,
                "review_status": c.review_status,
                "review_reason": c.review_reason,
                "item_title": item_title,
                "item_category": c.found_item.category if c.found_item else "General",
                "item_image": c.found_item.image_url if c.found_item else None,
                "claimant_id": c.claimant_id,
                "claimant_name": claimant_name,
                "finder_id": c.found_item.user_id if c.found_item else None,
                "finder_name": finder_name,
                "assigned_reviewer_id": c.assigned_reviewer_id,
                "assigned_reviewer_name": c.assigned_reviewer.full_name if c.assigned_reviewer else None,
                "assigned_at": c.assigned_at,
                "created_at": c.created_at,
                "is_urgent": c.review_reason in ("COMPETING_CLAIMS", "HIGH_RISK"),
                "is_competing": c.review_reason == "COMPETING_CLAIMS",
            })

    # 2. Fetch recoveries
    if case_type_filter.upper() in ("ALL", "RECOVERY", "RECOVERIES", "DISPUTES"):
        r_query = (
            db.query(Recovery)
            .options(
                joinedload(Recovery.found_item),
                joinedload(Recovery.claimant),
                joinedload(Recovery.finder),
                joinedload(Recovery.assigned_reviewer),
            )
        )
        if not is_admin:
            r_query = r_query.filter(Recovery.assigned_reviewer_id == reviewer.id)

        recoveries = r_query.order_by(Recovery.created_at.desc()).all()
        for r in recoveries:
            r_status = (r.status or "").upper()
            r_rev_status = (r.review_status or "").upper()

            if status_filter != "ALL":
                sf = status_filter.upper()
                if sf == "DISPUTED" and r_rev_status != "DISPUTED":
                    continue
                elif sf in ("PENDING", "APPROVED", "REJECTED") and r_rev_status != sf:
                    continue
                elif sf == "COMPLETED" and r_status not in ("RECOVERED", "RETURNED", "CANCELLED"):
                    continue

            item_title = r.found_item.title if r.found_item else "Item"
            claimant_name = r.claimant.full_name if r.claimant else "User"

            if search:
                s_lower = search.lower()
                if (
                    s_lower not in item_title.lower()
                    and s_lower not in claimant_name.lower()
                    and s_lower not in str(r.id)
                ):
                    continue

            all_cases.append({
                "case_type": "RECOVERY",
                "case_id": r.id,
                "claim_id": r.claim_id,
                "recovery_id": r.id,
                "status": r.status,
                "review_status": r.review_status,
                "review_reason": r.review_reason,
                "item_title": item_title,
                "item_category": r.found_item.category if r.found_item else "General",
                "item_image": r.found_item.image_url if r.found_item else None,
                "claimant_id": r.claimant_id,
                "claimant_name": claimant_name,
                "finder_id": r.finder_id,
                "finder_name": r.finder.full_name if r.finder else "Finder",
                "assigned_reviewer_id": r.assigned_reviewer_id,
                "assigned_reviewer_name": r.assigned_reviewer.full_name if r.assigned_reviewer else None,
                "assigned_at": r.assigned_at,
                "created_at": r.created_at,
                "is_urgent": r.review_status == "DISPUTED",
                "is_competing": False,
            })

    # Sort all cases by created_at desc
    all_cases.sort(key=lambda x: x["created_at"], reverse=True)

    total = len(all_cases)
    start_idx = (page - 1) * limit
    paginated = all_cases[start_idx : start_idx + limit]

    return {
        "cases": paginated,
        "total": total,
        "page": page,
        "limit": limit,
    }


def get_case_review_details(
    db: Session,
    case_type: str,
    case_id: int,
    reviewer: User,
) -> Dict[str, Any]:
    """
    Retrieves full details of a case for the reviewer workspace.
    Includes item info, claimant/finder info, verification evidence, competing claims,
    and assignment audit history.
    NEVER exposes plaintext OTP.
    """
    case_norm = case_type.strip().upper()

    if case_norm == "CLAIM":
        claim = (
            db.query(Claim)
            .options(
                joinedload(Claim.found_item),
                joinedload(Claim.lost_item),
                joinedload(Claim.claimant),
                joinedload(Claim.assigned_reviewer),
                joinedload(Claim.review_decider),
            )
            .filter(Claim.id == case_id)
            .first()
        )
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Claim #{case_id} not found.",
            )

        # Conflict check for viewer
        finder_id = claim.found_item.user_id if claim.found_item else None
        if check_case_conflict(reviewer.id, claim.claimant_id, finder_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conflict of interest: You cannot view or review this case as you are a direct party to it.",
            )

        # Check if user is assigned reviewer or admin
        is_admin = is_system_admin(reviewer)
        if claim.assigned_reviewer_id and claim.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This case is assigned to another reviewer. Only the assigned reviewer or an administrator may access it.",
            )

        # Found item summary
        found_summary = None
        if claim.found_item:
            fi = claim.found_item
            found_summary = {
                "id": fi.id,
                "title": fi.title,
                "category": fi.category,
                "description": fi.description,
                "location": fi.location,
                "campus": fi.campus,
                "found_date": str(fi.found_date) if fi.found_date else None,
                "found_time": fi.found_time,
                "image_url": fi.image_url,
                "status": fi.status,
            }

        # Lost item summary
        lost_summary = None
        if claim.lost_item:
            li = claim.lost_item
            lost_summary = {
                "id": li.id,
                "title": li.title,
                "category": li.category,
                "description": li.description,
                "location": li.location,
                "campus": li.campus,
                "lost_date": str(li.lost_date) if li.lost_date else None,
                "lost_time": li.lost_time,
                "image_url": li.image_url,
                "status": li.status,
            }

        # Claimant summary
        claimant_summary = None
        if claim.claimant:
            cl = claim.claimant
            claimant_summary = {
                "id": cl.id,
                "full_name": cl.full_name,
                "email": cl.email,
                "campus": cl.campus,
                "phone": cl.phone,
                "department": cl.department,
                "profile_image": cl.profile_image,
            }

        # Finder summary
        finder_summary = None
        if claim.found_item and claim.found_item.user:
            fn = claim.found_item.user
            finder_summary = {
                "id": fn.id,
                "full_name": fn.full_name,
                "email": fn.email,
                "campus": fn.campus,
                "phone": fn.phone,
                "department": fn.department,
                "profile_image": fn.profile_image,
            }

        # Competing claims
        competing_claims = []
        if claim.found_item_id:
            other_claims = get_all_active_claims_for_found_item(db, claim.found_item_id)
            for oc in other_claims:
                if oc.id != claim.id:
                    competing_claims.append({
                        "id": oc.id,
                        "claimant_id": oc.claimant_id,
                        "claimant_name": oc.claimant.full_name if oc.claimant else "User",
                        "claimant_email": oc.claimant.email if oc.claimant else "",
                        "status": oc.status,
                        "review_status": oc.review_status,
                        "verification_details_snippet": (oc.verification_details or "")[:120],
                        "created_at": oc.created_at,
                    })

        # History
        history = get_case_assignment_history(db, "CLAIM", claim.id)

        # Check recovery OTP if recovery was already spawned
        recovery = db.query(Recovery).filter(Recovery.claim_id == claim.id).first()
        has_active_otp = bool(recovery and recovery.otp_hash and not recovery.otp_verified_at)
        otp_attempts_left = max(0, 5 - (recovery.otp_attempts or 0)) if recovery else 5
        otp_verified_at = recovery.otp_verified_at if recovery else None

        return {
            "case_type": "CLAIM",
            "case_id": claim.id,
            "claim_id": claim.id,
            "recovery_id": recovery.id if recovery else None,
            "status": claim.status,
            "review_status": claim.review_status,
            "review_reason": claim.review_reason,
            "review_decision_notes": claim.review_decision_notes,
            "review_decision_at": claim.review_decision_at,
            "review_decision_by_name": claim.review_decider.full_name if claim.review_decider else None,
            "handover_method": claim.handover_method,
            "is_mandatory_review": claim.is_mandatory_review,
            "is_mandatory_otp": claim.is_mandatory_otp,
            "assigned_reviewer_id": claim.assigned_reviewer_id,
            "assigned_reviewer_name": claim.assigned_reviewer.full_name if claim.assigned_reviewer else None,
            "assigned_at": claim.assigned_at,
            "assignment_notes": claim.assignment_notes,
            "claimant": claimant_summary,
            "finder": finder_summary,
            "found_item": found_summary,
            "lost_item": lost_summary,
            "verification_details": claim.verification_details,
            "additional_message": claim.additional_message,
            "dispute_reason": None,
            "disputed_by_name": None,
            "disputed_at": None,
            "has_active_otp": has_active_otp,
            "otp_attempts_left": otp_attempts_left,
            "otp_verified_at": otp_verified_at,
            "competing_claims": competing_claims,
            "history": history,
        }

    elif case_norm == "RECOVERY":
        recovery = get_recovery_by_id(db, recovery_id=case_id)
        if not recovery:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recovery #{case_id} not found.",
            )

        if check_case_conflict(reviewer.id, recovery.claimant_id, recovery.finder_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conflict of interest: You cannot review a recovery where you are claimant or finder.",
            )

        is_admin = is_system_admin(reviewer)
        if recovery.assigned_reviewer_id and recovery.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This recovery is assigned to another reviewer. Only the assigned reviewer or an administrator may access it.",
            )

        found_summary = None
        if recovery.found_item:
            fi = recovery.found_item
            found_summary = {
                "id": fi.id,
                "title": fi.title,
                "category": fi.category,
                "description": fi.description,
                "location": fi.location,
                "campus": fi.campus,
                "found_date": str(fi.found_date) if fi.found_date else None,
                "found_time": fi.found_time,
                "image_url": fi.image_url,
                "status": fi.status,
            }

        lost_summary = None
        if recovery.lost_item:
            li = recovery.lost_item
            lost_summary = {
                "id": li.id,
                "title": li.title,
                "category": li.category,
                "description": li.description,
                "location": li.location,
                "campus": li.campus,
                "lost_date": str(li.lost_date) if li.lost_date else None,
                "lost_time": li.lost_time,
                "image_url": li.image_url,
                "status": li.status,
            }

        claimant_summary = None
        if recovery.claimant:
            cl = recovery.claimant
            claimant_summary = {
                "id": cl.id,
                "full_name": cl.full_name,
                "email": cl.email,
                "campus": cl.campus,
                "phone": cl.phone,
                "department": cl.department,
                "profile_image": cl.profile_image,
            }

        finder_summary = None
        if recovery.finder:
            fn = recovery.finder
            finder_summary = {
                "id": fn.id,
                "full_name": fn.full_name,
                "email": fn.email,
                "campus": fn.campus,
                "phone": fn.phone,
                "department": fn.department,
                "profile_image": fn.profile_image,
            }

        history = get_case_assignment_history(db, "RECOVERY", recovery.id)
        has_active_otp = bool(recovery.otp_hash and not recovery.otp_verified_at)

        return {
            "case_type": "RECOVERY",
            "case_id": recovery.id,
            "claim_id": recovery.claim_id,
            "recovery_id": recovery.id,
            "status": recovery.status,
            "review_status": recovery.review_status,
            "review_reason": recovery.review_reason,
            "review_decision_notes": recovery.review_decision_notes,
            "review_decision_at": recovery.review_decision_at,
            "review_decision_by_name": recovery.review_decider.full_name if recovery.review_decider else None,
            "handover_method": recovery.handover_method,
            "is_mandatory_review": recovery.is_mandatory_review,
            "is_mandatory_otp": recovery.is_mandatory_otp,
            "assigned_reviewer_id": recovery.assigned_reviewer_id,
            "assigned_reviewer_name": recovery.assigned_reviewer.full_name if recovery.assigned_reviewer else None,
            "assigned_at": recovery.assigned_at,
            "assignment_notes": recovery.assignment_notes,
            "claimant": claimant_summary,
            "finder": finder_summary,
            "found_item": found_summary,
            "lost_item": lost_summary,
            "verification_details": recovery.claim.verification_details if recovery.claim else None,
            "additional_message": recovery.claim.additional_message if recovery.claim else None,
            "dispute_reason": recovery.dispute_reason,
            "disputed_by_name": recovery.disputer.full_name if recovery.disputer else None,
            "disputed_at": recovery.disputed_at,
            "has_active_otp": has_active_otp,
            "otp_attempts_left": max(0, 5 - (recovery.otp_attempts or 0)),
            "otp_verified_at": recovery.otp_verified_at,
            "competing_claims": [],
            "history": history,
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown case type '{case_type}'. Expected CLAIM or RECOVERY.",
        )


# --- Reviewer Execution Actions ---

def start_review_on_case(
    db: Session,
    case_type: str,
    case_id: int,
    reviewer: User,
) -> Dict[str, Any]:
    """
    Transitions the case status to UNDER_REVIEW.
    Ensures that only the assigned reviewer or a system administrator can start review.
    """
    case_norm = case_type.strip().upper()
    is_admin = is_system_admin(reviewer)

    if case_norm == "CLAIM":
        claim = db.query(Claim).options(joinedload(Claim.found_item)).filter(Claim.id == case_id).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found.")

        finder_id = claim.found_item.user_id if claim.found_item else None
        if check_case_conflict(reviewer.id, claim.claimant_id, finder_id):
            raise HTTPException(status_code=403, detail="Conflict of interest.")

        if claim.assigned_reviewer_id and claim.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(status_code=403, detail="This case is assigned to another reviewer.")

        if claim.status in ("APPROVED", "REJECTED", "CANCELLED"):
            raise HTTPException(status_code=400, detail=f"Claim is already {claim.status}.")

        claim.status = "UNDER_REVIEW"
        claim.reviewed_by = reviewer.id
        db.commit()
        db.refresh(claim)
        return {"success": True, "case_id": claim.id, "status": claim.status}

    elif case_norm == "RECOVERY":
        recovery = db.query(Recovery).filter(Recovery.id == case_id).first()
        if not recovery:
            raise HTTPException(status_code=404, detail="Recovery not found.")

        if check_case_conflict(reviewer.id, recovery.claimant_id, recovery.finder_id):
            raise HTTPException(status_code=403, detail="Conflict of interest.")

        if recovery.assigned_reviewer_id and recovery.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(status_code=403, detail="This recovery is assigned to another reviewer.")

        # Recovery review is active
        return {"success": True, "case_id": recovery.id, "status": recovery.status, "review_status": recovery.review_status}

    raise HTTPException(status_code=400, detail="Invalid case type.")


def decide_case_review(
    db: Session,
    case_type: str,
    case_id: int,
    reviewer: User,
    action: str,
    rationale: str,
    handover_method: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes a formal review decision on an assigned case.
    Action: APPROVE or REJECT.
    Rationale is mandatory.
    Preserves invariant: Approval authorizes recovery, does NOT mark item handed over or recovered.
    """
    case_norm = case_type.strip().upper()
    action_norm = action.strip().upper()
    is_admin = is_system_admin(reviewer)

    if not rationale or len(rationale.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A substantive rationale / reviewer note is required.",
        )

    if case_norm == "CLAIM":
        claim = db.query(Claim).options(joinedload(Claim.found_item)).filter(Claim.id == case_id).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found.")

        finder_id = claim.found_item.user_id if claim.found_item else None
        if check_case_conflict(reviewer.id, claim.claimant_id, finder_id):
            raise HTTPException(status_code=403, detail="Conflict of interest.")

        # Privilege check: only assigned reviewer or admin
        if claim.assigned_reviewer_id and claim.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to decide this case. Only the assigned reviewer or a system administrator may decide it.",
            )

        decided_claim = review_claim(
            db=db,
            claim_id=case_id,
            reviewer=reviewer,
            action=action_norm,
            reviewer_notes=rationale.strip(),
            handover_method=handover_method,
        )

        return {
            "success": True,
            "case_type": "CLAIM",
            "case_id": decided_claim.id,
            "status": decided_claim.status,
            "review_status": decided_claim.review_status,
            "reviewed_by": reviewer.id,
            "reviewed_at": decided_claim.reviewed_at,
        }

    elif case_norm == "RECOVERY":
        recovery = db.query(Recovery).filter(Recovery.id == case_id).first()
        if not recovery:
            raise HTTPException(status_code=404, detail="Recovery not found.")

        if check_case_conflict(reviewer.id, recovery.claimant_id, recovery.finder_id):
            raise HTTPException(status_code=403, detail="Conflict of interest.")

        if recovery.assigned_reviewer_id and recovery.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to decide this recovery. Only the assigned reviewer or a system administrator may decide it.",
            )

        decided_rec = resolve_recovery_dispute(
            db=db,
            recovery_id=case_id,
            reviewer=reviewer,
            decision=action_norm,
            notes=rationale.strip(),
        )

        return {
            "success": True,
            "case_type": "RECOVERY",
            "case_id": decided_rec.id,
            "status": decided_rec.status,
            "review_status": decided_rec.review_status,
            "decision_by": reviewer.id,
            "decision_at": decided_rec.review_decision_at,
        }

    raise HTTPException(status_code=400, detail="Invalid case type.")


def return_case_for_reassignment(
    db: Session,
    case_type: str,
    case_id: int,
    reviewer: User,
    reason: str,
) -> Dict[str, Any]:
    """
    Reviewer returns an assigned case back to the unassigned pool (e.g. Due to conflict of interest
    discovered later, absence, or complexity requiring another reviewer).
    """
    case_norm = case_type.strip().upper()
    if not reason or len(reason.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A detailed reason for returning the case is required.",
        )

    is_admin = is_system_admin(reviewer)
    now = datetime.now(timezone.utc)

    if case_norm == "CLAIM":
        claim = db.query(Claim).filter(Claim.id == case_id).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found.")

        if claim.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(status_code=403, detail="You can only return cases assigned to you.")

        old_reviewer_id = claim.assigned_reviewer_id or reviewer.id
        claim.assigned_reviewer_id = None
        claim.assigned_at = None
        claim.status = "PENDING"
        claim.assignment_notes = f"Returned by Reviewer {reviewer.full_name}: {reason.strip()}"

        assignment_entry = ReviewerAssignment(
            case_type="CLAIM",
            case_id=claim.id,
            claim_id=claim.id,
            reviewer_id=old_reviewer_id,
            assigned_by_id=reviewer.id,
            assignment_action="RETURNED",
            notes=reason.strip(),
        )
        db.add(assignment_entry)
        db.commit()
        db.refresh(claim)

        return {
            "success": True,
            "message": "Claim successfully returned to unassigned pool for reassignment.",
            "case_id": claim.id,
            "status": claim.status,
        }

    elif case_norm == "RECOVERY":
        recovery = db.query(Recovery).filter(Recovery.id == case_id).first()
        if not recovery:
            raise HTTPException(status_code=404, detail="Recovery not found.")

        if recovery.assigned_reviewer_id != reviewer.id and not is_admin:
            raise HTTPException(status_code=403, detail="You can only return cases assigned to you.")

        old_reviewer_id = recovery.assigned_reviewer_id or reviewer.id
        recovery.assigned_reviewer_id = None
        recovery.assigned_at = None
        recovery.assignment_notes = f"Returned by Reviewer {reviewer.full_name}: {reason.strip()}"

        assignment_entry = ReviewerAssignment(
            case_type="RECOVERY",
            case_id=recovery.id,
            recovery_id=recovery.id,
            reviewer_id=old_reviewer_id,
            assigned_by_id=reviewer.id,
            assignment_action="RETURNED",
            notes=reason.strip(),
        )
        db.add(assignment_entry)
        db.commit()
        db.refresh(recovery)

        return {
            "success": True,
            "message": "Recovery successfully returned to unassigned pool for reassignment.",
            "case_id": recovery.id,
            "status": recovery.status,
        }

    raise HTTPException(status_code=400, detail="Invalid case type.")
