from fastapi.testclient import TestClient

from runner_api.main import app

client = TestClient(app)


def test_get_week_returns_summary() -> None:
    response = client.get("/weeks/2026-09-18")

    assert response.status_code == 200

    body = response.json()

    assert body["week_start"] == "2026-09-14"
    assert body["planned_distance"] == 30.0
    assert body["actual_distance"] == 5.1
    assert len(body["workouts"]) == 4


def test_get_week_returns_404_when_no_workouts_exist() -> None:
    response = client.get("/weeks/2026-10-05")

    assert response.status_code == 404
    assert response.json() == {"detail": "No workouts found for this week"}
