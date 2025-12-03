"""Pydantic schemas for Employee Invitation."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.employee_invitation import EmployeeInvitationStatus


class EmployeeInvitationResponse(BaseModel):
    """Schema for employee invitation response."""
    
    id: int
    employee_id: int
    token: str
    status: str
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime
    invitation_url: str  # Full URL for the invitation
    
    model_config = ConfigDict(from_attributes=True)


class EmployeeInvitationAccept(BaseModel):
    """Schema for accepting employee invitation."""
    
    token: str = Field(..., description="Invitation token")
    password: str = Field(..., min_length=8, description="Password for the account")

