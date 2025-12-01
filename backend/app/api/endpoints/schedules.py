from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db
from app.services.solver import SolverService
from pydantic import BaseModel
from datetime import date

router = APIRouter()

class GenerateScheduleRequest(BaseModel):
    team_id: int
    week_start_date: date

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_schedule(
    request: GenerateScheduleRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a schedule for a specific team and week.
    """
    solver = SolverService(db)
    schedule_id = await solver.generate_schedule(request.team_id, request.week_start_date)
    
    if not schedule_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie udało się wygenerować grafiku. Sprawdź dostępność pracowników i zapotrzebowanie."
        )
    
    return {"schedule_id": schedule_id, "message": "Grafik został wygenerowany pomyślnie."}
