from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=True)
    campus = Column(String(255), default="Not Specified", nullable=False)
    department = Column(String(255), nullable=True)
    role = Column(String(50), default="student", nullable=False)
    phone = Column(String(50), nullable=True)
    bio = Column(String(500), nullable=True)
    profile_image = Column(String(500), nullable=True)
    google_sub = Column(String(255), unique=True, index=True, nullable=True)
    auth_provider = Column(String(50), default="email", nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    @property
    def has_usable_password(self) -> bool:
        if not self.hashed_password:
            return False
        return not self.hashed_password.startswith("!google_oauth_")

    @property
    def is_google_linked(self) -> bool:
        return bool(self.google_sub)

    # Relationships
    lost_items = relationship("LostItem", back_populates="user", cascade="all, delete-orphan")
    found_items = relationship("FoundItem", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"
