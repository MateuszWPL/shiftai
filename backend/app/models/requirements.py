"""Requirements model (Demand)."""
from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Requirements(BaseModel):
    """Requirements model (Demand planning)."""
    
    __tablename__ = "requirements"
    
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start_date = Column(Date, nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    position_name = Column(String(100), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    headcount = Column(Integer, nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="requirements")
    
    # Indexes
    __table_args__ = (
        Index("idx_req_org_week", "organization_id", "week_start_date"),
    )
