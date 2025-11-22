"""Application dependencies."""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Database setup
Base = declarative_base()

# Engine and session factory (will be initialized in startup)
engine = None
async_session_maker = None


async def init_db() -> None:
    """Initialize database connection."""
    global engine, async_session_maker
    if not settings.DATABASE_URL:
        print("[ERROR] DATABASE_URL is not set! Please set the DATABASE_URL environment variable.")
        print("[INFO] Example: $env:DATABASE_URL='postgresql+asyncpg://postgres:password@localhost/shiftai'")
        return
    
    # Ensure we're using asyncpg driver
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif not db_url.startswith("postgresql+asyncpg://"):
        db_url = f"postgresql+asyncpg://{db_url}"
    
    print(f"[DB] Initializing database connection...")
    print(f"[DB] Database URL: {db_url.split('@')[0]}@***")  # Hide password
    
    engine = create_async_engine(
        db_url,
        echo=False
    )
    async_session_maker = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    print("[DB] Database initialized successfully!")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database session."""
    if async_session_maker is None:
        error_msg = (
            "Database not initialized. "
            "Please set DATABASE_URL environment variable and restart the server. "
            f"Example: $env:DATABASE_URL='postgresql+asyncpg://postgres:password@localhost/shiftai'"
        )
        print(f"[ERROR] {error_msg}")
        raise RuntimeError(error_msg)
    async with async_session_maker() as session:
        yield session

