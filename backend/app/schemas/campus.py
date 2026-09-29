from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class CampusActivityItem(BaseModel):
    id: str
    icon: str
    title: str
    type: str  # "lost" or "found"
    location: str
    campus: Optional[str] = None
    category: Optional[str] = None
    timeAgo: str
    detail: Optional[str] = None
    created_at: Optional[datetime] = None
    image_url: Optional[str] = None
    raw_id: Optional[int] = None

    class Config:
        from_attributes = True


class ReconnectedItemResponse(BaseModel):
    id: str
    icon: str
    title: str
    lostLocation: str
    matchedLocation: str
    status: str
    date: str
    founder: str
    recovery_id: Optional[int] = None
    lost_item_id: Optional[int] = None
    found_item_id: Optional[int] = None

    class Config:
        from_attributes = True
