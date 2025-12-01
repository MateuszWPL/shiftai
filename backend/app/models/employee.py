"""Employee model (Staff)."""
from sqlalchemy import Column, String, Integer, ForeignKey, Numeric, Index
from sqlalchemy.orm import relationship
from decimal import Decimal
from app.models.base import BaseModel


class Employee(BaseModel):
    """Employee model (Staff)."""
    
    __tablename__ = "employees"
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    hourly_rate = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    max_hours_per_week = Column(Integer, nullable=False)
    role = Column(String(100), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="employees")
    availabilities = relationship("Availability", back_populates="employee", cascade="all, delete-orphan")
    shifts = relationship("Shift", back_populates="employee", cascade="all, delete-orphan")
    sent_swap_requests = relationship("SwapRequest", foreign_keys="SwapRequest.from_employee_id", back_populates="from_employee", cascade="all, delete-orphan")
    received_swap_requests = relationship("SwapRequest", foreign_keys="SwapRequest.to_employee_id", back_populates="to_employee", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_employee_org_role", "organization_id", "role"),
    )

