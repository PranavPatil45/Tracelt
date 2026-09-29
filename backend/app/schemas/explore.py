from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class ExploreItem(BaseModel):
    id: int
    type: str  # "LOST" or "FOUND"
    title: str
    category: str
    description: str
    location: str
    campus: Optional[str] = None
    date: str  # YYYY-MM-DD
    time: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_id: int

    class Config:
        from_attributes = True


class ExploreResponse(BaseModel):
    items: List[ExploreItem]
    total: int
    page: int
    limit: int
    pages: int
