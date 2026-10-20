from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# --- Reviewer Workload & Admin Assignment ---

class ReviewerWorkloadItem(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    campus: str
    department: Optional[str] = None
    active_assigned_count: int
    pending_count: int
    under_review_count: int
    resolved_count: int
    last_assigned_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EligibleReviewersResponse(BaseModel):
    reviewers: List[ReviewerWorkloadItem]
    total: int


class CaseAssignmentRequest(BaseModel):
    reviewer_id: Optional[int] = Field(None, description="Reviewer ID to assign, or null to unassign")
    notes: Optional[str] = Field(None, description="Assignment rationale or instructions")


class AutoAssignRequest(BaseModel):
    campus: Optional[str] = Field(None, description="Optional campus filter for auto-assignment")


class AutoAssignResponse(BaseModel):
    success: bool
    assigned_count: int
    message: str
    assignments: List[Dict[str, Any]] = []


class AssignmentHistoryItem(BaseModel):
    id: int
    case_type: str
    case_id: int
    reviewer_id: int
    reviewer_name: str
    assigned_by_id: Optional[int] = None
    assigned_by_name: Optional[str] = None
    action: str
    notes: Optional[str] = None
    created_at: datetime


# --- Reviewer Portal Dashboard & Cases ---

class ReviewerDashboardStats(BaseModel):
    assigned_total: int
    pending_review: int
    under_review: int
    disputes_count: int
    completed_count: int
    urgent_cases: List[Dict[str, Any]] = []


class ReviewerCaseSummary(BaseModel):
    case_type: str  # "CLAIM" or "RECOVERY"
    case_id: int
    claim_id: Optional[int] = None
    recovery_id: Optional[int] = None
    status: str
    review_status: str
    review_reason: Optional[str] = None
    item_title: str
    item_category: str
    item_image: Optional[str] = None
    claimant_id: int
    claimant_name: str
    finder_id: Optional[int] = None
    finder_name: Optional[str] = None
    assigned_reviewer_id: Optional[int] = None
    assigned_reviewer_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    created_at: datetime
    is_urgent: bool = False
    is_competing: bool = False


class ReviewerCaseListResponse(BaseModel):
    cases: List[ReviewerCaseSummary]
    total: int
    page: int
    limit: int


class CompetingClaimSummary(BaseModel):
    id: int
    claimant_id: int
    claimant_name: str
    claimant_email: str
    status: str
    review_status: str
    verification_details_snippet: str
    created_at: datetime


class ReviewerCaseDetail(BaseModel):
    case_type: str
    case_id: int
    claim_id: Optional[int] = None
    recovery_id: Optional[int] = None
    status: str
    review_status: str
    review_reason: Optional[str] = None
    review_decision_notes: Optional[str] = None
    review_decision_at: Optional[datetime] = None
    review_decision_by_name: Optional[str] = None
    handover_method: str = "DIRECT"
    is_mandatory_review: bool = False
    is_mandatory_otp: bool = False
    assigned_reviewer_id: Optional[int] = None
    assigned_reviewer_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    assignment_notes: Optional[str] = None

    claimant: Optional[Dict[str, Any]] = None
    finder: Optional[Dict[str, Any]] = None
    found_item: Optional[Dict[str, Any]] = None
    lost_item: Optional[Dict[str, Any]] = None

    verification_details: Optional[str] = None
    additional_message: Optional[str] = None

    # Dispute information (for recoveries)
    dispute_reason: Optional[str] = None
    disputed_by_name: Optional[str] = None
    disputed_at: Optional[datetime] = None

    # Handover OTP info (SAFE: Never plaintext OTP)
    has_active_otp: bool = False
    otp_attempts_left: int = 5
    otp_verified_at: Optional[datetime] = None

    competing_claims: List[CompetingClaimSummary] = []
    history: List[AssignmentHistoryItem] = []


# --- Reviewer Action Requests ---

class ReviewerDecisionRequest(BaseModel):
    action: str = Field(..., description="APPROVE or REJECT")
    rationale: str = Field(..., min_length=3, description="Mandatory decision rationale or review notes")
    handover_method: Optional[str] = Field(None, description="Optional handover method override: DIRECT or OTP")


class ReviewerReturnCaseRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Mandatory reason for returning case for reassignment")


class ReviewerDisputeResolveRequest(BaseModel):
    decision: str = Field(..., description="APPROVE or REJECT")
    rationale: str = Field(..., min_length=3, description="Mandatory dispute resolution notes")
