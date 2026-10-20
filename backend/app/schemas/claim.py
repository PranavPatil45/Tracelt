from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ClaimCreate(BaseModel):
    verification_details: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Detailed identifying marks, contents, or proof demonstrating ownership.",
    )
    additional_message: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional additional message to the finder.",
    )
    preferred_handover_method: Optional[str] = Field(
        "DIRECT",
        description="Preferred handover verification method: DIRECT or OTP",
    )

    @field_validator("verification_details")
    @classmethod
    def validate_verification_details(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 10:
            raise ValueError("Verification details must be at least 10 characters long.")
        return cleaned

    @field_validator("additional_message")
    @classmethod
    def validate_additional_message(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None

    @field_validator("preferred_handover_method")
    @classmethod
    def validate_preferred_handover_method(cls, v: Optional[str]) -> str:
        if not v:
            return "DIRECT"
        cleaned = v.strip().upper()
        if cleaned not in ("DIRECT", "OTP"):
            raise ValueError("Preferred handover method must be DIRECT or OTP.")
        return cleaned


class ClaimReview(BaseModel):
    action: str = Field(..., description="Review action: APPROVE, REJECT, UNDER_REVIEW, REQUEST_REVIEW, or DISPUTE")
    reviewer_notes: Optional[str] = Field(None, max_length=1000, description="Optional notes or rejection rationale.")
    requires_reviewer: Optional[bool] = Field(False, description="Finder explicitly requests staff reviewer assistance.")
    handover_method: Optional[str] = Field("DIRECT", description="Handover method: DIRECT or OTP.")
    review_reason: Optional[str] = Field(None, description="Optional specific reason for reviewer intervention or dispute.")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if cleaned not in ("APPROVE", "REJECT", "UNDER_REVIEW", "REQUEST_REVIEW", "DISPUTE"):
            raise ValueError("Action must be APPROVE, REJECT, UNDER_REVIEW, REQUEST_REVIEW, or DISPUTE.")
        return cleaned

    @field_validator("reviewer_notes")
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None

    @field_validator("handover_method")
    @classmethod
    def validate_handover_method(cls, v: Optional[str]) -> str:
        if not v:
            return "DIRECT"
        cleaned = v.strip().upper()
        if cleaned not in ("DIRECT", "OTP"):
            raise ValueError("Handover method must be DIRECT or OTP.")
        return cleaned


class ClaimDisputeRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000, description="Reason for raising dispute.")


class ClaimUserSummary(BaseModel):
    id: int
    full_name: str
    campus: str

    class Config:
        from_attributes = True


class ClaimItemSummary(BaseModel):
    id: int
    title: str
    category: str
    location: str
    campus: Optional[str] = None
    date: str
    image_url: Optional[str] = None
    status: str
    user_id: int

    class Config:
        from_attributes = True


class DirectClaimCreate(ClaimCreate):
    found_item_id: Optional[int] = Field(None, description="ID of the found item to claim directly.")
    lost_item_id: Optional[int] = Field(None, description="Direct claims on lost items are explicitly rejected.")
    match_id: Optional[int] = Field(None, description="Optional match ID if claiming via match.")


class ClaimResponse(BaseModel):
    id: int
    match_id: Optional[int] = None
    found_item_id: Optional[int] = None
    claimant_id: int
    claimant: Optional[ClaimUserSummary] = None
    verification_details: str
    additional_message: Optional[str] = None
    status: str
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    lost_item: Optional[ClaimItemSummary] = None
    found_item: Optional[ClaimItemSummary] = None
    match_score: Optional[int] = None

    # Hybrid Reviewer Decision fields (Task 3)
    review_status: str = "NOT_REQUIRED"
    review_reason: Optional[str] = None
    review_decision_notes: Optional[str] = None
    review_decision_by: Optional[int] = None
    review_decision_at: Optional[datetime] = None
    handover_method: str = "DIRECT"
    is_mandatory_review: bool = False
    is_mandatory_otp: bool = False

    class Config:
        from_attributes = True


class ClaimListResponse(BaseModel):
    claims: List[ClaimResponse]
    total: int

