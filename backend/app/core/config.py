from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración desde variables de entorno / backend/.env (nunca credenciales en el repo)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Obligatorias: copiar backend/.env.example → backend/.env
    database_url: str = Field(
        ...,
        description="DSN sync (Alembic, scripts ML). Variable: DATABASE_URL",
    )
    database_url_async: str = Field(
        ...,
        description="DSN async (FastAPI). Variable: DATABASE_URL_ASYNC",
    )
    jwt_secret: str = Field(
        ...,
        min_length=16,
        description="Firma JWT. Variable: JWT_SECRET",
    )

    api_title: str = "Telema Mobility API"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    jwt_algorithm: str = "HS256"
    jwt_access_minutes: int = 7
    jwt_refresh_days: int = 14
    auth_cookie_name: str = "telema_access"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"

    # Ingesta DAQ / laboratorio (header X-Telema-Ingest-Key). Vacío = endpoint deshabilitado.
    telema_ingest_api_key: str = ""

    # Correo al crear ticket (SMTP). Secretos solo en .env.
    smtp_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    ticket_notify_emails: str = ""
    frontend_base_url: str = "http://127.0.0.1:3000"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
