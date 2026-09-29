from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel
from app.schemas.message import MessageResponse


class ParticipantSummary(BaseModel):
    id: int
    full_name: str
    campus: str
    role: str  # "Claimant" or "Finder"


class ConversationItemSummary(BaseModel):
    id: int
    title: str
    category: str
    location: str
    status: str
    image_url: Optional[str] = None
    item_type: str  # "LOST" or "FOUND"


class ConversationSummary(BaseModel):
    id: int
    claim_id: int
    match_id: int
    claim_status: str
    item: Optional[ConversationItemSummary] = None
    other_participant: Optional[ParticipantSummary] = None
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    is_closed: bool = False
    close_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationSummary]
    total: int
    unread_total: int


class ConversationDetailResponse(BaseModel):
    id: int
    claim_id: int
    match_id: int
    claim_status: str
    item: Optional[ConversationItemSummary] = None
    other_participant: Optional[ParticipantSummary] = None
    lost_item: Optional[Dict[str, Any]] = None
    found_item: Optional[Dict[str, Any]] = None
    is_closed: bool = False
    close_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[MessageResponse] = []


class UnreadMessagesCountResponse(BaseModel):
    count: int


class MarkReadResponse(BaseModel):
    success: bool
    marked_count: int
