from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import fleets, vehicles
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.api_title, version="0.1.0", openapi_url="/openapi.json", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vehicles.router)
app.include_router(fleets.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": settings.api_title,
        "docs": "/docs",
        "health": "/health",
        "vehicles": "/vehicles",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
