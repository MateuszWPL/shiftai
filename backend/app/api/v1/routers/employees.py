"""Employee and Availability routers."""
from datetime import datetime, date, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import get_db
from app.models.employee import Employee
from app.models.availability import Availability
from app.models.organization import Organization
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeResponse,
    AvailabilityCreate,
    AvailabilityBulkCreate,
    AvailabilityResponse,
)

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    """Create a new employee."""
    # Check if organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == employee_data.organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {employee_data.organization_id} not found. Please create the organization first."
        )
    
    # Create employee
    db_employee = Employee(
        first_name=employee_data.first_name,
        last_name=employee_data.last_name,
        email=employee_data.email,
        phone=employee_data.phone,
        role=employee_data.role,
        organization_id=employee_data.organization_id,
        hourly_rate=employee_data.hourly_rate,
        max_hours_per_week=employee_data.max_hours_per_week,
    )
    
    try:
        db.add(db_employee)
        await db.commit()
        await db.refresh(db_employee)
    except IntegrityError as e:
        await db.rollback()
        # Handle any other integrity errors (e.g., unique constraints)
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if "organization_id" in error_msg.lower() or "foreign key" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Organization with id {employee_data.organization_id} not found"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database integrity error: {error_msg}"
        )
    
    return EmployeeResponse.model_validate(db_employee)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    """Update an employee."""
    if employee_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee ID"
        )
        
    # Check if employee exists
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    db_employee = result.scalar_one_or_none()
    
    if not db_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id {employee_id} not found"
        )
        
    # Update fields
    db_employee.first_name = employee_data.first_name
    db_employee.last_name = employee_data.last_name
    db_employee.email = employee_data.email
    db_employee.phone = employee_data.phone
    db_employee.role = employee_data.role
    db_employee.hourly_rate = employee_data.hourly_rate
    db_employee.max_hours_per_week = employee_data.max_hours_per_week
    # We don't update organization_id usually, but if needed we could.
    # For now let's keep it simple.
    
    try:
        await db.commit()
        await db.refresh(db_employee)
    except IntegrityError as e:
        await db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database integrity error: {error_msg}"
        )
        
    return EmployeeResponse.model_validate(db_employee)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an employee."""
    if employee_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee ID"
        )
    
    # Check if employee exists
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id {employee_id} not found"
        )
    
    # Delete the employee
    await db.delete(employee)
    await db.commit()
    
    return None


@router.get("/{org_id}", response_model=List[EmployeeResponse])
async def get_employees_by_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
) -> List[EmployeeResponse]:
    """Get all employees for an organization."""
    if org_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID"
        )
    
    result = await db.execute(
        select(Employee).where(Employee.organization_id == org_id)
    )
    employees = result.scalars().all()
    
    if not employees:
        return []
    
    return [EmployeeResponse.model_validate(emp) for emp in employees]


@router.post(
    "/availability",
    response_model=List[AvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
async def bulk_create_availability(
    availability_data: AvailabilityBulkCreate,
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityResponse]:
    """Bulk add availability slots with duplicate prevention."""
    if not availability_data.availabilities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one availability slot is required"
        )
    
    created_availabilities = []
    
    for avail in availability_data.availabilities:
        # Validate time range
        if avail.end_time <= avail.start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"end_time must be after start_time for employee_id {avail.employee_id}"
            )
        
        # Check if employee exists
        employee_result = await db.execute(
            select(Employee).where(Employee.id == avail.employee_id)
        )
        employee = employee_result.scalar_one_or_none()
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with id {avail.employee_id} not found"
            )
        
        # Check for overlapping/duplicate availability slots
        # Delete existing slots that overlap with this time range
        await db.execute(
            delete(Availability).where(
                and_(
                    Availability.employee_id == avail.employee_id,
                    Availability.start_time < avail.end_time,
                    Availability.end_time > avail.start_time,
                )
            )
        )
        
        # Create new availability slot
        db_availability = Availability(
            employee_id=avail.employee_id,
            start_time=avail.start_time,
            end_time=avail.end_time,
            preference_score=avail.preference_score,
        )
        
        db.add(db_availability)
        await db.flush()  # Flush to get the ID
        await db.refresh(db_availability)
        
        created_availabilities.append(db_availability)
    
    await db.commit()
    
    return [AvailabilityResponse.model_validate(avail) for avail in created_availabilities]


@router.get(
    "/availability/{employee_id}",
    response_model=List[AvailabilityResponse],
)
async def get_employee_availability(
    employee_id: int,
    start_date: Optional[date] = Query(None, description="Start date filter (inclusive)"),
    end_date: Optional[date] = Query(None, description="End date filter (inclusive)"),
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityResponse]:
    """Get availability slots for an employee within a date range."""
    if employee_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee ID"
        )
    
    # Check if employee exists
    employee_result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    employee = employee_result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id {employee_id} not found"
        )
    
    # Build query
    query = select(Availability).where(Availability.employee_id == employee_id)
    
    # Apply date filters if provided
    if start_date:
        # Convert date to datetime at start of day (UTC)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        query = query.where(Availability.start_time >= start_datetime)
    
    if end_date:
        # Convert date to datetime at end of day (UTC)
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        query = query.where(Availability.end_time <= end_datetime)
    
    # Validate date range if both are provided
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    # Order by start_time
    query = query.order_by(Availability.start_time)
    
    result = await db.execute(query)
    availabilities = result.scalars().all()
    
    return [AvailabilityResponse.model_validate(avail) for avail in availabilities]


@router.delete(
    "/availability/{availability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_availability(
    availability_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an availability slot."""
    if availability_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid availability ID"
        )
    
    # Check if availability exists
    availability_result = await db.execute(
        select(Availability).where(Availability.id == availability_id)
    )
    availability = availability_result.scalar_one_or_none()
    
    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Availability with id {availability_id} not found"
        )
    
    # Delete the availability
    await db.execute(delete(Availability).where(Availability.id == availability_id))
    await db.commit()
    
    return None