from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, get_token_from_request
from app.core.database import get_session
from app.core.security import hash_password
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _require_admin(user: UserRead) -> None:
    if (user.role or "").lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requiere rol admin")


@router.get("", response_model=list[UserRead])
async def list_users(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> list[UserRead]:
    token = get_token_from_request(request)
    me = await get_current_user(session=session, token=token)
    _require_admin(me)

    r = await session.execute(
        text(
            """
            SELECT id, email, full_name, role, client_id, is_active, created_at
            FROM users
            ORDER BY created_at DESC NULLS LAST
            """
        )
    )
    return [UserRead.model_validate(row) for row in r.mappings().all()]


@router.post("", response_model=UserRead, status_code=201)
async def create_user(
    payload: UserCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    # Bootstrap: si no hay usuarios, permite crear el primero sin auth.
    count_r = await session.execute(text("SELECT COUNT(*)::int AS n FROM users"))
    n_users = int(count_r.mappings().one()["n"])
    if n_users > 0:
        token = get_token_from_request(request)
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
        me = await get_current_user(session=session, token=token)
        _require_admin(me)

    hashed = hash_password(payload.password)
    q = text(
        """
        INSERT INTO users (email, full_name, role, client_id, hashed_password, is_active)
        VALUES (:email, :full_name, :role, :client_id, :hashed_password, :is_active)
        RETURNING id, email, full_name, role, client_id, is_active, created_at
        """
    )
    try:
        r = await session.execute(
            q,
            {
                "email": str(payload.email),
                "full_name": payload.full_name,
                "role": payload.role,
                "client_id": str(payload.client_id) if payload.client_id else None,
                "hashed_password": hashed,
                "is_active": payload.is_active,
            },
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    row = r.mappings().one()
    return UserRead.model_validate(row)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    token = get_token_from_request(request)
    me = await get_current_user(session=session, token=token)
    if str(me.id) != str(user_id):
        _require_admin(me)

    r = await session.execute(
        text(
            """
            SELECT id, email, full_name, role, client_id, is_active, created_at
            FROM users
            WHERE id = :uid
            LIMIT 1
            """
        ),
        {"uid": str(user_id)},
    )
    row = r.mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserRead.model_validate(row)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    token = get_token_from_request(request)
    me = await get_current_user(session=session, token=token)
    is_self = str(me.id) == str(user_id)
    is_admin = (me.role or "").lower() == "admin"
    if not is_self:
        _require_admin(me)

    fields = payload.model_dump(exclude_unset=True)
    if "password" in fields:
        fields["hashed_password"] = hash_password(fields.pop("password")) if fields["password"] else None
    if not fields:
        return await get_user(user_id=user_id, request=request, session=session)

    # Construye SET dinámico seguro (solo columnas permitidas).
    allowed = {"full_name", "hashed_password"}
    if is_admin:
        allowed |= {"email", "role", "client_id", "is_active"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if "client_id" in updates and updates["client_id"] is not None:
        updates["client_id"] = str(updates["client_id"])
    if not updates:
        raise HTTPException(status_code=400, detail="Campos no válidos")

    set_sql = ", ".join([f"{k} = :{k}" for k in updates])
    q = text(
        f"""
        UPDATE users
        SET {set_sql}
        WHERE id = :uid
        RETURNING id, email, full_name, role, client_id, is_active, created_at
        """
    )
    try:
        r = await session.execute(q, {"uid": str(user_id), **updates})
        row = r.mappings().one_or_none()
        if not row:
            await session.rollback()
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        await session.commit()
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        # Unicidad por email, etc.
        msg = str(e)
        if "users_email_key" in msg or "duplicate key value" in msg:
            raise HTTPException(status_code=409, detail="Email ya existe") from e
        raise
    return UserRead.model_validate(row)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> None:
    token = get_token_from_request(request)
    me = await get_current_user(session=session, token=token)
    _require_admin(me)

    try:
        r = await session.execute(text("DELETE FROM users WHERE id = :uid RETURNING id"), {"uid": str(user_id)})
        if r.first() is None:
            await session.rollback()
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        await session.commit()
    except HTTPException:
        raise
    except Exception:
        await session.rollback()
        raise

