from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, computed_field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    campus: str = Field(..., min_length=1, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field("student", max_length=50)


class UserRegister(UserBase):
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    remember: Optional[bool] = False


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    campus: Optional[str] = Field(None, min_length=1, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    profile_image: Optional[str] = Field(None, max_length=500)


class UserOut(UserBase):
    id: int
    role: str = "student"
    phone: Optional[str] = None
    bio: Optional[str] = None
    profile_image: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    @computed_field
    @property
    def name(self) -> str:
        return self.full_name

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


class UserDashboardStats(BaseModel):
    lost_items: int = 0
    found_items: int = 0
    matches: int = 0
    claims: int = 0
    recovered: int = 0
    unread_messages: int = 0
    unread_notifications: int = 0
