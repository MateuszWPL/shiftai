"""Requirement model."""
from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Requirement(BaseModel):
    """Requirement model (Demand)."""
    
    __tablename__ = "requirements"
    
    team_id = Column(Integer, nullable=False, index=True) # Assuming team_id is just an integer for now, or FK if Team model exists. Based on spec, it's just team_id.
    week_start_date = Column(Date, nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0-6
    position_name = Column(String(100), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    headcount = Column(Integer, nullable=False)
