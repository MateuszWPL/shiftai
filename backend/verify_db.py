"""Verify database tables were created."""
import psycopg2
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:Loginek12!@localhost/shiftai")
# Convert asyncpg URL to sync URL
db_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    
    tables = [row[0] for row in cur.fetchall()]
    
    print("[OK] Database connection successful!")
    print(f"\nTables created ({len(tables)}):")
    for table in tables:
        print(f"  - {table}")
    
    # Check for expected tables
    expected_tables = ['organizations', 'users', 'employees', 'availabilities', 'shifts']
    missing = [t for t in expected_tables if t not in tables]
    
    if missing:
        print(f"\n[WARNING] Missing tables: {missing}")
    else:
        print("\n[OK] All expected tables are present!")
    
    conn.close()
except Exception as e:
    print(f"[ERROR] {e}")

