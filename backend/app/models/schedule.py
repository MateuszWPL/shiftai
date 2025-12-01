"""Schedule model."""
from sqlalchemy import Column, Integer, ForeignKey, Date, Boolean, DateTime, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Schedule(BaseModel):
    """Schedule model (Weekly schedule container)."""
    
    __tablename__ = "schedules"
    
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start_date = Column(Date, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="schedules")
    shifts = relationship("Shift", back_populates="schedule", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_schedule_org_week", "organization_id", "week_start_date"),
    )

