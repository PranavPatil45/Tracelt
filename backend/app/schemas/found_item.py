from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, field_validator


class FoundItemBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Name or title of the found item")
    category: str = Field(..., min_length=2, max_length=100, description="Item category")
    description: str = Field(..., min_length=5, description="Detailed description of features, markings, or condition")
    location: str = Field(..., min_length=2, max_length=255, description="Campus location where item was found")
    found_date: str = Field(..., description="Date item was found in YYYY-MM-DD format")
    found_time: Optional[str] = Field(None, max_length=50, description="Approximate time item was found")
    image_url: Optional[str] = Field(None, max_length=500, description="URL or relative path to the uploaded image")


class FoundItemCreate(FoundItemBase):
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

    @field_validator("found_date")
    @classmethod
    def validate_found_date(cls, v: str) -> str:
        try:
            parsed_date = datetime.strptime(v.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("found_date must be formatted as YYYY-MM-DD")
        if parsed_date > date.today():
            raise ValueError("found_date cannot be in the future")
        return v.strip()


class FoundItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, min_length=5)
    location: Optional[str] = Field(None, min_length=2, max_length=255)
    found_date: Optional[str] = None
    found_time: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = Field(None, description="AVAILABLE, MATCHED, CLAIMED, RETURNED, CLOSED")

    @field_validator("description")
    @classmethod
    def validate_optional_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 5:
                raise ValueError("Description must be at least 5 characters long")
            return cleaned
        return v

    @field_validator("found_date")
    @classmethod
    def validate_optional_found_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                parsed_date = datetime.strptime(v.strip(), "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("found_date must be formatted as YYYY-MM-DD")
            if parsed_date > date.today():
                raise ValueError("found_date cannot be in the future")
            return v.strip()
        return v


class FoundItemResponse(FoundItemBase):
    id: int
    user_id: int
    campus: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FoundItemListResponse(BaseModel):
    items: List[FoundItemResponse]
    total: int
