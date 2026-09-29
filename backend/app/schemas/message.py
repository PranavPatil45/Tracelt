from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class MessageCreate(BaseModel):
    content: str = Field(..., description="Message text content")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v:
            raise ValueError("Message content cannot be empty.")
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message content cannot be blank or only whitespace.")
        if len(trimmed) > 2000:
            raise ValueError("Message content cannot exceed 2000 characters.")
        return trimmed


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: Optional[str] = None
    content: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    is_current_user: Optional[bool] = False

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    items: List[MessageResponse]
    total: int
    page: int
    limit: int
