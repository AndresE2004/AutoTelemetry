from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# PBKDF2 evita problemas de bcrypt/passlib en Windows y es suficiente para el demo.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(subject: str, *, minutes: int) -> str:
    settings = get_settings()
    expire = _now() + timedelta(minutes=minutes)
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, *, days: int) -> str:
    settings = get_settings()
    expire = _now() + timedelta(days=days)
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire, "typ": "refresh"}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError as e:
        raise ValueError("Token inválido") from e

