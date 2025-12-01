"""Main API v1 router."""
from fastapi import APIRouter
from app.api.v1 import health
from app.api.v1.routers import employees, organizations, shifts
from app.api.endpoints import schedules

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(organizations.router)
api_router.include_router(employees.router)
api_router.include_router(shifts.router)
api_router.include_router(schedules.router, prefix="/schedules", tags=["Schedules"])

