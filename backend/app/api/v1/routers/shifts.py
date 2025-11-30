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
    ShiftUpdateRequest,
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
    shifts_to_create = []
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
            shifts_to_create.append(db_shift)
            
    # Bulk insert
    if shifts_to_create:
        db.add_all(shifts_to_create)
        await db.commit()
        
        # We need to refresh to get IDs, but for bulk operations it might be slow to refresh all.
        # However, the response model expects ShiftResponse with IDs.
        # For better performance with large batches, we might skip returning full objects or just return count.
        # But to keep API contract, we'll try to refresh.
        # A better approach for huge batches would be to return a summary, but for <100 items this is fine.
        for shift in shifts_to_create:
            await db.refresh(shift)
    
    return [ShiftResponse.model_validate(shift) for shift in shifts_to_create]


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
        # It's possible to have no availability but still want to clear assignments or just check.
        # But for auto-assign, we need availability.
        # We'll return empty list instead of error to be more graceful? 
        # No, user expects assignment, so error is appropriate if no one is available.
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
        shift_id = idx # Use index as temporary ID for solver
        shifts_needed.append({
            'id': shift_id,
            'start': open_shift.start_time,
            'end': open_shift.end_time,
            'role': open_shift.role,
            'db_id': open_shift.id # Keep track of real DB ID
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
    # Handle potentially split shifts returned by solver
    
    # First, collect all original shifts that were processed
    processed_original_shift_ids = set()
    
    shifts_to_add = []
    shifts_to_delete = [] # If we split a shift, we might want to delete the original or modify it.
    # Actually, simpler strategy: 
    # The solver returns a list of assignments. 
    # If the assignment matches the original shift exactly, we update the employee_id.
    # If the assignment is a split of the original shift, we need to:
    # 1. Mark original shift for deletion (or update it to be the first segment)
    # 2. Create new shifts for the other segments.
    
    # However, to avoid complex update logic, we can:
    # 1. Delete ALL open shifts that were considered for assignment (we have their IDs).
    # 2. Create NEW shifts based on the solver's output.
    # But this changes IDs, which might be confusing if frontend tracks them.
    # Let's stick to: Update if exact match, Delete+Create if split.
    
    # Wait, the current solver implementation (before my changes) doesn't split shifts.
    # I am about to implement splitting in the solver.
    # So I need to prepare this endpoint to handle the NEW solver output which might include splits.
    
    # Let's assume the solver returns 'original_shift_id' (which is our temp 'id') in the assignment.
    
    # For now, with current solver, it's 1-to-1. 
    # I will update this endpoint to handle splits AFTER I update the solver. 
    # But wait, I am in the "Backend Improvements" task which includes "Refactor solver.py".
    # So I should update this endpoint NOW to be ready for the solver changes.
    
    # Let's implement a robust update strategy:
    updated_shifts = []
    
    # We need to know which original shifts were "touched"
    # The solver will return assignments.
    # If an assignment covers the full duration of the original shift, it's a simple update.
    # If it covers a part, it's a split.
    
    # Actually, the solver might return multiple assignments for a single original shift (if split between two people).
    
    # Let's look at what we need to do.
    # We have `open_shifts` which are the DB objects.
    # We have `assignments` from solver.
    
    # Map original_db_id -> list of assignments
    assignments_by_db_id = {}
    
    for assignment in assignments:
        # We need the solver to pass back the identifier we gave it.
        # In shifts_needed we passed 'id' (index) and 'db_id'.
        # The solver returns 'shift_id' which corresponds to the 'id' we passed.
        
        shift_idx = assignment['shift_id']
        original_shift = shift_id_to_shift[shift_idx]
        db_id = original_shift.id
        
        if db_id not in assignments_by_db_id:
            assignments_by_db_id[db_id] = []
        assignments_by_db_id[db_id].append(assignment)
        
    # Now process each original shift
    for open_shift in open_shifts:
        if open_shift.id in assignments_by_db_id:
            shift_assignments = assignments_by_db_id[open_shift.id]
            
            # Sort assignments by start time
            shift_assignments.sort(key=lambda x: x['start'])
            
            # If there's only one assignment and it matches the time exactly
            if len(shift_assignments) == 1:
                assign = shift_assignments[0]
                if assign['start'] == open_shift.start_time and assign['end'] == open_shift.end_time:
                    # Simple update
                    open_shift.employee_id = assign['employee_id']
                    updated_shifts.append(open_shift)
                    continue
            
            # If we are here, it means we have splits or partial assignment (if we allow that)
            # We will DELETE the original shift and CREATE new ones
            await db.delete(open_shift)
            
            for assign in shift_assignments:
                new_shift = Shift(
                    employee_id=assign['employee_id'],
                    start_time=assign['start'],
                    end_time=assign['end'],
                    role=open_shift.role,
                    is_published=False
                )
                db.add(new_shift)
                # We can't add to updated_shifts yet because it doesn't have an ID
                # We'll collect them to refresh later? 
                # Actually, we can just return the list of all shifts in the range at the end.
                
        else:
            # Shift was not assigned (maybe no availability found for it?)
            # Leave it as is (open)
            updated_shifts.append(open_shift)

    await db.commit()
    
    # Re-fetch all shifts in the range to return the final state
    # This ensures we return valid IDs for new shifts
    final_shifts_result = await db.execute(
        select(Shift).where(
            and_(
                Shift.start_time >= start_date_normalized,
                Shift.start_time <= end_date_normalized,
                or_(
                    Shift.employee_id.in_(employee_ids),
                    Shift.employee_id.is_(None),
                )
            )
        ).order_by(Shift.start_time)
    )
    final_shifts = final_shifts_result.scalars().all()
    
    return [ShiftResponse.model_validate(shift) for shift in final_shifts]


    return [ShiftResponse.model_validate(shift) for shift in updated_shifts]


@router.put("/{shift_id}", response_model=ShiftResponse)
async def update_shift(
    shift_id: int,
    shift_update: ShiftUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> ShiftResponse:
    """Update a shift."""
    result = await db.execute(select(Shift).where(Shift.id == shift_id))
    shift = result.scalar_one_or_none()
    
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
        
    # Update fields if provided
    if shift_update.start_time:
        shift.start_time = shift_update.start_time
    if shift_update.end_time:
        shift.end_time = shift_update.end_time
    if shift_update.role:
        shift.role = shift_update.role
    
    # Handle employee_id update
    # We need to check if employee_id is explicitly set (even to None)
    # Pydantic's model_dump(exclude_unset=True) helps, but here we access fields directly.
    # If the client sends null for employee_id, it means unassign.
    # If the client omits employee_id, it is None in the model default.
    # We need to know if it was sent.
    # For simplicity, let's assume if it's in the request, we update it.
    # But Pydantic v2 `model_dump(exclude_unset=True)` is the way.
    
    update_data = shift_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(shift, key, value)
    
    await db.commit()
    await db.refresh(shift)
    return ShiftResponse.model_validate(shift)


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
    
    # Normalize start_date to beginning of day
    start_date_normalized = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    # Normalize end_date to end of day (23:59:59.999999)
    end_date_normalized = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Delete all shifts in the date range
    conditions = [
        Shift.start_time >= start_date_normalized,
        Shift.start_time <= end_date_normalized,
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
    await db.execute(delete_stmt)
    await db.commit()


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


