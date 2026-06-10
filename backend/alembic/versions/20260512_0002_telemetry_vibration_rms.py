"""Añade vibración (RMS) a telemetría para sensores / tarjeta de adquisición.

Revision ID: 20260512_0002
Revises: 20260327_0001
Create Date: 2026-05-12

"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "20260512_0002"
down_revision = "20260327_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        text(
            """
            ALTER TABLE telemetry_readings
            ADD COLUMN IF NOT EXISTS vibration_rms double precision;
            """
        )
    )


def downgrade() -> None:
    op.execute(text("ALTER TABLE telemetry_readings DROP COLUMN IF EXISTS vibration_rms;"))
