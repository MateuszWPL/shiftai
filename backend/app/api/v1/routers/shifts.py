"""Shift routers."""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, delete

from app.core.dependencies import get_db
from app.models.employee import Employee
from app.models.availability import Availability
from app.models.shift import Shift
from app.models.organization import Organization
from app.schemas.shift import (
    DemandRequest,
    WeeklyDemandRequest,
    AutoAssignRequest,
    DeleteRangeRequest,
    ShiftResponse,
)
from app.services.solver import ShiftSolver

router = APIRouter(prefix="/shifts", tags=["Shifts"])


@router.post("/demand", response_model=List[ShiftResponse], status_code=status.HTTP_201_CREATED)
async def create_demand(
    request: DemandRequest,
    organization_id: int = Query(..., gt=0, description="Organization ID"),
    db: AsyncSession = Depends(get_db),
) -> List[ShiftResponse]:
    """Create open shifts based on staffing demand."""
    # Verify organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Create count number of open shifts
    created_shifts = []
    for _ in range(request.count):
        db_shift = Shift(
            employee_id=None,  # Open shift
            start_time=request.start_time,
            end_time=request.end_time,
            role=request.role,
            is_published=False,
        )
        db.add(db_shift)
        await db.flush()
        await db.refresh(db_shift)
        created_shifts.append(db_shift)
    
    await db.commit()
    
    return [ShiftResponse.model_validate(shift) for shift in created_shifts]


@router.post("/weekly-demand", response_model=List[ShiftResponse], status_code=status.HTTP_201_CREATED)
async def create_weekly_demand(
    request: WeeklyDemandRequest,
    organization_id: int = Query(..., gt=0, description="Organization ID"),
    db: AsyncSession = Depends(get_db),
) -> List[ShiftResponse]:
    """Create open shifts for a specific day of week with multiple time slots."""
    # Verify organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Calculate the target date (week_start_date + day_of_week days)
    # Ensure we work with UTC timezone-aware datetime
    from datetime import timedelta, timezone, date
    if request.week_start_date.tzinfo is None:
        # If no timezone, assume UTC
        week_start_utc = request.week_start_date.replace(tzinfo=timezone.utc)
    else:
        week_start_utc = request.week_start_date.astimezone(timezone.utc)
    
    # Calculate target date (day of week) - ensure it's at 00:00:00 UTC
    target_date_utc = week_start_utc + timedelta(days=request.day_of_week)
    # Normalize to start of day (00:00:00) in UTC
    target_date_normalized = target_date_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Create open shifts for each time slot
    created_shifts = []
    for time_slot in request.time_slots:
        # Create datetime objects for this day in UTC
        # Use the normalized date and add hours/minutes
        start_time = target_date_normalized.replace(
            hour=time_slot.start_hour,
            minute=time_slot.start_minute,
            second=0,
            microsecond=0
        )
        end_time = target_date_normalized.replace(
            hour=time_slot.end_hour,
            minute=time_slot.end_minute,
            second=0,
            microsecond=0
        )
        
        # Create count number of open shifts for this time slot
        for _ in range(time_slot.count):
            db_shift = Shift(
                employee_id=None,  # Open shift
                start_time=start_time,
                end_time=end_time,
                role=time_slot.role,
                is_published=False,
            )
            db.add(db_shift)
            await db.flush()
            await db.refresh(db_shift)
            created_shifts.append(db_shift)
    
    await db.commit()
    
    return [ShiftResponse.model_validate(shift) for shift in created_shifts]


@router.post("/auto-assign", response_model=List[ShiftResponse], status_code=status.HTTP_200_OK)
async def auto_assign_shifts(
    request: AutoAssignRequest,
    organization_id: int = Query(..., gt=0, description="Organization ID"),
    db: AsyncSession = Depends(get_db),
) -> List[ShiftResponse]:
    """Auto-assign employees to open shifts using CSP solver (idempotent)."""
    # Verify organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Normalize dates to ensure we cover the entire week
    from datetime import timedelta
    start_date_normalized = request.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date_normalized = request.end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Step A: Reset all unpublished shifts in date range to open (unassign previous AI suggestions)
    # This prevents duplication - we reset before fetching open shifts
    reset_result = await db.execute(
        select(Shift).where(
            and_(
                Shift.start_time >= start_date_normalized,
                Shift.start_time <= end_date_normalized,
                Shift.is_published == False,
            )
        )
    )
    shifts_to_reset = reset_result.scalars().all()
    for shift in shifts_to_reset:
        shift.employee_id = None
    
    await db.flush()
    
    # Step B: Fetch all Open Shifts (employee_id is None) in this range
    open_shifts_result = await db.execute(
        select(Shift).where(
            and_(
                Shift.start_time >= start_date_normalized,
                Shift.start_time <= end_date_normalized,
                Shift.employee_id.is_(None),
            )
        ).order_by(Shift.start_time, Shift.role)
    )
    open_shifts = open_shifts_result.scalars().all()
    
    if not open_shifts:
        return []
    
    # Fetch all employees for the organization
    employees_result = await db.execute(
        select(Employee).where(Employee.organization_id == organization_id)
    )
    employees = employees_result.scalars().all()
    
    if not employees:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No employees found for this organization"
        )
    
    # Get date range for availability query
    min_start = min(shift.start_time for shift in open_shifts)
    max_end = max(shift.end_time for shift in open_shifts)
    
    # Fetch all availabilities for these employees within the date range
    employee_ids = [emp.id for emp in employees]
    availabilities_result = await db.execute(
        select(Availability).where(
            and_(
                Availability.employee_id.in_(employee_ids),
                Availability.start_time < max_end,
                Availability.end_time > min_start,
            )
        )
    )
    availabilities = availabilities_result.scalars().all()
    
    if not availabilities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No availability slots found for employees in organization {organization_id} "
                f"within the date range {request.start_date.date()} to {request.end_date.date()}. "
                "Please add availability slots for employees. You only need to add time windows when employees are available - "
                "they don't need to cover the entire 24 hours."
            )
        )
    
    # Prepare shifts_needed for solver (use open shift IDs as shift_id)
    shifts_needed = []
    shift_id_to_shift = {}
    for idx, open_shift in enumerate(open_shifts):
        shift_id = idx
        shifts_needed.append({
            'id': shift_id,
            'start': open_shift.start_time,
            'end': open_shift.end_time,
            'role': open_shift.role,
        })
        shift_id_to_shift[shift_id] = open_shift
    
    # Call solver
    solver = ShiftSolver()
    try:
        assignments = solver.solve(
            employees=list(employees),
            availabilities=list(availabilities),
            shifts_needed=shifts_needed,
        )
    except ValueError as e:
        error_msg = str(e)
        error_msg += (
            f"\n\nDiagnostic info: "
            f"{len(employees)} employees, {len(availabilities)} availability slots, "
            f"{len(shifts_needed)} open shifts to assign. "
            f"Check that employees have sufficient availability and won't exceed max_hours_per_week."
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Step E: Update the shifts with the new employee_id assigned by AI
    updated_shifts = []
    for assignment in assignments:
        employee_id = assignment['employee_id']
        shift_id = assignment['shift_id']
        open_shift = shift_id_to_shift[shift_id]
        
        open_shift.employee_id = employee_id
        updated_shifts.append(open_shift)
    
    await db.commit()
    
    # Refresh all updated shifts
    for shift in updated_shifts:
        await db.refresh(shift)
    
    return [ShiftResponse.model_validate(shift) for shift in updated_shifts]


@router.delete("/range", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shifts_range(
    organization_id: int = Query(..., gt=0, description="Organization ID"),
    start_date: datetime = Query(..., description="Start of date range (UTC)"),
    end_date: datetime = Query(..., description="End of date range (UTC)"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete all shifts (assigned and open) in a date range."""
    # Verify organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Validate date range
    if end_date <= start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be after start_date"
        )
    
    # Get all employees for the organization to find their shifts
    employees_result = await db.execute(
        select(Employee).where(Employee.organization_id == organization_id)
    )
    employees = employees_result.scalars().all()
    employee_ids = [emp.id for emp in employees] if employees else []
    
    # IMPORTANT: Use date-only comparison to delete all shifts from the week
    # Extract date parts to compare only dates, not times
    # This ensures we delete all shifts from Monday 00:00 to Sunday 23:59:59
    from datetime import timedelta, time
    from sqlalchemy import func, cast, Date
    
    # Normalize start_date to beginning of day
    start_date_normalized = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    # Normalize end_date to end of day (23:59:59.999999)
    end_date_normalized = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # First, let's see what shifts exist in this range (for debugging)
    # Check ALL shifts in range (before filtering by employee_id)
    debug_query = select(Shift).where(
        Shift.start_time >= start_date_normalized,
        Shift.start_time <= end_date_normalized,
    )
    debug_result = await db.execute(debug_query)
    all_shifts_in_range = debug_result.scalars().all()
    print(f"[DELETE] Found {len(all_shifts_in_range)} total shifts in range {start_date_normalized} to {end_date_normalized}")
    for shift in all_shifts_in_range[:10]:  # Show first 10
        print(f"[DELETE]   Shift {shift.id}: {shift.start_time} - {shift.end_time}, employee_id={shift.employee_id}, role={shift.role}")
    
    # Delete all shifts in the date range
    # Strategy: Delete shifts that are either:
    # 1. Assigned to employees of this organization (employee_id in employee_ids)
    # 2. Open shifts (employee_id is None) - we can't verify organization, but in MVP context,
    #    if user is clearing their week, they likely created these open shifts
    # 
    # Note: For open shifts, we rely on the fact that in MVP, users only see/manage their own org's data
    conditions = [
        Shift.start_time >= start_date_normalized,
        Shift.start_time <= end_date_normalized,  # Include all shifts up to end of end_date
    ]
    
    if employee_ids:
        # Delete shifts assigned to org employees OR open shifts
        conditions.append(
            or_(
                Shift.employee_id.in_(employee_ids),
                Shift.employee_id.is_(None),
            )
        )
    else:
        # No employees in org, only delete open shifts (if any exist)
        conditions.append(Shift.employee_id.is_(None))
    
    delete_stmt = delete(Shift).where(and_(*conditions))
    result = await db.execute(delete_stmt)
    await db.commit()
    
    # Log for debugging
    print(f"[DELETE] Deleted shifts in range {start_date} to {end_date} for org {organization_id}")
    print(f"[DELETE] Employee IDs in org: {employee_ids}")
    print(f"[DELETE] Rows affected: {result.rowcount if hasattr(result, 'rowcount') else 'unknown'}")


@router.get("/", response_model=List[ShiftResponse])
async def get_shifts(
    organization_id: int = Query(..., gt=0, description="Organization ID"),
    db: AsyncSession = Depends(get_db),
) -> List[ShiftResponse]:
    """Get all shifts for an organization (including open shifts)."""
    # Verify organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Get all employees for the organization
    employees_result = await db.execute(
        select(Employee).where(Employee.organization_id == organization_id)
    )
    employees = employees_result.scalars().all()
    employee_ids = [emp.id for emp in employees] if employees else []
    
    # Get all shifts: assigned to employees OR open shifts (employee_id is None)
    if employee_ids:
        shifts_result = await db.execute(
            select(Shift).where(
                or_(
                    Shift.employee_id.in_(employee_ids),
                    Shift.employee_id.is_(None),
                )
            ).order_by(Shift.start_time)
        )
    else:
        # No employees, only get open shifts
        shifts_result = await db.execute(
            select(Shift).where(Shift.employee_id.is_(None))
            .order_by(Shift.start_time)
        )
    
    shifts = shifts_result.scalars().all()
    
    return [ShiftResponse.model_validate(shift) for shift in shifts]

