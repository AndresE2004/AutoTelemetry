from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_docs_available() -> None:
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert data["info"]["title"] == "Telema Mobility API"
    assert "/vehicles" in data["paths"]
    telemetry_paths = [p for p in data["paths"] if "telemetry" in p]
    assert telemetry_paths, "debe existir GET /vehicles/{vehicle_id}/telemetry"
