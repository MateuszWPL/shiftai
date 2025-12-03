"""Application configuration."""
import os
from typing import Optional
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Application settings."""
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "ShiftAI API"
    
    # Database
    DATABASE_URL: Optional[str] = Field(default=None)
    
    # Security
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production-please-use-strong-random-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Email (Resend)
    RESEND_API_KEY: Optional[str] = Field(default=None)
    RESEND_FROM_EMAIL: str = Field(default="noreply@antigravity.pl", description="From email address")
    FRONTEND_URL: str = Field(default="http://localhost:3000", description="Frontend URL for invitation links")
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    
    @classmethod
    def from_env(cls) -> "Settings":
        """Create settings from environment variables."""
        cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
        cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
        if not cors_origins:
            cors_origins = ["http://localhost:3000"]
        
        return cls(
            DATABASE_URL=os.getenv("DATABASE_URL"),
            SECRET_KEY=os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-please-use-strong-random-key"),
            RESEND_API_KEY=os.getenv("RESEND_API_KEY"),
            RESEND_FROM_EMAIL=os.getenv("RESEND_FROM_EMAIL", "noreply@antigravity.pl"),
            FRONTEND_URL=os.getenv("FRONTEND_URL", "http://localhost:3000"),
            CORS_ORIGINS=cors_origins,
        )


settings = Settings.from_env()

