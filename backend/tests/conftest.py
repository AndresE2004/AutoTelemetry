"""Variables mínimas para importar la app en pytest (sin conectar a BD real)."""

from __future__ import annotations

import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://pytest:pytest@127.0.0.1:1/pytest_db",
)
os.environ.setdefault(
    "DATABASE_URL_ASYNC",
    "postgresql+asyncpg://pytest:pytest@127.0.0.1:1/pytest_db",
)
os.environ.setdefault(
    "JWT_SECRET",
    "pytest-only-secret-not-for-production",
)
