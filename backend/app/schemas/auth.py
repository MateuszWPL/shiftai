"""Pydantic schemas for authentication."""
from pydantic import BaseModel, ConfigDict, Field, EmailStr


class UserRegister(BaseModel):
    """Schema for user registration."""
    
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")
    full_name: str = Field(..., min_length=1, max_length=255, description="User full name")
    organization_name: str = Field(..., min_length=1, max_length=255, description="Organization/Team name")
    
    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    """Schema for user login."""
    
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Schema for access token response."""
    
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Schema for user response."""
    
    id: int
    email: str
    full_name: str | None
    role: str
    organization_id: int | None
    
    model_config = ConfigDict(from_attributes=True)


class UserWithToken(UserResponse):
    """Schema for user response with token."""
    
    access_token: str
    token_type: str = "bearer"

