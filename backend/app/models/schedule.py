"""Schedule model."""
from sqlalchemy import Column, Integer, Date, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Schedule(BaseModel):
    """Schedule model."""
    
    __tablename__ = "schedules"
    
    team_id = Column(Integer, nullable=False, index=True)
    week_start_date = Column(Date, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    shifts = relationship("Shift", back_populates="schedule", cascade="all, delete-orphan")
