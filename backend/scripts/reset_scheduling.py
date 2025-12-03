"""Script to reset all scheduling data from the database."""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import delete

from app.core.config import Settings
from app.models.swap_requests import SwapRequest
from app.models.shift import Shift
from app.models.schedule import Schedule
from app.models.requirements import Requirements
from app.models.availability import Availability


async def reset_scheduling_data() -> None:
    """Reset all scheduling data."""
    settings = Settings.from_env()
    
    if not settings.DATABASE_URL:
        print("[ERROR] DATABASE_URL is not set!")
        print("[INFO] Example: $env:DATABASE_URL='postgresql+asyncpg://postgres:password@localhost/shiftai'")
        sys.exit(1)
    
    # Ensure we're using asyncpg driver
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif not db_url.startswith("postgresql+asyncpg://"):
        db_url = f"postgresql+asyncpg://{db_url}"
    
    print(f"[DB] Connecting to database...")
    engine = create_async_engine(db_url, echo=False)
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_maker() as session:
        try:
            print("[RESET] Starting reset of scheduling data...")
            
            # Delete in order to respect foreign key constraints
            # 1. Swap requests
            print("[RESET] Deleting swap requests...")
            swap_result = await session.execute(delete(SwapRequest))
            swap_count = swap_result.rowcount
            print(f"[RESET] Deleted {swap_count} swap requests")
            
            # 2. Shifts
            print("[RESET] Deleting shifts...")
            shift_result = await session.execute(delete(Shift))
            shift_count = shift_result.rowcount
            print(f"[RESET] Deleted {shift_count} shifts")
            
            # 3. Schedules
            print("[RESET] Deleting schedules...")
            schedule_result = await session.execute(delete(Schedule))
            schedule_count = schedule_result.rowcount
            print(f"[RESET] Deleted {schedule_count} schedules")
            
            # 4. Requirements
            print("[RESET] Deleting requirements...")
            req_result = await session.execute(delete(Requirements))
            req_count = req_result.rowcount
            print(f"[RESET] Deleted {req_count} requirements")
            
            # 5. Availability
            print("[RESET] Deleting availability entries...")
            avail_result = await session.execute(delete(Availability))
            avail_count = avail_result.rowcount
            print(f"[RESET] Deleted {avail_count} availability entries")
            
            await session.commit()
            
            print("\n[SUCCESS] Reset completed successfully!")
            print(f"Summary:")
            print(f"  - Swap requests: {swap_count}")
            print(f"  - Shifts: {shift_count}")
            print(f"  - Schedules: {schedule_count}")
            print(f"  - Requirements: {req_count}")
            print(f"  - Availabilities: {avail_count}")
            print("\n[INFO] Users and employees are preserved.")
            
        except Exception as e:
            await session.rollback()
            print(f"[ERROR] Failed to reset data: {str(e)}")
            sys.exit(1)
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_scheduling_data())

