"""add weekly summary to user

Revision ID: 648de1923e9c
Revises: b2c3d4e5f6a7
Create Date: 2026-05-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '648de1923e9c'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('receive_weekly_summary', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('user', 'receive_weekly_summary')
