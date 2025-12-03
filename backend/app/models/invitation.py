"""Invitation model for team member invitations."""
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SQLEnum, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, timedelta
import enum
from app.models.base import BaseModel


class InvitationStatus(str, enum.Enum):
    """Invitation status type."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"


class Invitation(BaseModel):
    """Invitation model for team member invitations."""
    
    __tablename__ = "invitations"
    
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(SQLEnum(InvitationStatus), default=InvitationStatus.PENDING, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="invitations")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])
    
    # Indexes
    __table_args__ = (
        Index("idx_invitation_org_email", "organization_id", "email"),
        Index("idx_invitation_token", "token"),
    )
    
    @classmethod
    def create_expires_at(cls, days: int = 7) -> datetime:
        """Create expiration datetime (default 7 days)."""
        return datetime.now(timezone.utc) + timedelta(days=days)
    
    def is_expired(self) -> bool:
        """Check if invitation is expired."""
        return datetime.now(timezone.utc) > self.expires_at

