"""Employee invitation model."""
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SQLEnum, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, timedelta
import enum
from app.models.base import BaseModel


class EmployeeInvitationStatus(str, enum.Enum):
    """Employee invitation status type."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"


class EmployeeInvitation(BaseModel):
    """Employee invitation model."""
    
    __tablename__ = "employee_invitations"
    
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(SQLEnum(EmployeeInvitationStatus), default=EmployeeInvitationStatus.PENDING, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    employee = relationship("Employee", back_populates="invitation")
    
    # Indexes
    __table_args__ = (
        Index("idx_employee_invitation_token", "token"),
        Index("idx_employee_invitation_employee", "employee_id"),
    )
    
    @classmethod
    def create_expires_at(cls, days: int = 7) -> datetime:
        """Create expiration datetime (default 7 days)."""
        return datetime.now(timezone.utc) + timedelta(days=days)
    
    def is_expired(self) -> bool:
        """Check if invitation is expired."""
        return datetime.now(timezone.utc) > self.expires_at

