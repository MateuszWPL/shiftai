"""Pydantic schemas for SwapRequests."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.swap_requests import SwapStatus


class SwapRequestCreate(BaseModel):
    """Schema for creating a swap request."""
    
    from_shift_id: int = Field(..., gt=0, description="ID of the shift to swap")
    from_employee_id: int = Field(..., gt=0, description="ID of the employee requesting the swap")
    to_employee_id: int = Field(..., gt=0, description="ID of the employee to swap with")
    
    model_config = ConfigDict(from_attributes=True)


class SwapRequestUpdate(BaseModel):
    """Schema for updating a swap request status."""
    
    status: SwapStatus = Field(..., description="New status")
    
    model_config = ConfigDict(from_attributes=True)


class SwapRequestResponse(BaseModel):
    """Schema for swap request response."""
    
    id: int
    from_shift_id: int
    from_employee_id: int
    to_employee_id: int
    status: SwapStatus
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
