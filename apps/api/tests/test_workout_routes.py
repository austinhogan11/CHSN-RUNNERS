import pytest
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


@pytest.mark.parametrize("day", ["2026-10-05", "2026-10-07", "2026-10-11"])
def test_get_week_returns_empty_summary_when_no_workouts_exist(day: str) -> None:
    response = client.get(f"/weeks/{day}")

    assert response.status_code == 200
    assert response.json() == {
        "week_start": "2026-10-05",
        "planned_distance": 0,
        "actual_distance": 0,
        "workouts": [],
    }
