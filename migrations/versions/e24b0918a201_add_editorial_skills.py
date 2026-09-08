"""Add independently managed skills without altering project technologies.

Revision ID: e24b0918a201
Revises: b7dbc486f555
"""
from alembic import op
import sqlalchemy as sa

revision = "e24b0918a201"
down_revision = "b7dbc486f555"
branch_labels = None
depends_on = None


def upgrade():
    # Development may have already created the table through AUTO_SEED.
    if "skills" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "skills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("description", sa.String(360), nullable=False),
        sa.Column("icon", sa.String(100), nullable=False),
        sa.Column("icon_type", sa.String(20), nullable=False),
        sa.Column("accent_color", sa.String(7), nullable=False),
        sa.Column("emoji", sa.String(32), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_skills_slug", "skills", ["slug"], unique=True)
    op.create_index("ix_skills_active_order", "skills", ["is_active", "display_order"])
    op.create_index("uq_skills_name_lower", "skills", [sa.text("lower(name)")], unique=True)


def downgrade():
    op.drop_index("uq_skills_name_lower", table_name="skills")
    op.drop_index("ix_skills_active_order", table_name="skills")
    op.drop_index("ix_skills_slug", table_name="skills")
    op.drop_table("skills")
    op.execute("DELETE FROM site_settings WHERE key = 'skills_v2_initialized'")
