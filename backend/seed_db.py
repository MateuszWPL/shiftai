import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.models import Organization, User, UserRole, PlanType, Employee
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and not DATABASE_URL.startswith("postgresql+asyncpg"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Hardcoded hash for "password123"
HASHED_PASSWORD = "$2b$12$4qpULyHOTOa8QcK35WcUr.Ssz4iq6hUkcgnfhrDj3iWWgz57oPVf7u"

async def seed_database():
    print("Seeding database...")
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check if organization exists
        result = await session.execute(text("SELECT id FROM organizations WHERE id = 1"))
        if result.scalar():
            print("Organization 1 already exists.")
            return

        # Create Organization
        org = Organization(
            id=1,
            name="Test Organization",
            plan=PlanType.FREE
        )
        session.add(org)
        await session.flush()

        # Create User
        user = User(
            email="test@example.com",
            hashed_password=HASHED_PASSWORD,
            organization_id=org.id,
            role=UserRole.OWNER
        )
        session.add(user)
        
        # Create Employee
        employee = Employee(
            first_name="Jan",
            last_name="Kowalski",
            email="jan@example.com",
            hourly_rate=20.0,
            max_hours_per_week=40,
            role="Barista",
            organization_id=org.id
        )
        session.add(employee)

        await session.commit()
        print("Database seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_database())
