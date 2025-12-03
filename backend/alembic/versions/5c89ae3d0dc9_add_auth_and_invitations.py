"""add_auth_and_invitations

Revision ID: 5c89ae3d0dc9
Revises: 4c5d6e7f8a9b
Create Date: 2025-12-03 20:21:32.493162

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c89ae3d0dc9'
down_revision: Union[str, Sequence[str], None] = '4c5d6e7f8a9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add full_name column to users table
    op.add_column('users', sa.Column('full_name', sa.String(length=255), nullable=True))
    
    # Make organization_id nullable in users table
    op.alter_column('users', 'organization_id',
                    existing_type=sa.Integer(),
                    nullable=True)
    
    # Create invitations table
    op.create_table('invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('invited_by_user_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'ACCEPTED', 'EXPIRED', name='invitationstatus'), nullable=False, server_default='PENDING'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_invitation_org_email', 'invitations', ['organization_id', 'email'], unique=False)
    op.create_index('idx_invitation_token', 'invitations', ['token'], unique=True)
    op.create_index(op.f('ix_invitations_id'), 'invitations', ['id'], unique=False)
    op.create_index(op.f('ix_invitations_email'), 'invitations', ['email'], unique=False)
    op.create_index(op.f('ix_invitations_organization_id'), 'invitations', ['organization_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop invitations table
    op.drop_index(op.f('ix_invitations_organization_id'), table_name='invitations')
    op.drop_index(op.f('ix_invitations_email'), table_name='invitations')
    op.drop_index(op.f('ix_invitations_id'), table_name='invitations')
    op.drop_index('idx_invitation_token', table_name='invitations')
    op.drop_index('idx_invitation_org_email', table_name='invitations')
    op.drop_table('invitations')
    
    # Revert organization_id to NOT NULL (this might fail if there are NULL values)
    op.alter_column('users', 'organization_id',
                    existing_type=sa.Integer(),
                    nullable=False)
    
    # Remove full_name column
    op.drop_column('users', 'full_name')
