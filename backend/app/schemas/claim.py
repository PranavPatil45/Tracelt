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


class ClaimReview(BaseModel):
    action: str = Field(..., description="Review action: APPROVE, REJECT, or UNDER_REVIEW")
    reviewer_notes: Optional[str] = Field(None, max_length=1000, description="Optional notes or rejection rationale.")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if cleaned not in ("APPROVE", "REJECT", "UNDER_REVIEW"):
            raise ValueError("Action must be APPROVE, REJECT, or UNDER_REVIEW.")
        return cleaned

    @field_validator("reviewer_notes")
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None


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


class ClaimResponse(BaseModel):
    id: int
    match_id: int
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

    class Config:
        from_attributes = True


class ClaimListResponse(BaseModel):
    claims: List[ClaimResponse]
    total: int
