"""add plant photos table

Revision ID: a1b2c3d4e5f6
Revises: c10f2929c958
Create Date: 2026-05-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'c10f2929c958'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'plantphoto',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plant_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('taken_at', sa.DateTime(), nullable=False),
        sa.Column('ai_analysis', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['plant_id'], ['plant.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_plantphoto_plant_id', 'plantphoto', ['plant_id'])


def downgrade() -> None:
    op.drop_index('ix_plantphoto_plant_id', table_name='plantphoto')
    op.drop_table('plantphoto')
