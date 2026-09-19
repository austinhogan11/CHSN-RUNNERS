from datetime import date

from fastapi.testclient import TestClient

from runner_api.config import settings
from runner_api.dependencies import get_workout_repository
from runner_api.main import app
from runner_api.models.workout import Workout, WorkoutStatus
from runner_api.repositories.workouts import InMemoryWorkoutRepository

client = TestClient(app)


def test_get_mileage_trend_defaults_to_12_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={"end": "2026-09-20"},
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 12
    assert body[-1]["week_start"] == "2026-09-14"
    assert body[-1]["planned_distance"] == 30.0
    assert body[-1]["actual_distance"] == 5.1


def test_get_mileage_trend_returns_requested_number_of_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 4,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 4
    assert body[0]["week_start"] == "2026-08-24"
    assert body[-1]["week_start"] == "2026-09-14"


def test_get_mileage_trend_includes_empty_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 2,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body[0] == {
        "week_start": "2026-09-07",
        "planned_distance": 0.0,
        "actual_distance": 0.0,
    }


def test_get_mileage_trend_rejects_zero_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 0,
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "weeks must be between 1 and 52"}


def test_get_mileage_trend_rejects_more_than_52_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 53,
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "weeks must be between 1 and 52"}


def test_get_mileage_trend_uses_one_repository_query_for_the_full_range() -> None:
    class RecordingRepository(InMemoryWorkoutRepository):
        def __init__(self) -> None:
            super().__init__(
                [
                    Workout(
                        id="run-1",
                        date=date(2026, 9, 8),
                        planned_distance=4,
                        distance=4.2,
                        status=WorkoutStatus.COMPLETED,
                    )
                ],
                user_id=settings.workout_default_user_id,
            )
            self.calls: list[tuple[str, date, date]] = []

        def list_between(
            self,
            user_id: str,
            start_date: date,
            end_date: date,
        ) -> list[Workout]:
            self.calls.append((user_id, start_date, end_date))
            return super().list_between(user_id, start_date, end_date)

    repository = RecordingRepository()
    app.dependency_overrides[get_workout_repository] = lambda: repository

    try:
        response = client.get(
            "/trends/mileage",
            params={"end": "2026-09-20", "weeks": 2},
        )
    finally:
        app.dependency_overrides.pop(get_workout_repository, None)

    assert response.status_code == 200
    assert repository.calls == [
        (
            settings.workout_default_user_id,
            date(2026, 9, 7),
            date(2026, 9, 20),
        )
    ]
    assert response.json() == [
        {
            "week_start": "2026-09-07",
            "planned_distance": 4.0,
            "actual_distance": 4.2,
        },
        {
            "week_start": "2026-09-14",
            "planned_distance": 0.0,
            "actual_distance": 0.0,
        },
    ]
