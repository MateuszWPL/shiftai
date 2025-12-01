"""SwapRequests model."""
from sqlalchemy import Column, Integer, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class SwapStatus(str, enum.Enum):
    """Swap request status."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class SwapRequest(BaseModel):
    """SwapRequest model."""
    
    __tablename__ = "swap_requests"
    
    from_shift_id = Column(Integer, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False, index=True)
    from_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    to_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SQLEnum(SwapStatus), default=SwapStatus.PENDING, nullable=False, index=True)
    
    # Relationships
    from_shift = relationship("Shift", back_populates="swap_requests")
    from_employee = relationship("Employee", foreign_keys=[from_employee_id], back_populates="sent_swap_requests")
    to_employee = relationship("Employee", foreign_keys=[to_employee_id], back_populates="received_swap_requests")
    
    # Indexes
    __table_args__ = (
        Index("idx_swap_status_from", "status", "from_employee_id"),
        Index("idx_swap_status_to", "status", "to_employee_id"),
    )
