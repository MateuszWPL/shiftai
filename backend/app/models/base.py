"""Base model with common fields."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime
from app.core.dependencies import Base


def utc_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


class BaseModel(Base):
    """Base model with id, created_at, updated_at."""
    
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

