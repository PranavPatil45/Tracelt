from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # lost_item, found_item, user, claim, message
    entity_id = Column(Integer, nullable=False, index=True)
    reason = Column(String(100), nullable=False)  # spam, inappropriate, fraudulent, incorrect_information, other
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="PENDING", index=True)  # PENDING, REVIEWED, RESOLVED, DISMISSED
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    def __repr__(self):
        return f"<Report #{self.id}: {self.reason} on {self.entity_type} #{self.entity_id} ({self.status})>"
