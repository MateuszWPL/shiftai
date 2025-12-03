"""add_employee_invitations_and_user_link

Revision ID: bb46dab5dbfb
Revises: 5c89ae3d0dc9
Create Date: 2025-12-03 22:51:56.650885

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb46dab5dbfb'
down_revision: Union[str, Sequence[str], None] = '5c89ae3d0dc9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add EMPLOYEE to UserRole enum
    # Note: We use a DO block to check if value exists first
    op.execute("""
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
    
    # Add user_id column to employees table
    op.add_column('employees', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_employees_user_id',
        'employees', 'users',
        ['user_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index(op.f('ix_employees_user_id'), 'employees', ['user_id'], unique=False)
    
    # Create employee_invitations table
    op.create_table('employee_invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'ACCEPTED', 'EXPIRED', name='employeeinvitationstatus'), nullable=False, server_default='PENDING'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_employee_invitation_token', 'employee_invitations', ['token'], unique=True)
    op.create_index('idx_employee_invitation_employee', 'employee_invitations', ['employee_id'], unique=False)
    op.create_index(op.f('ix_employee_invitations_id'), 'employee_invitations', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop employee_invitations table
    op.drop_index(op.f('ix_employee_invitations_id'), table_name='employee_invitations')
    op.drop_index('idx_employee_invitation_employee', table_name='employee_invitations')
    op.drop_index('idx_employee_invitation_token', table_name='employee_invitations')
    op.drop_table('employee_invitations')
    
    # Drop user_id column from employees
    op.drop_index(op.f('ix_employees_user_id'), table_name='employees')
    op.drop_constraint('fk_employees_user_id', 'employees', type_='foreignkey')
    op.drop_column('employees', 'user_id')
    
    # Note: Cannot remove enum value in PostgreSQL, so we leave EMPLOYEE in the enum
