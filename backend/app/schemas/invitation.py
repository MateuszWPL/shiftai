"""Pydantic schemas for invitations."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, EmailStr
from app.models.invitation import InvitationStatus


class InvitationCreate(BaseModel):
    """Schema for creating an invitation."""
    
    email: EmailStr = Field(..., description="Email address to invite")
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name of the person to invite")
    
    model_config = ConfigDict(from_attributes=True)


class InvitationResponse(BaseModel):
    """Schema for invitation response."""
    
    id: int
    email: str
    organization_id: int
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class InvitationAccept(BaseModel):
    """Schema for accepting an invitation."""
    
    token: str = Field(..., description="Invitation token")
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")
    
    model_config = ConfigDict(from_attributes=True)

