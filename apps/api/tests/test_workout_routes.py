from datetime import date

import pytest
from fastapi.testclient import TestClient

from runner_api.main import app
from runner_api.models.workout import Workout, WorkoutStatus, WorkoutType

client = TestClient(app)


def test_get_week_returns_summary() -> None:
    response = client.get("/weeks/2026-09-18")

    assert response.status_code == 200

    body = response.json()

    assert body["week_start"] == "2026-09-14"
    assert body["planned_distance"] == 30.0
    assert body["actual_distance"] == 5.1
    assert len(body["workouts"]) == 4
    assert body["workouts"][0]["type"] == "run"
    assert "avg_pace_seconds" not in body["workouts"][0]


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


def test_get_week_counts_multiple_same_day_sessions_without_overwriting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sessions = [
        Workout(
            id="double-1",
            date=date(2026, 9, 14),
            planned_distance=5,
            distance=5.1,
            status=WorkoutStatus.COMPLETED,
        ),
        Workout(
            id="double-2",
            date=date(2026, 9, 14),
            planned_distance=3,
            distance=3.2,
            status=WorkoutStatus.COMPLETED,
        ),
        Workout(
            id="strength-1",
            date=date(2026, 9, 15),
            type=WorkoutType.STRENGTH,
            status=WorkoutStatus.COMPLETED,
        ),
    ]
    monkeypatch.setattr("runner_api.routes.workouts.WORKOUTS", sessions)

    response = client.get("/weeks/2026-09-14")

    assert response.status_code == 200
    body = response.json()
    assert body["planned_distance"] == 8
    assert body["actual_distance"] == 8.3
    assert [workout["id"] for workout in body["workouts"]] == [
        "double-1",
        "double-2",
        "strength-1",
    ]
