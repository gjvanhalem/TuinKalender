"""add garden photos table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-05 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gardenphoto',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('garden_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('taken_at', sa.DateTime(), nullable=False),
        sa.Column('ai_analysis', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['garden_id'], ['garden.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gardenphoto_garden_id', 'gardenphoto', ['garden_id'])


def downgrade() -> None:
    op.drop_index('ix_gardenphoto_garden_id', table_name='gardenphoto')
    op.drop_table('gardenphoto')
