from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class MatchItemSummary(BaseModel):
    id: int
    title: str
    category: str
    location: str
    campus: Optional[str] = None
    date: str
    time: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    user_id: int

    class Config:
        from_attributes = True


class MatchSignals(BaseModel):
    category: int = Field(..., description="Category match score (0-25)")
    location: int = Field(..., description="Location match score (0-25)")
    date: int = Field(..., description="Date proximity score (0-20)")
    time: int = Field(..., description="Time proximity score (0-10)")
    description: int = Field(..., description="Text similarity score (0-20)")


class MatchResponse(BaseModel):
    id: int
    lost_item_id: int
    found_item_id: int
    score: int
    status: str
    signals: MatchSignals
    reasons: List[str]
    visual_score: Optional[int] = None
    visual_verdict: Optional[str] = None
    visual_confidence: Optional[float] = None
    visual_reasons: Optional[List[str]] = None
    lost_item: Optional[MatchItemSummary] = None
    found_item: Optional[MatchItemSummary] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MatchListResponse(BaseModel):
    matches: List[MatchResponse]
    total: int


class MatchStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if cleaned not in ("POSSIBLE", "REVIEWED", "REJECTED"):
            raise ValueError("Status must be one of: POSSIBLE, REVIEWED, REJECTED")
        return cleaned
