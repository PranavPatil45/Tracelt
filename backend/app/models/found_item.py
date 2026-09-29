from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class FoundItem(Base):
    __tablename__ = "found_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=False, index=True)
    campus = Column(String(255), nullable=True)
    found_date = Column(String(50), nullable=False)  # ISO date string: YYYY-MM-DD
    found_time = Column(String(50), nullable=True)   # Approximate time string: HH:MM or textual
    image_url = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="AVAILABLE", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationship to user
    user = relationship("User", back_populates="found_items")

    def __repr__(self):
        return f"<FoundItem {self.id}: {self.title} ({self.status})>"
