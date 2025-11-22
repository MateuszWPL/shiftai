from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.dependencies import init_db, async_session_maker
from app.api.v1.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Workforce Management SaaS for SMBs",
    version="0.1.0"
)

# CORS middleware
print(f"[CORS] Allowing origins: {settings.CORS_ORIGINS}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize application on startup."""
    print("[STARTUP] Initializing application...")
    await init_db()
    if async_session_maker is None:
        print("[WARNING] Database was not initialized! API endpoints will fail.")
    else:
        print("[STARTUP] Application startup complete.")


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "message": "ShiftAI API",
        "version": "0.1.0"
    }

