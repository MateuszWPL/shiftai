"""Pydantic schemas for Organization."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.organization import PlanType


class OrganizationCreate(BaseModel):
    """Schema for creating a new organization."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")
    plan: PlanType = Field(default=PlanType.FREE, description="Organization plan type")
    
    model_config = ConfigDict(from_attributes=True)


class OrganizationResponse(BaseModel):
    """Schema for organization response."""
    
    id: int
    name: str
    plan: PlanType
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

