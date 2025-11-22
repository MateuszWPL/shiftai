"""User model (Manager)."""
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    """User role type."""
    OWNER = "owner"
    MANAGER = "manager"


class User(BaseModel):
    """User model (Manager)."""
    
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SQLEnum(UserRole), nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    
    # Indexes
    __table_args__ = (
        Index("idx_user_org_email", "organization_id", "email"),
    )

