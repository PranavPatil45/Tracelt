from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class NotificationBase(BaseModel):
    type: str = Field(..., description="Notification type: MATCH_FOUND, CLAIM_SUBMITTED, CLAIM_APPROVED, CLAIM_REJECTED, CLAIM_CANCELLED, ITEM_RECOVERED")
    title: str = Field(..., max_length=255)
    message: str
    related_entity_type: Optional[str] = Field(None, max_length=50)
    related_entity_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class NotificationCreate(NotificationBase):
    user_id: int


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_extra_metadata(cls, data: Any) -> Any:
        if hasattr(data, "extra_metadata"):
            return {
                "id": data.id,
                "user_id": data.user_id,
                "type": data.type,
                "title": data.title,
                "message": data.message,
                "related_entity_type": data.related_entity_type,
                "related_entity_id": data.related_entity_id,
                "metadata": data.extra_metadata or {},
                "is_read": data.is_read,
                "read_at": data.read_at,
                "created_at": data.created_at,
            }
        return data

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    limit: int


class UnreadCountResponse(BaseModel):
    count: int


class MarkReadResponse(BaseModel):
    updated: int
