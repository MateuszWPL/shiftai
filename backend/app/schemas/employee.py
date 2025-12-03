"""Pydantic schemas for Employee and Availability."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, EmailStr, model_validator


class EmployeeCreate(BaseModel):
    """Schema for creating a new employee."""
    
    first_name: str = Field(..., min_length=1, max_length=100, description="Employee first name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Employee last name")
    email: Optional[EmailStr] = Field(None, description="Employee email address")
    phone: Optional[str] = Field(None, max_length=20, description="Employee phone number")
    role: str = Field(..., min_length=1, max_length=100, description="Employee role (e.g., 'Waiter', 'Cook')")
    organization_id: int = Field(..., gt=0, description="Organization ID")
    hourly_rate: Decimal = Field(default=Decimal("0.00"), ge=0, description="Hourly rate")
    max_hours_per_week: int = Field(..., gt=0, le=168, description="Maximum hours per week")
    
    model_config = ConfigDict(from_attributes=True)


class EmployeeResponse(BaseModel):
    """Schema for employee response."""
    
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    hourly_rate: Decimal
    max_hours_per_week: int
    role: str
    organization_id: int
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class AvailabilityCreate(BaseModel):
    """Schema for creating a single availability slot."""
    
    employee_id: int = Field(..., gt=0, description="Employee ID")
    start_time: datetime = Field(..., description="Availability start time (UTC)")
    end_time: datetime = Field(..., description="Availability end time (UTC)")
    preference_score: int = Field(..., ge=0, le=10, description="Preference score (0-10)")
    
    model_config = ConfigDict(from_attributes=True)
    
    @model_validator(mode='after')
    def validate_time_range(self) -> 'AvailabilityCreate':
        """Validate that end_time is after start_time."""
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AvailabilityBulkCreate(BaseModel):
    """Schema for bulk creating availability slots."""
    
    availabilities: list[AvailabilityCreate] = Field(..., min_length=1, description="List of availability slots")
    
    model_config = ConfigDict(from_attributes=True)


class AvailabilityResponse(BaseModel):
    """Schema for availability response.
    
    Note: datetime fields are automatically serialized to ISO format strings in JSON responses.
    """
    
    id: int
    employee_id: int
    start_time: datetime
    end_time: datetime
    preference_score: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "employee_id": 1,
                "start_time": "2025-11-25T09:00:00Z",
                "end_time": "2025-11-25T17:00:00Z",
                "preference_score": 10,
                "created_at": "2025-11-22T12:00:00Z",
                "updated_at": "2025-11-22T12:00:00Z"
            }
        }
    )

