"""Ingesta HTTP de telemetría (DAQ, bridge Python, sin Kafka)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.schemas.ingest import TelemetryIngestBody, TelemetryIngestResponse
from app.services.telemetry_write import insert_telemetry_payload

router = APIRouter(prefix="/ingest", tags=["ingest"])


async def require_ingest_key(
    x_telema_ingest_key: str | None = Header(None, alias="X-Telema-Ingest-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = (settings.telema_ingest_api_key or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ingesta HTTP deshabilitada. Define TELEMA_INGEST_API_KEY en backend/.env",
        )
    if not x_telema_ingest_key or x_telema_ingest_key.strip() != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clave de ingesta inválida")


@router.post(
    "/telemetry",
    response_model=TelemetryIngestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_ingest_key)],
)
async def ingest_telemetry(
    body: TelemetryIngestBody,
    session: AsyncSession = Depends(get_session),
) -> TelemetryIngestResponse:
    """
    Inserta una lectura en `telemetry_readings`.
    Uso típico: script en el PC del laboratorio con la tarjeta DAQ / acelerómetro Axiomet.
    """
    payload = body.to_payload_dict()
    try:
        await insert_telemetry_payload(session, payload)
        await session.commit()
    except ValueError as e:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo guardar telemetría: {e}",
        ) from e
    return TelemetryIngestResponse(vehicle_id=body.vehicle_id)
