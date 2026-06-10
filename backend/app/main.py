from __future__ import annotations

import asyncio

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api import anomalies, auth, cybernetics, fleets, ingest, reports, tickets, users, vehicles
from app.core.config import get_settings
from app.twin_synthetic import next_twin_frame

settings = get_settings()

app = FastAPI(title=settings.api_title, version="0.1.0", openapi_url="/openapi.json", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(anomalies.router)
app.include_router(auth.router)
app.include_router(vehicles.router)
app.include_router(fleets.router)
app.include_router(reports.router)
app.include_router(tickets.router)
app.include_router(cybernetics.router)
app.include_router(users.router)
app.include_router(ingest.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": settings.api_title,
        "docs": "/docs",
        "health": "/health",
        "vehicles": "/vehicles",
        "anomalies": "/anomalies/",
        "metrics": "/metrics",
        "cybernetics": "/cybernetics/sfg",
        "twin_ws": "/ws/twin/{vehicle_id}?scenario=normal",
        "ingest": "/ingest/telemetry (header X-Telema-Ingest-Key)",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/twin/{vehicle_id}")
async def twin_websocket(
    websocket: WebSocket,
    vehicle_id: str,
    scenario: str = Query("normal"),
) -> None:
    """Gemelo sintético ~2 Hz — mismo forma JSON que espera `useTwinWebSocket` en el front."""
    await websocket.accept()
    prev: dict | None = None
    tick = 0
    try:
        while True:
            frame = next_twin_frame(prev, scenario, vehicle_id, tick)
            prev = frame
            tick += 1
            await websocket.send_json(frame)
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        return


try:
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator(should_group_status_codes=True).instrument(app).expose(
        app,
        endpoint="/metrics",
        include_in_schema=True,
    )
except Exception:
    pass
