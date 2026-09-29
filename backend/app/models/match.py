from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
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

    # Individual rule-based signal scores
    category_score = Column(Integer, nullable=False, default=0)      # max 25
    location_score = Column(Integer, nullable=False, default=0)      # max 25
    date_score = Column(Integer, nullable=False, default=0)          # max 20
    time_score = Column(Integer, nullable=False, default=0)          # max 10
    description_score = Column(Integer, nullable=False, default=0)   # max 20

    # Aggregate weighted score: 0 - 100
    total_score = Column(Integer, nullable=False, index=True)

    # Explanation reasons stored as JSON array of strings
    reasons = Column(JSON, nullable=False, default=list)

    # Status: POSSIBLE, REVIEWED, REJECTED
    status = Column(String(50), nullable=False, default="POSSIBLE", index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Uniqueness constraint preventing duplicate (lost_item, found_item) pairs
    __table_args__ = (
        UniqueConstraint("lost_item_id", "found_item_id", name="uq_match_lost_found"),
    )

    # Relationships to source items
    lost_item = relationship("LostItem", backref="matched_pairs")
    found_item = relationship("FoundItem", backref="matched_pairs")

    def __repr__(self):
        return f"<Match #{self.id}: Lost #{self.lost_item_id} <-> Found #{self.found_item_id} ({self.total_score}% - {self.status})>"
