from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Recovery(Base):
    __tablename__ = "recoveries"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(
        Integer,
        ForeignKey("claims.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    match_id = Column(
        Integer,
        ForeignKey("matches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lost_item_id = Column(
        Integer,
        ForeignKey("lost_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    found_item_id = Column(
        Integer,
        ForeignKey("found_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    claimant_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finder_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Status: RETURN_PENDING, RETURNED, RECOVERED, CANCELLED
    status = Column(String(50), nullable=False, default="RETURN_PENDING", index=True)

    # Handover / return logistics
    return_location = Column(String(255), nullable=True)
    return_notes = Column(Text, nullable=True)

    returned_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)

    # Hybrid Reviewer Workflow fields (Task 3)
    # review_status: NOT_REQUIRED, PENDING, APPROVED, REJECTED, DISPUTED
    review_status = Column(String(50), nullable=False, default="NOT_REQUIRED", index=True)
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

    # Handover method & verification: DIRECT or OTP
    handover_method = Column(String(50), nullable=False, default="DIRECT")
    is_mandatory_review = Column(Boolean, nullable=False, default=False)
    is_mandatory_otp = Column(Boolean, nullable=False, default=False)

    # Secure OTP Handover storage (hash only, never plaintext)
    otp_hash = Column(String(255), nullable=True)
    otp_salt = Column(String(64), nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    otp_attempts = Column(Integer, default=0, nullable=False)
    otp_verified_at = Column(DateTime(timezone=True), nullable=True)

    # Dispute mechanism
    dispute_reason = Column(Text, nullable=True)
    disputed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    disputed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    claim = relationship("Claim", backref="recovery", uselist=False)
    match = relationship("Match", backref="recoveries")
    lost_item = relationship("LostItem", backref="recoveries")
    found_item = relationship("FoundItem", backref="recoveries")
    claimant = relationship("User", foreign_keys=[claimant_id], backref="claimant_recoveries")
    finder = relationship("User", foreign_keys=[finder_id], backref="finder_recoveries")
    review_decider = relationship("User", foreign_keys=[review_decision_by], backref="decided_recoveries")
    assigned_reviewer = relationship("User", foreign_keys=[assigned_reviewer_id], backref="assigned_recoveries")
    assigner = relationship("User", foreign_keys=[assigned_by_id])
    disputer = relationship("User", foreign_keys=[disputed_by], backref="disputed_recoveries")
    assignment_history = relationship(
        "ReviewerAssignment",
        primaryjoin="and_(ReviewerAssignment.case_type=='RECOVERY', ReviewerAssignment.case_id==Recovery.id)",
        foreign_keys="[ReviewerAssignment.case_id]",
        viewonly=True,
        order_by="desc(ReviewerAssignment.created_at)",
    )

    def __repr__(self):
        return f"<Recovery #{self.id}: Claim #{self.claim_id} ({self.status}, Review: {self.review_status}, Method: {self.handover_method}, Reviewer: {self.assigned_reviewer_id})>"
