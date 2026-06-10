from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.schemas.user import RefreshRequest, TokenPair, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

# Esto hace que Swagger/OpenAPI muestre el botón "Authorize" (Bearer token).
# Usamos auto_error=False para permitir fallback por cookie HttpOnly en entornos web.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


async def _get_user_by_email(session: AsyncSession, email: str) -> dict | None:
    q = text(
        """
        SELECT id, email, full_name, role, client_id, hashed_password, is_active, created_at
        FROM users
        WHERE lower(email) = lower(:email)
        LIMIT 1
        """
    )
    r = await session.execute(q, {"email": email})
    row = r.mappings().one_or_none()
    return dict(row) if row else None


async def get_current_user(
    session: AsyncSession = Depends(get_session),
    token: str | None = None,
) -> UserRead:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Token inválido")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    r = await session.execute(
        text(
            """
            SELECT id, email, full_name, role, client_id, is_active, created_at
            FROM users
            WHERE id = :uid
            LIMIT 1
            """
        ),
        {"uid": sub},
    )
    row = r.mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no existe")
    if not row["is_active"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")
    return UserRead.model_validate(row)


def get_token_from_request(request: Request) -> str | None:
    settings = get_settings()
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return request.cookies.get(settings.auth_cookie_name)


async def require_auth(
    request: Request,
    session: AsyncSession = Depends(get_session),
    bearer_token: str | None = Depends(oauth2_scheme),
) -> UserRead:
    token = bearer_token or get_token_from_request(request)
    return await get_current_user(session=session, token=token)


def require_roles(*allowed: str):
    async def _dep(user: UserRead = Depends(require_auth)) -> UserRead:
        role = (user.role or "").lower()
        if role not in {a.lower() for a in allowed}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
        return user

    return _dep


@router.post("/login", response_model=TokenPair)
async def login(
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    # OAuth2PasswordRequestForm usa "username"; aquí lo tratamos como email.
    user = await _get_user_by_email(session, form.username)
    if not user or not user.get("is_active", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if not verify_password(form.password, user.get("hashed_password")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    settings = get_settings()
    access = create_access_token(str(user["id"]), minutes=settings.jwt_access_minutes)
    refresh = create_refresh_token(str(user["id"]), days=settings.jwt_refresh_days)

    response.set_cookie(
        settings.auth_cookie_name,
        access,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.jwt_access_minutes * 60,
        path="/",
    )
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.auth_cookie_name, path="/")


@router.post("/refresh", response_model=TokenPair)
async def refresh_tokens(
    response: Response,
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    """Intercambia un refresh JWT (`typ: refresh`) por un nuevo access (+ refresh rotado)."""
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("typ") != "refresh":
            raise ValueError("no es refresh")
        sub = payload.get("sub")
        if not sub:
            raise ValueError("sin sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh inválido") from None

    r = await session.execute(
        text(
            """
            SELECT id, is_active
            FROM users
            WHERE id = :uid
            LIMIT 1
            """
        ),
        {"uid": sub},
    )
    row = r.mappings().one_or_none()
    if not row or not row["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inválido o inactivo")

    settings = get_settings()
    access = create_access_token(str(row["id"]), minutes=settings.jwt_access_minutes)
    refresh = create_refresh_token(str(row["id"]), days=settings.jwt_refresh_days)
    response.set_cookie(
        settings.auth_cookie_name,
        access,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.jwt_access_minutes * 60,
        path="/",
    )
    return TokenPair(access_token=access, refresh_token=refresh)


@router.get("/me", response_model=UserRead)
async def me(request: Request, session: AsyncSession = Depends(get_session)) -> UserRead:
    token = get_token_from_request(request)
    return await get_current_user(session=session, token=token)

