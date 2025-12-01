"""Pydantic schemas for Requirements."""
from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class RequirementCreate(BaseModel):
    """Schema for creating a requirement."""
    
    organization_id: int = Field(..., gt=0, description="Organization ID")
    week_start_date: date = Field(..., description="Monday of the week")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
    position_name: str = Field(..., min_length=1, max_length=100, description="Position name")
    start_time: time = Field(..., description="Start time")
    end_time: time = Field(..., description="End time")
    headcount: int = Field(..., gt=0, description="Number of people needed")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_week_start(self) -> 'RequirementCreate':
        """Validate that week_start_date is a Monday."""
        if self.week_start_date.weekday() != 0:  # 0 = Monday
            raise ValueError("week_start_date must be a Monday")
        return self
        
    @model_validator(mode='after')
    def validate_time_range(self) -> 'RequirementCreate':
        """Validate that end_time is after start_time."""
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class RequirementResponse(BaseModel):
    """Schema for requirement response."""
    
    id: int
    organization_id: int
    week_start_date: date
    day_of_week: int
    position_name: str
    start_time: time
    end_time: time
    headcount: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
