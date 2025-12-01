"""SwapRequest model."""
from sqlalchemy import Column, Integer, ForeignKey, Enum as SQLEnum, String
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class SwapStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"

class SwapRequest(BaseModel):
    """SwapRequest model."""
    
    __tablename__ = "swap_requests"
    
    from_shift_id = Column(Integer, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(SwapStatus), default=SwapStatus.PENDING, nullable=False)
    
    # Relationships
    from_shift = relationship("Shift", foreign_keys=[from_shift_id])
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
