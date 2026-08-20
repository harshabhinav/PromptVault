"""Initial schema

Revision ID: 771cd9e86f59
Revises: 
Create Date: 2026-08-20 21:42:38.637201

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '771cd9e86f59'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'user',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)

    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_verification_tokens_token_hash'), 'email_verification_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_email_verification_tokens_user_id'), 'email_verification_tokens', ['user_id'], unique=False)

    op.create_table(
        'blueprint',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('forked_from', sa.Integer(), nullable=True),
        sa.Column('is_pinned', sa.Boolean(), nullable=False),
        sa.Column('pinned_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['forked_from'], ['blueprint.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'version',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('blueprint_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=True),
        sa.Column('system_prompt', sa.String(), nullable=False),
        sa.Column('user_prompt', sa.String(), nullable=True),
        sa.Column('parameters_json', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['blueprint_id'], ['blueprint.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'comparison',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('blueprint_id', sa.Integer(), nullable=False),
        sa.Column('version_a_id', sa.Integer(), nullable=False),
        sa.Column('version_b_id', sa.Integer(), nullable=False),
        sa.Column('comparison_type', sa.String(), nullable=False),
        sa.Column('branch_a', sa.String(), nullable=True),
        sa.Column('branch_b', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'testcase',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('blueprint_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('input_text', sa.String(), nullable=False),
        sa.Column('expected_behavior', sa.String(), nullable=True),
        sa.Column('last_status', sa.String(), nullable=True),
        sa.Column('last_latency', sa.Float(), nullable=True),
        sa.Column('last_run_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['blueprint_id'], ['blueprint.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('testcase')
    op.drop_table('comparison')
    op.drop_table('version')
    op.drop_table('blueprint')
    op.drop_table('email_verification_tokens')
    op.drop_table('user')
