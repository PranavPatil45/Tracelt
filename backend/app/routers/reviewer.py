from typing import Optional, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.deps import require_reviewer_or_admin
from app.schemas.reviewer import (
    ReviewerDashboardStats,
    ReviewerCaseListResponse,
    ReviewerCaseDetail,
    ReviewerDecisionRequest,
    ReviewerReturnCaseRequest,
)
from app.services.reviewer_service import (
    get_reviewer_dashboard_stats,
    get_reviewer_cases,
    get_case_review_details,
    start_review_on_case,
    decide_case_review,
    return_case_for_reassignment,
)

router = APIRouter(prefix="/reviewer", tags=["Reviewer Portal"])


@router.get("/stats", response_model=ReviewerDashboardStats, summary="Reviewer dashboard metrics")
def get_dashboard_stats(
    current_reviewer: User = Depends(require_reviewer_or_admin),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieve personalized metrics and urgent cases for the logged-in reviewer."""
    return get_reviewer_dashboard_stats(db=db, reviewer=current_reviewer)


@router.get("/cases", response_model=ReviewerCaseListResponse, summary="Assigned cases queue with filters")
def list_reviewer_cases(
    case_type: str = Query("ALL", description="Filter by case type: ALL, CLAIM, RECOVERY"),
    status: str = Query("ALL", description="Filter by status: ALL, PENDING, UNDER_REVIEW, APPROVED, REJECTED, DISPUTED"),
    search: Optional[str] = Query(None, description="Search by item title, claimant name, or ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_reviewer: User = Depends(require_reviewer_or_admin),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieve the paginated queue of cases assigned to the authenticated reviewer."""
    return get_reviewer_cases(
        db=db,
        reviewer=current_reviewer,
        case_type_filter=case_type,
        status_filter=status,
        search=search,
        page=page,
        limit=limit,
    )


@router.get("/cases/{case_type}/{case_id}", response_model=ReviewerCaseDetail, summary="Case review workspace details")
def get_case_detail(
    case_type: str,
    case_id: int,
    current_reviewer: User = Depends(require_reviewer_or_admin),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieve full details of an assigned case including evidence, items, parties, and history."""
    return get_case_review_details(
        db=db,
        case_type=case_type,
        case_id=case_id,
        reviewer=current_reviewer,
    )


@router.post("/cases/{case_type}/{case_id}/start-review", summary="Start review on an assigned case")
def start_case_review(
    case_type: str,
    case_id: int,
    current_reviewer: User = Depends(require_reviewer_or_admin),
    db: Session = Depends(get_db),
) -> Any:
    """Mark an assigned case as UNDER_REVIEW."""
    return start_review_on_case(
        db=db,
        case_type=case_type,
        case_id=case_id,
        reviewer=current_reviewer,
    )


@router.post("/cases/{case_type}/{case_id}/decide", summary="Submit review decision on an assigned case")
def decide_case(
    case_type: str,
    case_id: int,
    req: ReviewerDecisionRequest,
    current_reviewer: User = Depends(require_reviewer_or_admin),
    db: Session = Depends(get_db),
) -> Any:
    """
    Submit decision (APPROVE or REJECT) with mandatory rationale.
    Approval authorizes recovery without prematurely completing physical handover.
    """
    return decide_case_review(
        db=db,
        case_type=case_type,
        case_id=case_id,
        reviewer=current_reviewer,
        action=req.action,
        rationale=req.rationale,
        handover_method=req.handover_method,
    )


@router.post("/cases/{case_type}/{case_id}/return-reassign", summary="Return case for reassignment")
def return_case(
    case_type: str,
    case_id: int,
    req: ReviewerReturnCaseRequest,
    current_reviewer: User = Depends(require_reviewer_or_admin),
    db: Session = Depends(get_db),
) -> Any:
    """
    Return an assigned case back to the unassigned queue if a conflict of interest
    is discovered or the reviewer is unable to complete the review.
    """
    return return_case_for_reassignment(
        db=db,
        case_type=case_type,
        case_id=case_id,
        reviewer=current_reviewer,
        reason=req.reason,
    )
