from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ReviewerAssignment(Base):
    __tablename__ = "reviewer_assignments"

    id = Column(Integer, primary_key=True, index=True)
    case_type = Column(String(50), nullable=False, index=True)  # 'CLAIM' or 'RECOVERY'
    case_id = Column(Integer, nullable=False, index=True)
    claim_id = Column(
        Integer,
        ForeignKey("claims.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    recovery_id = Column(
        Integer,
        ForeignKey("recoveries.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    reviewer_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Action: ASSIGNED, REASSIGNED, UNASSIGNED, RETURNED
    assignment_action = Column(String(50), nullable=False, default="ASSIGNED")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    reviewer = relationship("User", foreign_keys=[reviewer_id], backref="reviewer_history")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

    def __repr__(self):
        return f"<ReviewerAssignment #{self.id}: {self.case_type} #{self.case_id} -> Reviewer #{self.reviewer_id} ({self.assignment_action})>"
