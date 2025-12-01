"""Shift model."""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Boolean, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Shift(BaseModel):
    """Shift model (Generated schedule)."""
    
    __tablename__ = "shifts"
    
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=True, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    role = Column(String(100), nullable=False, index=True)
    is_published = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    schedule = relationship("Schedule", back_populates="shifts")
    employee = relationship("Employee", back_populates="shifts")
    swap_requests = relationship("SwapRequest", back_populates="from_shift", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_shift_employee_time", "employee_id", "start_time", "end_time"),
        Index("idx_shift_published", "is_published", "start_time"),
    )

