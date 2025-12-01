"""Organization model."""
from sqlalchemy import Column, String, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class PlanType(str, enum.Enum):
    """Organization plan type."""
    FREE = "free"
    PRO = "pro"


class Organization(BaseModel):
    """Organization model."""
    
    __tablename__ = "organizations"
    
    name = Column(String(255), nullable=False, index=True)
    plan = Column(SQLEnum(PlanType), default=PlanType.FREE, nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    employees = relationship("Employee", back_populates="organization", cascade="all, delete-orphan")
    requirements = relationship("Requirements", back_populates="organization", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="organization", cascade="all, delete-orphan")

