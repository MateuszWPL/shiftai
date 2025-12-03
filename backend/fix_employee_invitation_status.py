"""Fix employee_invitations.status column to use enum."""
import asyncio
import asyncpg
import os
from app.core.config import settings


async def fix_status_column():
    """Fix status column to use enum type."""
    # Try to get DATABASE_URL from environment or settings
    db_url = os.getenv("DATABASE_URL") or settings.DATABASE_URL
    
    # Try default from START_SERVER.ps1 if not set
    if not db_url:
        db_url = "postgresql+asyncpg://postgres:Loginek12!@localhost/shiftai"
        print(f"Using default DATABASE_URL: {db_url.replace('Loginek12!', '***')}")
    
    if not db_url:
        print("ERROR: DATABASE_URL not set")
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
        
        print("Connected to database. Fixing status column...")
        
        # Check current column type
        result = await conn.fetchrow("""
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'employee_invitations' 
            AND column_name = 'status'
        """)
        
        if result and result['data_type'] == 'character varying':
            print("Status column is VARCHAR, converting to enum...")
            
            # Step 1: Create a temporary column with enum type
            await conn.execute("""
                ALTER TABLE employee_invitations 
                ADD COLUMN status_new employeeinvitationstatus;
            """)
            
            # Step 2: Copy data with casting
            await conn.execute("""
                UPDATE employee_invitations 
                SET status_new = status::employeeinvitationstatus;
            """)
            
            # Step 3: Drop old column
            await conn.execute("""
                ALTER TABLE employee_invitations 
                DROP COLUMN status;
            """)
            
            # Step 4: Rename new column
            await conn.execute("""
                ALTER TABLE employee_invitations 
                RENAME COLUMN status_new TO status;
            """)
            
            # Step 5: Set NOT NULL and default
            await conn.execute("""
                ALTER TABLE employee_invitations 
                ALTER COLUMN status SET NOT NULL,
                ALTER COLUMN status SET DEFAULT 'PENDING'::employeeinvitationstatus;
            """)
            
            print("✅ Status column converted to enum")
        else:
            print("Status column is already enum or doesn't exist")
        
        await conn.close()
        print("\n✅ Fix completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Fix failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(fix_status_column())

