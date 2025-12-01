import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from alembic.config import Config
from alembic import command
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and not DATABASE_URL.startswith("postgresql+asyncpg"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

async def reset_database():
    print("Resetting database...")
    engine = create_async_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")
    
    async with engine.connect() as conn:
        # Terminate other connections to allow dropping the schema
        await conn.execute(text("""
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = current_database() 
            AND pid <> pg_backend_pid();
        """))
        
        # Drop and recreate public schema
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        print("Database schema reset.")

    # Run Alembic migrations
    print("Running migrations...")
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    print("Migrations complete.")

if __name__ == "__main__":
    asyncio.run(reset_database())
