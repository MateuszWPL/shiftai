"""Manual migration script using asyncpg (same as app)."""
import asyncio
import asyncpg
import os
from app.core.config import settings


async def run_migration():
    """Run migration manually using asyncpg."""
    # Try to get DATABASE_URL from environment or settings
    db_url = os.getenv("DATABASE_URL") or settings.DATABASE_URL
    
    # Try default from START_SERVER.ps1 if not set
    if not db_url:
        db_url = "postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai"
        print(f"Using default DATABASE_URL: {db_url.replace('Loginek12!', '***')}")
    
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        print("Please set DATABASE_URL environment variable or in .env file")
        print("Example: $env:DATABASE_URL='postgresql+asyncpg://postgres:password@localhost/shiftai'")
        return
    
    # Extract connection details from URL
    db_url_clean = db_url.replace("postgresql+asyncpg://", "")
    
    # Parse URL
    if "@" in db_url_clean:
        auth, rest = db_url_clean.split("@", 1)
        if ":" in auth:
            user, password = auth.split(":", 1)
        else:
            user = auth
            password = ""
        
        if "/" in rest:
            host_port, database = rest.split("/", 1)
            if ":" in host_port:
                host, port = host_port.split(":")
                port = int(port)
            else:
                host = host_port
                port = 5432
        else:
            host = rest
            port = 5432
            database = ""
    else:
        print("ERROR: Invalid DATABASE_URL format")
        return
    
    try:
        # Connect to database
        conn = await asyncpg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
        )
        
        print("Connected to database. Running migration...")
        
        # 1. Add EMPLOYEE to UserRole enum
        print("1. Adding EMPLOYEE to UserRole enum...")
        await conn.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum 
                    WHERE enumlabel = 'EMPLOYEE' 
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
                ) THEN
                    ALTER TYPE userrole ADD VALUE 'EMPLOYEE';
                END IF;
            END $$;
        """)
        print("   ✓ EMPLOYEE added to UserRole enum")
        
        # 2. Add user_id column to employees
        print("2. Adding user_id column to employees...")
        await conn.execute("""
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER;
        """)
        await conn.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'fk_employees_user_id'
                ) THEN
                    ALTER TABLE employees ADD CONSTRAINT fk_employees_user_id 
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
                END IF;
            END $$;
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS ix_employees_user_id ON employees(user_id);
        """)
        print("   ✓ user_id column added")
        
        # 3. Create employee_invitations table
        print("3. Creating employee_invitations table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS employee_invitations (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                accepted_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_employee_invitation_employee 
                    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );
        """)
        
        # Create indexes
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_employee_invitation_token 
                ON employee_invitations(token);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_employee_invitation_employee 
                ON employee_invitations(employee_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS ix_employee_invitations_id 
                ON employee_invitations(id);
        """)
        print("   ✓ employee_invitations table created")
        
        # 4. Create enum type for employee invitation status
        print("4. Creating employeeinvitationstatus enum...")
        await conn.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employeeinvitationstatus') THEN
                    CREATE TYPE employeeinvitationstatus AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
                END IF;
            END $$;
        """)
        print("   ✓ Enum created")
        
        # Update alembic version
        print("5. Updating Alembic version...")
        await conn.execute("""
            INSERT INTO alembic_version (version_num)
            VALUES ('bb46dab5dbfb')
            ON CONFLICT (version_num) DO NOTHING;
        """)
        print("   ✓ Alembic version updated")
        
        await conn.close()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(run_migration())

