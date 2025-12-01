import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and not DATABASE_URL.startswith("postgresql+asyncpg"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

async def check_version():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        try:
            result = await conn.execute(text("SELECT version_num FROM alembic_version;"))
            version = result.scalar()
            print(f"Alembic version: {version}")
        except Exception as e:
            print(f"Error reading alembic version: {e}")

if __name__ == "__main__":
    asyncio.run(check_version())
