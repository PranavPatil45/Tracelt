from typing import Optional, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.report import Report
from app.core.deps import require_admin
from app.schemas.reviewer import (
    CaseAssignmentRequest,
    AutoAssignRequest,
)
from app.services.reviewer_service import (
    get_eligible_reviewers_with_workload,
    get_unassigned_cases,
    assign_claim,
    assign_recovery,
    auto_assign_unassigned_cases,
    get_case_assignment_history,
)

from app.schemas.admin import (
    AdminStatsResponse,
    AdminActivityResponse,
    AdminUserListResponse,
    AdminUserDetailResponse,
    AdminUserItem,
    AdminUserUpdate,
    AdminLostItemListResponse,
    AdminFoundItemListResponse,
    AdminItemStatusUpdate,
    AdminMatchListResponse,
    AdminMatchItem,
    AdminClaimListResponse,
    AdminClaimItem,
    AdminClaimReviewRequest,
    AdminDisputeResolveRequest,
    AdminRecoveryListResponse,
    AdminRecoveryItem,
    AdminReportListResponse,
    AdminReportItem,
    AdminReportCreate,
    AdminReportUpdate,
    AdminAuditLogListResponse,
)
from app.services.admin_service import (
    get_admin_stats,
    get_admin_activity,
    get_admin_users,
    get_admin_user_detail,
    update_admin_user,
    get_admin_lost_items,
    get_admin_found_items,
    update_item_status,
    get_admin_matches,
    get_admin_claims,
    get_admin_recoveries,
    get_admin_reports,
    update_admin_report,
    get_admin_audit_logs,
    log_admin_action,
)
from app.services.claim_service import review_claim
from app.services.recovery_service import resolve_recovery_dispute

router = APIRouter(prefix="/admin", tags=["Admin Management"])


def resolve_campus_scope(admin: User, query_campus: Optional[str] = None) -> Optional[str]:
    """
    Enforces campus data isolation.
    If the administrator belongs to a specific campus, they are constrained to that campus
    unless they are designated as a superadmin / global scope.
    """
    admin_campus = (admin.campus or "").strip()
    # Global scope if admin campus is 'ALL' or empty
    if not admin_campus or admin_campus.upper() == "ALL" or getattr(admin, "role", "").lower() == "superadmin":
        return query_campus
    return admin_campus


# --- Statistics ---
@router.get("/stats", response_model=AdminStatsResponse, summary="Retrieve admin dashboard statistics")
def get_stats(
    campus: Optional[str] = Query(None, description="Optional campus filter"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_stats(db=db, campus_scope=scope)


# --- Activity Feed ---
@router.get("/activity", response_model=AdminActivityResponse, summary="Retrieve normalized system activity feed")
def get_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    campus: Optional[str] = Query(None),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_activity(db=db, campus_scope=scope, page=page, limit=limit)


# --- User Management ---
@router.get("/users", response_model=AdminUserListResponse, summary="List users with search and filters")
def list_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role"),
    campus: Optional[str] = Query(None, description="Filter by campus"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_users(
        db=db,
        campus_scope=scope,
        search=search,
        role=role,
        is_active=is_active,
        page=page,
        limit=limit,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse, summary="Get user profile and activity counts")
def get_user_details(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    return get_admin_user_detail(db=db, user_id=user_id)


@router.patch("/users/{user_id}", response_model=AdminUserItem, summary="Update user role or active status")
def update_user(
    user_id: int,
    update_data: AdminUserUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    return update_admin_user(
        db=db,
        user_id=user_id,
        current_admin=current_admin,
        update_data=update_data,
    )


# --- Lost Items Moderation ---
@router.get("/lost-items", response_model=AdminLostItemListResponse, summary="List lost items for moderation")
def list_lost_items(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    campus: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_lost_items(
        db=db,
        campus_scope=scope,
        search=search,
        category=category,
        status_filter=status,
        page=page,
        limit=limit,
    )


# --- Found Items Moderation ---
@router.get("/found-items", response_model=AdminFoundItemListResponse, summary="List found items for moderation")
def list_found_items(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    campus: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_found_items(
        db=db,
        campus_scope=scope,
        search=search,
        category=category,
        status_filter=status,
        page=page,
        limit=limit,
    )


# --- Moderation Status Update ---
@router.patch("/items/{item_type}/{item_id}/status", summary="Moderate item status (Hide, Close, Remove)")
def moderate_item_status(
    item_type: str,
    item_id: int,
    status_update: AdminItemStatusUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    return update_item_status(
        db=db,
        item_type=item_type,
        item_id=item_id,
        current_admin=current_admin,
        new_status=status_update.status,
        reason=status_update.reason,
    )


# --- Matches Monitoring ---
@router.get("/matches", response_model=AdminMatchListResponse, summary="List matches with scores")
def list_matches(
    status: Optional[str] = Query(None),
    campus: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_matches(db=db, campus_scope=scope, status_filter=status, page=page, limit=limit)


# --- Claims Management ---
@router.get("/claims", response_model=AdminClaimListResponse, summary="List claims with verification data")
def list_claims(
    status: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None, description="Filter by review status (PENDING, APPROVED, DISPUTED, NOT_REQUIRED)"),
    campus: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_claims(
        db=db,
        campus_scope=scope,
        status_filter=status,
        review_status_filter=review_status,
        page=page,
        limit=limit,
    )


@router.post("/claims/{claim_id}/review", summary="Admin review or intervention on an ownership claim")
def review_claim_admin(
    claim_id: int,
    req: AdminClaimReviewRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    # Reuses existing atomic claim_service logic with conflict-of-interest checks
    claim = review_claim(
        db=db,
        claim_id=claim_id,
        reviewer=current_admin,
        action=req.action,
        reviewer_notes=req.reviewer_notes or "Reviewer intervention",
    )
    # Log action
    log_admin_action(
        db=db,
        admin_id=current_admin.id,
        action=f"CLAIM_{req.action.upper()}",
        entity_type="claim",
        entity_id=claim.id,
        details=f"Reviewer {current_admin.full_name} set status to {claim.status}. Review status: {claim.review_status}. Notes: {req.reviewer_notes or 'None'}",
    )
    return {
        "success": True,
        "claim_id": claim.id,
        "status": claim.status,
        "review_status": claim.review_status,
        "reviewed_by": current_admin.id,
        "reviewed_at": claim.reviewed_at,
    }


# --- Recoveries Monitoring ---
@router.get("/recoveries", response_model=AdminRecoveryListResponse, summary="List recovery tracking records")
def list_recoveries(
    status: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None, description="Filter by review status"),
    campus: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_admin_recoveries(
        db=db,
        campus_scope=scope,
        status_filter=status,
        review_status_filter=review_status,
        page=page,
        limit=limit,
    )


@router.post("/recoveries/{recovery_id}/resolve-dispute", summary="Resolve a disputed recovery")
def resolve_recovery_dispute_admin(
    recovery_id: int,
    req: AdminDisputeResolveRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    """
    Staff reviewer resolves a dispute raised on a recovery.
    Decision APPROVE unblocks recovery. Decision REJECT cancels recovery and reopens found item.
    """
    recovery = resolve_recovery_dispute(
        db=db,
        recovery_id=recovery_id,
        reviewer=current_admin,
        decision=req.decision,
        notes=req.notes,
    )
    log_admin_action(
        db=db,
        admin_id=current_admin.id,
        action=f"DISPUTE_RESOLVED_{req.decision.upper()}",
        entity_type="recovery",
        entity_id=recovery.id,
        details=f"Reviewer {current_admin.full_name} resolved dispute: {req.decision}. Notes: {req.notes or 'None'}",
    )
    return {
        "success": True,
        "recovery_id": recovery.id,
        "status": recovery.status,
        "review_status": recovery.review_status,
        "decision": req.decision,
        "notes": req.notes,
    }


# --- Reports & Moderation ---
@router.get("/reports", response_model=AdminReportListResponse, summary="List moderation reports")
def list_reports(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    return get_admin_reports(db=db, status_filter=status, page=page, limit=limit)


@router.post("/reports", response_model=AdminReportItem, summary="Submit a moderation report")
def create_report(
    report_in: AdminReportCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    rep = Report(
        reporter_id=current_user.id,
        entity_type=report_in.entity_type,
        entity_id=report_in.entity_id,
        reason=report_in.reason,
        description=report_in.description,
        status="PENDING",
    )
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return AdminReportItem(
        id=rep.id,
        reporter_id=rep.reporter_id,
        reporter_name=current_user.full_name,
        entity_type=rep.entity_type,
        entity_id=rep.entity_id,
        reason=rep.reason,
        description=rep.description,
        status=rep.status,
        reviewed_by_name=None,
        reviewed_at=None,
        admin_notes=None,
        created_at=rep.created_at,
    )


@router.patch("/reports/{report_id}", response_model=AdminReportItem, summary="Resolve or dismiss a moderation report")
def resolve_report(
    report_id: int,
    update_data: AdminReportUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    return update_admin_report(
        db=db,
        report_id=report_id,
        current_admin=current_admin,
        status_update=update_data.status,
        admin_notes=update_data.admin_notes,
    )


# --- Audit Logs ---
@router.get("/audit-logs", response_model=AdminAuditLogListResponse, summary="List administrator action audit logs")
def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    return get_admin_audit_logs(db=db, page=page, limit=limit)


# --- Reviewer Assignment & Workload Management ---

@router.get("/reviewers", summary="List eligible reviewers and their active workloads")
def list_eligible_reviewers(
    campus: Optional[str] = Query(None, description="Optional campus filter"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    reviewers = get_eligible_reviewers_with_workload(db=db, campus_scope=scope)
    return {"reviewers": reviewers, "total": len(reviewers)}


@router.get("/assignments/unassigned", summary="List unassigned cases requiring reviewer intervention")
def list_unassigned_cases(
    campus: Optional[str] = Query(None, description="Optional campus filter"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    scope = resolve_campus_scope(current_admin, campus)
    return get_unassigned_cases(db=db, campus_scope=scope)


@router.post("/claims/{claim_id}/assign", summary="Assign or unassign a reviewer to a claim")
def assign_claim_reviewer(
    claim_id: int,
    req: CaseAssignmentRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    claim = assign_claim(
        db=db,
        claim_id=claim_id,
        reviewer_id=req.reviewer_id,
        assigned_by=current_admin,
        notes=req.notes,
    )
    action_name = "ASSIGNED" if req.reviewer_id else "UNASSIGNED"
    log_admin_action(
        db=db,
        admin_id=current_admin.id,
        action=f"CLAIM_REVIEWER_{action_name}",
        entity_type="claim",
        entity_id=claim.id,
        details=f"Admin {current_admin.full_name} set assigned reviewer to {req.reviewer_id}. Notes: {req.notes or 'None'}",
    )
    return {
        "success": True,
        "claim_id": claim.id,
        "assigned_reviewer_id": claim.assigned_reviewer_id,
        "assigned_at": claim.assigned_at,
    }


@router.post("/recoveries/{recovery_id}/assign", summary="Assign or unassign a reviewer to a recovery")
def assign_recovery_reviewer(
    recovery_id: int,
    req: CaseAssignmentRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    recovery = assign_recovery(
        db=db,
        recovery_id=recovery_id,
        reviewer_id=req.reviewer_id,
        assigned_by=current_admin,
        notes=req.notes,
    )
    action_name = "ASSIGNED" if req.reviewer_id else "UNASSIGNED"
    log_admin_action(
        db=db,
        admin_id=current_admin.id,
        action=f"RECOVERY_REVIEWER_{action_name}",
        entity_type="recovery",
        entity_id=recovery.id,
        details=f"Admin {current_admin.full_name} set assigned reviewer to {req.reviewer_id}. Notes: {req.notes or 'None'}",
    )
    return {
        "success": True,
        "recovery_id": recovery.id,
        "assigned_reviewer_id": recovery.assigned_reviewer_id,
        "assigned_at": recovery.assigned_at,
    }


@router.post("/assignments/auto-assign", summary="Auto-assign unassigned cases to least-loaded conflict-free reviewers")
def auto_assign_cases(
    req: Optional[AutoAssignRequest] = None,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    campus_filter = req.campus if req else None
    scope = resolve_campus_scope(current_admin, campus_filter)
    result = auto_assign_unassigned_cases(
        db=db,
        campus_scope=scope,
        assigned_by=current_admin,
    )
    log_admin_action(
        db=db,
        admin_id=current_admin.id,
        action="AUTO_ASSIGN_REVIEWERS",
        entity_type="batch",
        entity_id=0,
        details=f"Admin {current_admin.full_name} auto-assigned {result['assigned_count']} cases.",
    )
    return result


@router.get("/assignments/history/{case_type}/{case_id}", summary="Get reviewer assignment audit trail for a case")
def get_assignment_history(
    case_type: str,
    case_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Any:
    history = get_case_assignment_history(db=db, case_type=case_type, case_id=case_id)
    return {"history": history, "total": len(history)}
