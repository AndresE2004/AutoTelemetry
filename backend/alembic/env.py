from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool, text
from sqlalchemy.engine.url import make_url

# Carga backend/.env en UTF-8 (evita confusion con variables del sistema en Windows).
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path, encoding="utf-8", override=True)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def get_url() -> str:
    # Cliente PostgreSQL en UTF-8. psycopg v3 evita UnicodeDecodeError de psycopg2 en Windows.
    os.environ.setdefault("PGCLIENTENCODING", "UTF8")
    # Mismo puerto por defecto que seed / Docker paralelo al Postgres local (5432).
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://telema:telema_dev@127.0.0.1:5433/telema",
    )
    if url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    sa_url = make_url(configuration["sqlalchemy.url"])
    print(
        f"[alembic] Migrando: {sa_url.username}@{sa_url.host}:{sa_url.port}/{sa_url.database}",
        file=sys.stderr,
    )
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    # AUTOCOMMIT + transactional_ddl=False: cada DDL se confirma de inmediato.
    # Sin esto, con Timescale/psycopg3 a veces el DDL no persiste al cerrar la conexión.
    with connectable.connect() as connection:
        connection.execute(text("SET lock_timeout = '30s'"))
        connection.commit()
        autocommit = connection.execution_options(isolation_level="AUTOCOMMIT")
        context.configure(
            connection=autocommit,
            target_metadata=target_metadata,
            transactional_ddl=False,
        )
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
