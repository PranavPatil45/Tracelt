from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # e.g., ROLE_CHANGED, USER_SUSPENDED, CLAIM_APPROVED
    entity_type = Column(String(50), nullable=False, index=True)  # user, lost_item, found_item, claim, match, report
    entity_id = Column(Integer, nullable=True, index=True)
    details = Column(Text, nullable=True)  # JSON or descriptive text
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    admin = relationship("User", foreign_keys=[admin_id])

    def __repr__(self):
        return f"<AdminAuditLog #{self.id}: {self.action} on {self.entity_type} #{self.entity_id} by Admin #{self.admin_id}>"
