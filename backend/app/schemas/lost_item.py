from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, field_validator


class LostItemBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Name or title of the lost item")
    category: str = Field(..., min_length=2, max_length=100, description="Item category")
    description: str = Field(..., min_length=5, description="Detailed description of features and markings")
    location: str = Field(..., min_length=2, max_length=255, description="Campus location where item was last seen")
    lost_date: str = Field(..., description="Date item was lost in YYYY-MM-DD format")
    lost_time: Optional[str] = Field(None, max_length=50, description="Approximate time item was lost")
    image_url: Optional[str] = Field(None, max_length=500, description="URL or relative path to the uploaded image")


class LostItemCreate(LostItemBase):
    @field_validator("title", "category", "location")
    @classmethod
    def strip_and_validate_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty or only whitespace")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Description must be at least 5 characters long and cannot be only whitespace")
        return cleaned

    @field_validator("lost_date")
    @classmethod
    def validate_lost_date(cls, v: str) -> str:
        try:
            parsed_date = datetime.strptime(v.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("lost_date must be formatted as YYYY-MM-DD")
        if parsed_date > date.today():
            raise ValueError("lost_date cannot be in the future")
        return v.strip()


class LostItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, min_length=5)
    location: Optional[str] = Field(None, min_length=2, max_length=255)
    lost_date: Optional[str] = None
    lost_time: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = Field(None, description="ACTIVE, MATCHED, CLAIMED, RECOVERED, CLOSED")

    @field_validator("description")
    @classmethod
    def validate_optional_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 5:
                raise ValueError("Description must be at least 5 characters long")
            return cleaned
        return v

    @field_validator("lost_date")
    @classmethod
    def validate_optional_lost_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                parsed_date = datetime.strptime(v.strip(), "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("lost_date must be formatted as YYYY-MM-DD")
            if parsed_date > date.today():
                raise ValueError("lost_date cannot be in the future")
            return v.strip()
        return v


class LostItemResponse(LostItemBase):
    id: int
    user_id: int
    campus: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LostItemListResponse(BaseModel):
    items: List[LostItemResponse]
    total: int
