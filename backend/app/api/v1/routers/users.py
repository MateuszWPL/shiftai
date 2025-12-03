"""User management routers."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db
from app.models.user import User
from app.schemas.auth import UserResponse
from app.api.v1.routers.auth import get_current_user_dependency

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/organization", response_model=List[UserResponse])
async def get_organization_users(
    current_user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> List[UserResponse]:
    """Get all users in the current user's organization."""
    
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie jesteś przypisany do żadnego zespołu"
        )
    
    result = await db.execute(
        select(User).where(User.organization_id == current_user.organization_id)
    )
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            organization_id=user.organization_id,
        )
        for user in users
    ]

