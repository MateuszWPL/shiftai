"""Add schedules table and schedule_id to shifts

Revision ID: 4c5d6e7f8a9b
Revises: 3b4c5d6e7f80
Create Date: 2025-12-01 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c5d6e7f8a9b'
down_revision: Union[str, Sequence[str], None] = '3b4c5d6e7f80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create schedules table
    op.create_table('schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('week_start_date', sa.Date(), nullable=False),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_schedule_org_week', 'schedules', ['organization_id', 'week_start_date'], unique=False)
    op.create_index(op.f('ix_schedules_id'), 'schedules', ['id'], unique=False)
    op.create_index(op.f('ix_schedules_organization_id'), 'schedules', ['organization_id'], unique=False)
    
    # Add schedule_id column to shifts table (nullable for existing records)
    op.add_column('shifts', sa.Column('schedule_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_shifts_schedule_id',
        'shifts', 'schedules',
        ['schedule_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index(op.f('ix_shifts_schedule_id'), 'shifts', ['schedule_id'], unique=False)


def downgrade() -> None:
    # Remove schedule_id from shifts
    op.drop_index(op.f('ix_shifts_schedule_id'), table_name='shifts')
    op.drop_constraint('fk_shifts_schedule_id', 'shifts', type_='foreignkey')
    op.drop_column('shifts', 'schedule_id')
    
    # Drop schedules table
    op.drop_index(op.f('ix_schedules_organization_id'), table_name='schedules')
    op.drop_index(op.f('ix_schedules_id'), table_name='schedules')
    op.drop_index('idx_schedule_org_week', table_name='schedules')
    op.drop_table('schedules')

