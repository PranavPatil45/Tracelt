from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# --- Stats & Overview ---
class CategoryCount(BaseModel):
    category: str
    count: int


class LocationCount(BaseModel):
    location: str
    count: int


class AdminStatsResponse(BaseModel):
    total_users: int
    total_lost_items: int
    total_found_items: int
    active_matches: int
    pending_claims: int
    recovered_items: int
    active_reports: int
    recovery_rate: float
    top_categories: List[CategoryCount] = []
    top_locations: List[LocationCount] = []
    campus_scope: str


# --- Activity Feed ---
class AdminActivityItem(BaseModel):
    id: str
    type: str  # LOST_ITEM_CREATED, FOUND_ITEM_CREATED, MATCH_CREATED, CLAIM_SUBMITTED, CLAIM_APPROVED, etc.
    title: str
    description: str
    created_at: datetime
    related_entity_type: str
    related_entity_id: int
    user_name: Optional[str] = None
    campus: Optional[str] = None


class AdminActivityResponse(BaseModel):
    items: List[AdminActivityItem]
    total: int
    page: int
    limit: int


# --- User Management ---
class AdminUserItem(BaseModel):
    id: int
    email: str
    full_name: str
    campus: str
    department: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    users: List[AdminUserItem]
    total: int
    page: int
    limit: int


class AdminUserDetailResponse(AdminUserItem):
    lost_items_count: int
    found_items_count: int
    claims_count: int
    recoveries_count: int


class AdminUserUpdate(BaseModel):
    role: Optional[str] = Field(None, description="Role: student, contributor, reviewer, admin")
    is_active: Optional[bool] = Field(None, description="Active status")


# --- Items Management ---
class AdminLostItemSummary(BaseModel):
    id: int
    title: str
    category: str
    location: str
    campus: Optional[str] = None
    lost_date: str
    lost_time: Optional[str] = None
    status: str
    image_url: Optional[str] = None
    user_id: int
    user_name: str
    user_email: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminFoundItemSummary(BaseModel):
    id: int
    title: str
    category: str
    location: str
    campus: Optional[str] = None
    found_date: str
    found_time: Optional[str] = None
    status: str
    image_url: Optional[str] = None
    user_id: int
    user_name: str
    user_email: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminLostItemListResponse(BaseModel):
    items: List[AdminLostItemSummary]
    total: int
    page: int
    limit: int


class AdminFoundItemListResponse(BaseModel):
    items: List[AdminFoundItemSummary]
    total: int
    page: int
    limit: int


class AdminItemStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: ACTIVE, AVAILABLE, MATCHED, CLAIMED, RECOVERED, CLOSED, HIDDEN, REMOVED")
    reason: Optional[str] = None


# --- Matches Management ---
class AdminMatchItem(BaseModel):
    id: int
    lost_item_id: int
    lost_item_title: str
    lost_item_category: str
    found_item_id: int
    found_item_title: str
    found_item_category: str
    total_score: int
    category_score: int
    location_score: int
    date_score: int
    time_score: int
    description_score: int
    reasons: List[str]
    status: str
    created_at: datetime


class AdminMatchListResponse(BaseModel):
    matches: List[AdminMatchItem]
    total: int
    page: int
    limit: int


# --- Claims Management ---
class AdminClaimItem(BaseModel):
    id: int
    match_id: int
    claimant_id: int
    claimant_name: str
    claimant_email: str
    finder_id: Optional[int] = None
    finder_name: Optional[str] = None
    lost_item_id: int
    lost_item_title: str
    found_item_id: int
    found_item_title: str
    verification_details: str
    additional_message: Optional[str] = None
    status: str
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None
    created_at: datetime


class AdminClaimListResponse(BaseModel):
    claims: List[AdminClaimItem]
    total: int
    page: int
    limit: int


class AdminClaimReviewRequest(BaseModel):
    action: str = Field(..., description="APPROVE or REJECT")
    reviewer_notes: Optional[str] = None


# --- Recoveries Management ---
class AdminRecoveryItem(BaseModel):
    id: int
    claim_id: int
    lost_item_id: int
    lost_item_title: str
    found_item_id: int
    found_item_title: str
    claimant_id: int
    claimant_name: str
    finder_id: int
    finder_name: str
    status: str
    return_location: Optional[str] = None
    return_notes: Optional[str] = None
    returned_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime


class AdminRecoveryListResponse(BaseModel):
    recoveries: List[AdminRecoveryItem]
    total: int
    page: int
    limit: int


# --- Moderation Reports ---
class AdminReportCreate(BaseModel):
    entity_type: str = Field(..., description="lost_item, found_item, user, claim, message")
    entity_id: int
    reason: str
    description: Optional[str] = None


class AdminReportItem(BaseModel):
    id: int
    reporter_id: int
    reporter_name: str
    entity_type: str
    entity_id: int
    reason: str
    description: Optional[str] = None
    status: str
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None
    created_at: datetime


class AdminReportListResponse(BaseModel):
    reports: List[AdminReportItem]
    total: int
    page: int
    limit: int


class AdminReportUpdate(BaseModel):
    status: str = Field(..., description="REVIEWED, RESOLVED, DISMISSED")
    admin_notes: Optional[str] = None


# --- Audit Logs ---
class AdminAuditLogItem(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime


class AdminAuditLogListResponse(BaseModel):
    logs: List[AdminAuditLogItem]
    total: int
    page: int
    limit: int
