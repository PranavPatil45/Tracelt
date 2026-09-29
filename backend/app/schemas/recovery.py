from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class RecoveryReturnRequest(BaseModel):
    return_location: str = Field(..., max_length=255, description="Location where item was returned")
    return_notes: Optional[str] = Field(None, max_length=1000, description="Optional handover notes")

    @field_validator("return_location")
    @classmethod
    def validate_return_location(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Return location cannot be blank or empty.")
        if len(trimmed) > 255:
            raise ValueError("Return location cannot exceed 255 characters.")
        return trimmed

    @field_validator("return_notes")
    @classmethod
    def validate_return_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        if len(trimmed) > 1000:
            raise ValueError("Return notes cannot exceed 1000 characters.")
        return trimmed or None


class TimelineStep(BaseModel):
    key: str
    title: str
    status: str  # "completed" | "current" | "upcoming"
    timestamp: Optional[datetime] = None
    description: Optional[str] = None


class RecoveryParticipantSummary(BaseModel):
    id: int
    full_name: str
    campus: str
    role: str  # "Claimant" or "Finder"


class RecoveryItemSummary(BaseModel):
    id: int
    title: str
    category: str
    location: str
    date: str
    time: Optional[str] = None
    description: str
    image_url: Optional[str] = None
    status: str


class RecoveryResponse(BaseModel):
    id: int
    claim_id: int
    match_id: int
    status: str  # RETURN_PENDING, RETURNED, RECOVERED, CANCELLED
    return_location: Optional[str] = None
    return_notes: Optional[str] = None
    returned_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    lost_item: Optional[RecoveryItemSummary] = None
    found_item: Optional[RecoveryItemSummary] = None
    claimant: Optional[RecoveryParticipantSummary] = None
    finder: Optional[RecoveryParticipantSummary] = None
    conversation_id: Optional[int] = None
    can_mark_returned: bool = False
    can_confirm_recovery: bool = False
    timeline: List[TimelineStep] = []

    class Config:
        from_attributes = True


class HistoryItem(BaseModel):
    id: int
    type: str  # "LOST" or "FOUND"
    title: str
    category: str
    location: str
    status: str
    date: str
    image_url: Optional[str] = None
    recovery_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    return_location: Optional[str] = None
    user_role: Optional[str] = None


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    total: int
    page: int
    limit: int
    counts: Dict[str, int] = {}


class HistoryStatsResponse(BaseModel):
    recovered_count: int
    returned_count: int
    pending_action_count: int
