"""Pydantic schemas for Shift."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ShiftRequest(BaseModel):
    """Schema for a single shift request."""
    
    start_time: datetime = Field(..., description="Shift start time (UTC)")
    end_time: datetime = Field(..., description="Shift end time (UTC)")
    role: Optional[str] = Field(None, max_length=100, description="Required role for this shift (optional)")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_time_range(self) -> 'ShiftRequest':
        """Validate that end_time is after start_time."""
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class GenerateScheduleRequest(BaseModel):
    """Schema for generating a schedule."""
    
    organization_id: int = Field(..., gt=0, description="Organization ID")
    needed_shifts: List[ShiftRequest] = Field(..., min_length=1, description="List of shifts needed")
    
    model_config = ConfigDict(from_attributes=True)


class TimeSlot(BaseModel):
    """Schema for a time slot within a day."""
    
    start_hour: int = Field(..., ge=0, le=23, description="Start hour (0-23)")
    start_minute: int = Field(0, ge=0, le=59, description="Start minute (0-59)")
    end_hour: int = Field(..., ge=0, le=23, description="End hour (0-23)")
    end_minute: int = Field(0, ge=0, le=59, description="End minute (0-59)")
    role: str = Field(..., max_length=100, description="Required role for this time slot")
    count: int = Field(..., gt=0, description="Number of people needed")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_time_range(self) -> 'TimeSlot':
        """Validate that end time is after start time."""
        start_total = self.start_hour * 60 + self.start_minute
        end_total = self.end_hour * 60 + self.end_minute
        if end_total <= start_total:
            raise ValueError("End time must be after start time")
        return self


class WeeklyDemandRequest(BaseModel):
    """Schema for creating weekly staffing demand (open shifts)."""
    
    week_start_date: datetime = Field(..., description="Monday of the week (UTC, start of day)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
    time_slots: List[TimeSlot] = Field(..., min_length=1, description="Time slots for this day")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_week_start(self) -> 'WeeklyDemandRequest':
        """Validate that week_start_date is a Monday."""
        if self.week_start_date.weekday() != 0:  # 0 = Monday
            raise ValueError("week_start_date must be a Monday")
        return self


class DemandRequest(BaseModel):
    """Schema for creating staffing demand (open shifts) - legacy, kept for backward compatibility."""
    
    start_time: datetime = Field(..., description="Shift start time (UTC)")
    end_time: datetime = Field(..., description="Shift end time (UTC)")
    role: str = Field(..., max_length=100, description="Required role for this shift")
    count: int = Field(..., gt=0, description="Number of open shifts to create")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_time_range(self) -> 'DemandRequest':
        """Validate that end_time is after start_time."""
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AutoAssignRequest(BaseModel):
    """Schema for auto-assigning shifts in a date range."""
    
    start_date: datetime = Field(..., description="Start of date range (UTC)")
    end_date: datetime = Field(..., description="End of date range (UTC)")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_date_range(self) -> 'AutoAssignRequest':
        """Validate that end_date is after start_date."""
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class DeleteRangeRequest(BaseModel):
    """Schema for deleting shifts in a date range."""
    
    start_date: datetime = Field(..., description="Start of date range (UTC)")
    end_date: datetime = Field(..., description="End of date range (UTC)")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_date_range(self) -> 'DeleteRangeRequest':
        """Validate that end_date is after start_date."""
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class ShiftUpdateRequest(BaseModel):
    """Schema for updating an existing shift."""
    
    start_time: Optional[datetime] = Field(None, description="Shift start time (UTC)")
    end_time: Optional[datetime] = Field(None, description="Shift end time (UTC)")
    role: Optional[str] = Field(None, max_length=100, description="Required role")
    employee_id: Optional[int] = Field(None, description="Assigned employee ID (or None to unassign)")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_time_range(self) -> 'ShiftUpdateRequest':
        """Validate that end_time is after start_time if both are provided."""
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ShiftResponse(BaseModel):
    """Schema for shift response."""
    
    id: int
    employee_id: Optional[int] = Field(None, description="Employee ID (None for open shifts)")
    start_time: datetime
    end_time: datetime
    role: str
    is_published: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

