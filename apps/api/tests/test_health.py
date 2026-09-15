import pytest
from fastapi.testclient import TestClient

from runner_api.config import settings
from runner_api.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_endpoint_returns_ready():
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_version_endpoint_returns_configured_values(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "app_version", "1.2.3")
    monkeypatch.setattr(settings, "environment", "test")

    response = client.get("/version")

    assert response.status_code == 200
    assert response.json() == {"version": "1.2.3", "environment": "test"}
