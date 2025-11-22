"""Make shift employee_id nullable for open shifts

Revision ID: 2a3b4c5d6e7f
Revises: 1346ab535307
Create Date: 2025-01-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a3b4c5d6e7f'
down_revision: Union[str, Sequence[str], None] = '1346ab535307'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Make employee_id nullable to support open shifts
    op.alter_column('shifts', 'employee_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Before making nullable=False, we need to ensure no NULL values exist
    # Set a default employee_id for any NULL values (or delete them)
    # For safety, we'll raise an error if NULLs exist
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM shifts WHERE employee_id IS NULL) THEN
                RAISE EXCEPTION 'Cannot downgrade: NULL employee_id values exist in shifts table';
            END IF;
        END $$;
    """)
    op.alter_column('shifts', 'employee_id',
                    existing_type=sa.Integer(),
                    nullable=False)

