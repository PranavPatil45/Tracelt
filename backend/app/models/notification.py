from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Event Type: MATCH_FOUND, CLAIM_SUBMITTED, CLAIM_APPROVED, CLAIM_REJECTED, CLAIM_CANCELLED, ITEM_RECOVERED
    type = Column(String(50), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # Associated entity for deep navigation
    related_entity_type = Column(String(50), nullable=True)  # 'match', 'claim', 'lost_item', 'found_item'
    related_entity_id = Column(Integer, nullable=True)

    # Structured metadata for flexible future handling
    # Stored in SQLite column named 'metadata'
    extra_metadata = Column("metadata", JSON, nullable=True, default=dict)

    # Read tracking
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship to user
    user = relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification #{self.id}: {self.type} for User #{self.user_id} ({'READ' if self.is_read else 'UNREAD'})>"
