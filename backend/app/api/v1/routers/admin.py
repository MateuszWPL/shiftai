"""Admin and utility endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from typing import Dict, Any

from app.core.dependencies import get_db
from app.models.swap_requests import SwapRequest
from app.models.shift import Shift
from app.models.schedule import Schedule
from app.models.requirements import Requirements
from app.models.availability import Availability

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.delete("/reset-scheduling", status_code=status.HTTP_200_OK)
async def reset_scheduling_data(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Reset all scheduling data (schedules, shifts, requirements, availability, swap requests).
    
    This will delete:
    - All swap requests
    - All shifts
    - All schedules
    - All requirements
    - All availability entries
    
    WARNING: This action cannot be undone. Users and employees are preserved.
    """
    try:
        # Delete in order to respect foreign key constraints
        # 1. Swap requests (references shifts)
        swap_result = await db.execute(delete(SwapRequest))
        swap_count = swap_result.rowcount
        
        # 2. Shifts (references schedules and employees)
        shift_result = await db.execute(delete(Shift))
        shift_count = shift_result.rowcount
        
        # 3. Schedules (references organizations)
        schedule_result = await db.execute(delete(Schedule))
        schedule_count = schedule_result.rowcount
        
        # 4. Requirements (references organizations)
        req_result = await db.execute(delete(Requirements))
        req_count = req_result.rowcount
        
        # 5. Availability (references employees)
        avail_result = await db.execute(delete(Availability))
        avail_count = avail_result.rowcount
        
        await db.commit()
        
        return {
            "message": "Wszystkie dane grafiku zostały usunięte",
            "deleted": {
                "swap_requests": swap_count,
                "shifts": shift_count,
                "schedules": schedule_count,
                "requirements": req_count,
                "availabilities": avail_count,
            }
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Błąd podczas resetowania danych: {str(e)}"
        )


@router.delete("/reset-all", status_code=status.HTTP_200_OK)
async def reset_all_data(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Reset ALL data including employees (but keep users and organizations).
    
    WARNING: This is a complete reset. Only users and organizations remain.
    """
    try:
        # Delete in order to respect foreign key constraints
        # 1. Swap requests
        await db.execute(delete(SwapRequest))
        
        # 2. Shifts
        await db.execute(delete(Shift))
        
        # 3. Schedules
        await db.execute(delete(Schedule))
        
        # 4. Requirements
        await db.execute(delete(Requirements))
        
        # 5. Availability
        await db.execute(delete(Availability))
        
        # 6. Employees (this will cascade delete related data)
        from app.models.employee import Employee
        emp_result = await db.execute(delete(Employee))
        emp_count = emp_result.rowcount
        
        await db.commit()
        
        return {
            "message": "Wszystkie dane zostały usunięte (zachowano użytkowników i organizacje)",
            "deleted_employees": emp_count
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Błąd podczas resetowania danych: {str(e)}"
        )

