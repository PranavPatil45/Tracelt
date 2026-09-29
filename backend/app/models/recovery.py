from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
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
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lost_item_id = Column(
        Integer,
        ForeignKey("lost_items.id", ondelete="CASCADE"),
        nullable=False,
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

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    claim = relationship("Claim", backref="recovery", uselist=False)
    match = relationship("Match", backref="recoveries")
    lost_item = relationship("LostItem", backref="recoveries")
    found_item = relationship("FoundItem", backref="recoveries")
    claimant = relationship("User", foreign_keys=[claimant_id], backref="claimant_recoveries")
    finder = relationship("User", foreign_keys=[finder_id], backref="finder_recoveries")

    def __repr__(self):
        return f"<Recovery #{self.id}: Claim #{self.claim_id} ({self.status})>"
