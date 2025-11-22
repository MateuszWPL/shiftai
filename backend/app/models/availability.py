"""Availability model."""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, CheckConstraint, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Availability(BaseModel):
    """Availability model for employee availability windows."""
    
    __tablename__ = "availabilities"
    
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    preference_score = Column(Integer, nullable=False)
    
    # Relationships
    employee = relationship("Employee", back_populates="availabilities")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("preference_score >= 0 AND preference_score <= 10", name="check_preference_score_range"),
        CheckConstraint("end_time > start_time", name="check_time_range"),
        Index("idx_availability_employee_time", "employee_id", "start_time", "end_time"),
    )

