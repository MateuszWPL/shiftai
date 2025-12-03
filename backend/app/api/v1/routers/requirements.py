"""Requirements router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db
from app.models.requirements import Requirements
from app.models.organization import Organization
from app.schemas.requirements import RequirementCreate, RequirementUpdate, RequirementResponse

router = APIRouter(prefix="/requirements", tags=["Requirements"])


@router.post("/", response_model=RequirementResponse, status_code=status.HTTP_201_CREATED)
async def create_requirement(
    request: RequirementCreate,
    db: AsyncSession = Depends(get_db),
) -> RequirementResponse:
    """Create a new requirement (demand)."""
    # Verify organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == request.organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {request.organization_id} not found"
        )
    
    db_requirement = Requirements(
        organization_id=request.organization_id,
        week_start_date=request.week_start_date,
        day_of_week=request.day_of_week,
        position_name=request.position_name,
        start_time=request.start_time,
        end_time=request.end_time,
        headcount=request.headcount,
    )
    db.add(db_requirement)
    await db.commit()
    await db.refresh(db_requirement)
    
    return RequirementResponse.model_validate(db_requirement)


@router.get("/", response_model=List[RequirementResponse])
async def get_requirements(
    organization_id: int = Query(..., gt=0, description="Organization ID"),
    db: AsyncSession = Depends(get_db),
) -> List[RequirementResponse]:
    """Get all requirements for an organization."""
    result = await db.execute(
        select(Requirements).where(Requirements.organization_id == organization_id)
    )
    requirements = result.scalars().all()
    
    return [RequirementResponse.model_validate(req) for req in requirements]


@router.put("/{requirement_id}", response_model=RequirementResponse)
async def update_requirement(
    requirement_id: int,
    request: RequirementUpdate,
    db: AsyncSession = Depends(get_db),
) -> RequirementResponse:
    """Update a requirement."""
    result = await db.execute(
        select(Requirements).where(Requirements.id == requirement_id)
    )
    requirement = result.scalar_one_or_none()
    
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )
    
    # Update fields if provided
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(requirement, key, value)
    
    await db.commit()
    await db.refresh(requirement)
    
    return RequirementResponse.model_validate(requirement)


@router.delete("/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_requirement(
    requirement_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a requirement."""
    result = await db.execute(
        select(Requirements).where(Requirements.id == requirement_id)
    )
    requirement = result.scalar_one_or_none()
    
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )
    
    await db.delete(requirement)
    await db.commit()
