"""Schedules router."""
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.dependencies import get_db
from app.models.schedule import Schedule
from app.models.requirements import Requirements
from app.models.organization import Organization
from app.models.employee import Employee
from app.models.availability import Availability
from app.models.shift import Shift
from app.schemas.shift import ShiftResponse
from app.services.solver import ShiftSolver

router = APIRouter(prefix="/schedules", tags=["Schedules"])


@router.post("/generate", response_model=List[ShiftResponse], status_code=status.HTTP_201_CREATED)
async def generate_schedule(
    organization_id: int = Query(..., gt=0, description="Organization ID"),
    week_start_date: datetime = Query(..., description="Week start date (Monday, UTC)"),
    db: AsyncSession = Depends(get_db),
) -> List[ShiftResponse]:
    """
    Generate schedule from Requirements.
    
    Workflow:
    1. Read Requirements for the week
    2. Convert Requirements to shifts_needed for solver
    3. Run OR-Tools solver
    4. Create Shifts with assignments (or Open Shifts if no employee available)
    5. Create/update Schedule record
    """
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
    
    # Normalize week_start_date to Monday 00:00:00 UTC
    if week_start_date.tzinfo is None:
        week_start_utc = week_start_date.replace(tzinfo=timezone.utc)
    else:
        week_start_utc = week_start_date.astimezone(timezone.utc)
    
    week_start_normalized = week_start_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end_normalized = week_start_normalized + timedelta(days=7)
    
    # Step 1: Fetch Requirements for this week
    requirements_result = await db.execute(
        select(Requirements).where(
            and_(
                Requirements.organization_id == organization_id,
                Requirements.week_start_date == week_start_normalized.date(),
            )
        )
    )
    requirements = requirements_result.scalars().all()
    
    if not requirements:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No requirements found for week starting {week_start_normalized.date()}. Please add requirements first."
        )
    
    # Step 2: Convert Requirements to shifts_needed for solver
    shifts_needed = []
    shift_id_to_role = {}  # Map shift_id (int) to role for later use
    shift_id_to_req_id = {}  # Map shift_id (int) to requirement_id
    shift_counter = 0
    for req in requirements:
        # Calculate target date = week_start_date + day_of_week
        target_date = week_start_normalized + timedelta(days=req.day_of_week)
        
        # Combine date with time
        start_datetime = datetime.combine(
            target_date.date(),
            req.start_time
        ).replace(tzinfo=timezone.utc)
        
        end_datetime = datetime.combine(
            target_date.date(),
            req.end_time
        ).replace(tzinfo=timezone.utc)
        
        # Handle overnight shifts (end_time < start_time means next day)
        if req.end_time < req.start_time:
            end_datetime = end_datetime + timedelta(days=1)
        
        # Create one shift entry per headcount
        for i in range(req.headcount):
            shift_id = shift_counter
            shifts_needed.append({
                'id': shift_id,
                'start': start_datetime,
                'end': end_datetime,
                'role': req.position_name,
                'requirement_id': req.id,
            })
            shift_id_to_role[shift_id] = req.position_name
            shift_id_to_req_id[shift_id] = req.id
            shift_counter += 1
    
    if not shifts_needed:
        return []
    
    # Step 3: Fetch employees and their availability
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
    min_start = min(s['start'] for s in shifts_needed)
    max_end = max(s['end'] for s in shifts_needed)
    
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
                f"within the date range {min_start.date()} to {max_end.date()}. "
                "Please add availability slots for employees."
            )
        )
    
    # Step 4: Run solver
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
            f"{len(shifts_needed)} shifts needed. "
            "Check that employees have sufficient availability and correct roles."
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Step 5: Get or create Schedule
    schedule_result = await db.execute(
        select(Schedule).where(
            and_(
                Schedule.organization_id == organization_id,
                Schedule.week_start_date == week_start_normalized.date(),
            )
        )
    )
    schedule = schedule_result.scalar_one_or_none()
    
    if not schedule:
        schedule = Schedule(
            organization_id=organization_id,
            week_start_date=week_start_normalized.date(),
            is_published=False,
        )
        db.add(schedule)
        await db.flush()
    
    # Step 6: Delete existing shifts for this schedule (if regenerating)
    existing_shifts_result = await db.execute(
        select(Shift).where(Shift.schedule_id == schedule.id)
    )
    existing_shifts = existing_shifts_result.scalars().all()
    for shift in existing_shifts:
        await db.delete(shift)
    
    await db.flush()
    
    # Step 7: Create Shifts from solver assignments
    created_shifts = []
    
    # Group assignments by requirement_id to handle headcount
    assignments_by_req = {}
    for assign in assignments:
        shift_id = assign['shift_id']
        req_id = shift_id_to_req_id.get(shift_id)
        
        if req_id not in assignments_by_req:
            assignments_by_req[req_id] = []
        assignments_by_req[req_id].append(assign)
    
    # Create shifts from assignments
    for assign in assignments:
        # Get role from shift_id mapping
        shift_id = assign['shift_id']
        role = shift_id_to_role.get(shift_id, '')
        
        db_shift = Shift(
            schedule_id=schedule.id,
            employee_id=assign['employee_id'],
            start_time=assign['start'],
            end_time=assign['end'],
            role=role,
            is_published=False,
        )
        db.add(db_shift)
        created_shifts.append(db_shift)
    
    # Step 8: Create Open Shifts for unassigned requirements
    # Check which requirements had fewer assignments than headcount
    for req in requirements:
        req_assignments = assignments_by_req.get(req.id, [])
        assigned_count = len(req_assignments)
        
        if assigned_count < req.headcount:
            # Create open shifts for missing headcount
            target_date = week_start_normalized + timedelta(days=req.day_of_week)
            start_datetime = datetime.combine(
                target_date.date(),
                req.start_time
            ).replace(tzinfo=timezone.utc)
            
            end_datetime = datetime.combine(
                target_date.date(),
                req.end_time
            ).replace(tzinfo=timezone.utc)
            
            if req.end_time < req.start_time:
                end_datetime = end_datetime + timedelta(days=1)
            
            for _ in range(req.headcount - assigned_count):
                open_shift = Shift(
                    schedule_id=schedule.id,
                    employee_id=None,  # Open shift
                    start_time=start_datetime,
                    end_time=end_datetime,
                    role=req.position_name,
                    is_published=False,
                )
                db.add(open_shift)
                created_shifts.append(open_shift)
    
    await db.commit()
    
    # Refresh to get IDs
    for shift in created_shifts:
        await db.refresh(shift)
    
    return [ShiftResponse.model_validate(shift) for shift in created_shifts]

