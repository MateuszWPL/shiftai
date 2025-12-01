"""SwapRequests router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.dependencies import get_db
from app.models.swap_requests import SwapRequest, SwapStatus
from app.models.shift import Shift
from app.models.employee import Employee
from app.schemas.swaps import SwapRequestCreate, SwapRequestResponse, SwapRequestUpdate

router = APIRouter(prefix="/swaps", tags=["SwapRequests"])


@router.post("/", response_model=SwapRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_swap_request(
    request: SwapRequestCreate,
    db: AsyncSession = Depends(get_db),
) -> SwapRequestResponse:
    """Create a new swap request."""
    # Verify shift exists
    shift_result = await db.execute(select(Shift).where(Shift.id == request.from_shift_id))
    shift = shift_result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
        
    # Verify employees exist
    from_emp_result = await db.execute(select(Employee).where(Employee.id == request.from_employee_id))
    from_emp = from_emp_result.scalar_one_or_none()
    if not from_emp:
        raise HTTPException(status_code=404, detail="Requesting employee not found")
        
    to_emp_result = await db.execute(select(Employee).where(Employee.id == request.to_employee_id))
    to_emp = to_emp_result.scalar_one_or_none()
    if not to_emp:
        raise HTTPException(status_code=404, detail="Target employee not found")
    
    # Check if swap already exists (pending)
    existing_result = await db.execute(
        select(SwapRequest).where(
            SwapRequest.from_shift_id == request.from_shift_id,
            SwapRequest.from_employee_id == request.from_employee_id,
            SwapRequest.to_employee_id == request.to_employee_id,
            SwapRequest.status == SwapStatus.PENDING
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Pending swap request already exists")
        
    db_swap = SwapRequest(
        from_shift_id=request.from_shift_id,
        from_employee_id=request.from_employee_id,
        to_employee_id=request.to_employee_id,
        status=SwapStatus.PENDING,
    )
    db.add(db_swap)
    await db.commit()
    await db.refresh(db_swap)
    
    return SwapRequestResponse.model_validate(db_swap)


@router.put("/{swap_id}", response_model=SwapRequestResponse)
async def update_swap_status(
    swap_id: int,
    update: SwapRequestUpdate,
    db: AsyncSession = Depends(get_db),
) -> SwapRequestResponse:
    """Update swap request status (Accept/Decline)."""
    result = await db.execute(select(SwapRequest).where(SwapRequest.id == swap_id))
    swap = result.scalar_one_or_none()
    
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
        
    if swap.status != SwapStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only update pending swap requests")
        
    swap.status = update.status
    
    if update.status == SwapStatus.ACCEPTED:
        # Execute the swap
        shift_result = await db.execute(select(Shift).where(Shift.id == swap.from_shift_id))
        shift = shift_result.scalar_one_or_none()
        
        if shift:
            # Assign shift to the target employee
            shift.employee_id = swap.to_employee_id
            # Note: We might want to check if target employee is already busy, but for MVP we trust the swap.
            # Or we could check overlap.
            
    await db.commit()
    await db.refresh(swap)
    return SwapRequestResponse.model_validate(swap)


@router.get("/", response_model=List[SwapRequestResponse])
async def get_swap_requests(
    employee_id: int = Query(..., gt=0, description="Employee ID"),
    db: AsyncSession = Depends(get_db),
) -> List[SwapRequestResponse]:
    """Get swap requests for an employee (sent or received)."""
    result = await db.execute(
        select(SwapRequest).where(
            or_(
                SwapRequest.from_employee_id == employee_id,
                SwapRequest.to_employee_id == employee_id,
            )
        )
    )
    swaps = result.scalars().all()
    
    return [SwapRequestResponse.model_validate(s) for s in swaps]
