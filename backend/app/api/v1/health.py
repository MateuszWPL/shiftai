"""Health check router."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.dependencies import get_db

router = APIRouter()


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ShiftAI API"
    }


@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)) -> Dict[str, str]:
    """Health check with database connection test."""
    try:
        # Test database connection
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        
        # Get database version
        db_version_result = await db.execute(text("SELECT version()"))
        db_version = db_version_result.scalar()
        
        return {
            "status": "healthy",
            "database": "connected",
            "database_version": str(db_version).split(",")[0] if db_version else "unknown",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "ShiftAI API"
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
