"""Helper script to create initial migration without database connection."""
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

def create_initial_migration():
    """Create initial migration file manually."""
    alembic_cfg = Config("alembic.ini")
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    
    # Create revision
    revision = command.revision(
        alembic_cfg,
        message="Initial migration",
        autogenerate=False,
        head=None,
    )
    
    if revision:
        print(f"\n✓ Created migration: {revision}")
        print("\nNext steps:")
        print("1. Edit the migration file in alembic/versions/")
        print("2. Add your table creation statements")
        print("3. Or set up PostgreSQL and use: alembic revision --autogenerate -m 'Initial migration'")
    else:
        print("Failed to create migration")

if __name__ == "__main__":
    create_initial_migration()

