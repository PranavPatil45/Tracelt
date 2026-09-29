from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(
        Integer,
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    claimant_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Verification evidence and private identifying details
    verification_details = Column(Text, nullable=False)
    additional_message = Column(Text, nullable=True)

    # Status: PENDING, UNDER_REVIEW, APPROVED, REJECTED, CANCELLED
    status = Column(String(50), nullable=False, default="PENDING", index=True)

    # Reviewer audit trail
    reviewed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewer_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    match = relationship("Match", backref="claims")
    claimant = relationship("User", foreign_keys=[claimant_id], backref="submitted_claims")
    reviewer = relationship("User", foreign_keys=[reviewed_by], backref="reviewed_claims")

    def __repr__(self):
        return f"<Claim #{self.id}: Match #{self.match_id} by User #{self.claimant_id} ({self.status})>"
