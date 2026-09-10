"""Add admin-managed certificates.

Revision ID: c91a7f4d2b63
Revises: e24b0918a201
"""
from alembic import op
import sqlalchemy as sa


revision = "c91a7f4d2b63"
down_revision = "e24b0918a201"
branch_labels = None
depends_on = None


def upgrade():
    if "certificates" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "certificates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("issuer", sa.String(180), nullable=False),
        sa.Column("description", sa.String(600), nullable=False, server_default=""),
        sa.Column("credential_id", sa.String(255)),
        sa.Column("credential_url", sa.String(500)),
        sa.Column("issued_date", sa.Date(), nullable=False),
        sa.Column("expiry_date", sa.Date()),
        sa.Column("image_url", sa.String(500)),
        sa.Column("image_public_id", sa.String(255)),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_certificates_public_order",
        "certificates",
        ["is_active", "display_order", "issued_date"],
    )


def downgrade():
    op.drop_index("ix_certificates_public_order", table_name="certificates")
    op.drop_table("certificates")
