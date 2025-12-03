"""User model (Manager)."""
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    """User role type."""
    OWNER = "owner"
    MANAGER = "manager"
    EMPLOYEE = "employee"


class User(BaseModel):
    """User model (Manager)."""
    
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    role = Column(SQLEnum(UserRole), nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    employee = relationship("Employee", back_populates="user", uselist=False)
    
    # Indexes
    __table_args__ = (
        Index("idx_user_org_email", "organization_id", "email"),
    )

