from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(
        Integer,
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    found_item_id = Column(
        Integer,
        ForeignKey("found_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    lost_item_id = Column(
        Integer,
        ForeignKey("lost_items.id", ondelete="SET NULL"),
        nullable=True,
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

    # Status: PENDING, UNDER_REVIEW, APPROVED, REJECTED, CANCELLED, WITHDRAWN
    status = Column(String(50), nullable=False, default="PENDING", index=True)

    # Reviewer audit trail (finder or admin review)
    reviewed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewer_notes = Column(Text, nullable=True)

    # Hybrid Reviewer Decision fields (Task 3)
    # review_status: NOT_REQUIRED, PENDING, APPROVED, REJECTED, DISPUTED
    review_status = Column(String(50), nullable=False, default="NOT_REQUIRED", index=True)
    # review_reason: COMPETING_CLAIMS, OWNERSHIP_EVIDENCE_CONFLICT, SUSPICIOUS_ACTIVITY, HIGH_RISK, USER_REQUESTED_REVIEW, DISPUTED
    review_reason = Column(String(100), nullable=True)
    review_decision_notes = Column(Text, nullable=True)
    review_decision_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_decision_at = Column(DateTime(timezone=True), nullable=True)

    # Reviewer Assignment fields (Reviewer Portal)
    assigned_reviewer_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    assigned_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignment_notes = Column(Text, nullable=True)

    # Handover verification method: DIRECT or OTP
    handover_method = Column(String(50), nullable=False, default="DIRECT")
    is_mandatory_review = Column(Boolean, nullable=False, default=False)
    is_mandatory_otp = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    match = relationship("Match", backref="claims")
    claimant = relationship("User", foreign_keys=[claimant_id], backref="submitted_claims")
    reviewer = relationship("User", foreign_keys=[reviewed_by], backref="reviewed_claims")
    review_decider = relationship("User", foreign_keys=[review_decision_by], backref="decided_claims")
    assigned_reviewer = relationship("User", foreign_keys=[assigned_reviewer_id], backref="assigned_claims")
    assigner = relationship("User", foreign_keys=[assigned_by_id])
    found_item = relationship("FoundItem", foreign_keys=[found_item_id], backref="claims")
    lost_item = relationship("LostItem", foreign_keys=[lost_item_id], backref="claims")
    assignment_history = relationship(
        "ReviewerAssignment",
        primaryjoin="and_(ReviewerAssignment.case_type=='CLAIM', ReviewerAssignment.case_id==Claim.id)",
        foreign_keys="[ReviewerAssignment.case_id]",
        viewonly=True,
        order_by="desc(ReviewerAssignment.created_at)",
    )

    def __repr__(self):
        return f"<Claim #{self.id}: Item #{self.found_item_id} (Match #{self.match_id}) by User #{self.claimant_id} ({self.status}, Review: {self.review_status}, Reviewer: {self.assigned_reviewer_id})>"
