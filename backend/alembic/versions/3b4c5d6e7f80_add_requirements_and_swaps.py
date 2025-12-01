"""Add requirements and swap_requests models

Revision ID: 3b4c5d6e7f80
Revises: 2a3b4c5d6e7f
Create Date: 2025-12-01 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b4c5d6e7f80'
down_revision: Union[str, Sequence[str], None] = '2a3b4c5d6e7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create requirements table
    op.create_table('requirements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('week_start_date', sa.Date(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('position_name', sa.String(length=100), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('headcount', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_req_org_week', 'requirements', ['organization_id', 'week_start_date'], unique=False)
    op.create_index(op.f('ix_requirements_id'), 'requirements', ['id'], unique=False)
    op.create_index(op.f('ix_requirements_organization_id'), 'requirements', ['organization_id'], unique=False)

    # Create swap_requests table
    # Note: Enum type needs to be handled carefully if using PostgreSQL ENUM type
    # But here we can use String for simplicity in migration or create the type
    # SQLAlchemy usually handles Enum creation if using sa.Enum(name='...')
    
    # We need to define the enum type first for Postgres
    swap_status_enum = sa.Enum('pending', 'accepted', 'declined', name='swapstatus')
    
    op.create_table('swap_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('from_shift_id', sa.Integer(), nullable=False),
        sa.Column('from_employee_id', sa.Integer(), nullable=False),
        sa.Column('to_employee_id', sa.Integer(), nullable=False),
        sa.Column('status', swap_status_enum, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['from_employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['from_shift_id'], ['shifts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['to_employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_swap_status_from', 'swap_requests', ['status', 'from_employee_id'], unique=False)
    op.create_index('idx_swap_status_to', 'swap_requests', ['status', 'to_employee_id'], unique=False)
    op.create_index(op.f('ix_swap_requests_from_employee_id'), 'swap_requests', ['from_employee_id'], unique=False)
    op.create_index(op.f('ix_swap_requests_from_shift_id'), 'swap_requests', ['from_shift_id'], unique=False)
    op.create_index(op.f('ix_swap_requests_id'), 'swap_requests', ['id'], unique=False)
    op.create_index(op.f('ix_swap_requests_status'), 'swap_requests', ['status'], unique=False)
    op.create_index(op.f('ix_swap_requests_to_employee_id'), 'swap_requests', ['to_employee_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_swap_requests_to_employee_id'), table_name='swap_requests')
    op.drop_index(op.f('ix_swap_requests_status'), table_name='swap_requests')
    op.drop_index(op.f('ix_swap_requests_id'), table_name='swap_requests')
    op.drop_index(op.f('ix_swap_requests_from_shift_id'), table_name='swap_requests')
    op.drop_index(op.f('ix_swap_requests_from_employee_id'), table_name='swap_requests')
    op.drop_index('idx_swap_status_to', table_name='swap_requests')
    op.drop_index('idx_swap_status_from', table_name='swap_requests')
    op.drop_table('swap_requests')
    
    # Drop enum type
    sa.Enum(name='swapstatus').drop(op.get_bind())
    
    op.drop_index(op.f('ix_requirements_organization_id'), table_name='requirements')
    op.drop_index(op.f('ix_requirements_id'), table_name='requirements')
    op.drop_index('idx_req_org_week', table_name='requirements')
    op.drop_table('requirements')
