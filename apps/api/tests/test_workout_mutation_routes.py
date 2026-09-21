from collections.abc import Iterator
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from runner_api.auth import CurrentUser, get_current_user
from runner_api.dependencies import get_workout_repository
from runner_api.main import app
from runner_api.models.workout import Workout, WorkoutStatus
from runner_api.repositories.workouts import (
    InMemoryWorkoutRepository,
    WorkoutNotFoundError,
)

USER_ID = "user_clerk_writer"
OTHER_USER_ID = "user_clerk_other"
client = TestClient(app)


@pytest.fixture
def repository() -> InMemoryWorkoutRepository:
    return InMemoryWorkoutRepository([], user_id=USER_ID)


@pytest.fixture(autouse=True)
def authenticated_dependencies(
    repository: InMemoryWorkoutRepository,
) -> Iterator[None]:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_ID)
    app.dependency_overrides[get_workout_repository] = lambda: repository
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_workout_repository, None)


def seed_workout(
    repository: InMemoryWorkoutRepository,
    *,
    workout_id: str = "workout-1",
    user_id: str = USER_ID,
    title: str | None = "Easy Run",
    description: str | None = "Keep it conversational",
    planned_distance: float | None = 5.0,
    distance: float | None = None,
    duration_seconds: int | None = None,
    status: WorkoutStatus = WorkoutStatus.PLANNED,
) -> Workout:
    workout = Workout(
        id=workout_id,
        date=date(2026, 9, 21),
        title=title,
        description=description,
        planned_distance=planned_distance,
        distance=distance,
        duration_seconds=duration_seconds,
        status=status,
    )
    timestamp = datetime(2026, 9, 1, tzinfo=UTC)
    repository.create(workout, user_id, timestamp, timestamp)
    return workout


def test_create_date_only_uses_defaults_and_authenticated_owner(
    repository: InMemoryWorkoutRepository,
) -> None:
    response = client.post("/workouts", json={"date": "2026-09-21"})

    assert response.status_code == 201
    body = response.json()
    UUID(body["id"])
    assert body["date"] == "2026-09-21"
    assert body["type"] == "run"
    assert body["status"] == "planned"

    record = repository.get(body["id"])
    assert record is not None
    assert record.user_id == USER_ID
    assert record.created_at.tzinfo == UTC
    assert record.updated_at == record.created_at


def test_create_accepts_full_permissive_workout_contract() -> None:
    response = client.post(
        "/workouts",
        json={
            "date": "2026-09-22",
            "type": "cross_training",
            "status": "completed",
            "title": "Bike",
            "description": "Easy aerobic ride",
            "planned_distance": 20,
            "start_time": "07:15:00",
            "duration_seconds": 3600,
            "distance": 18.5,
        },
    )

    assert response.status_code == 201
    assert response.json()["type"] == "cross_training"
    assert response.json()["distance"] == 18.5


@pytest.mark.parametrize(
    ("execution", "expected_field"),
    [({"distance": 7.0}, "distance"), ({"duration_seconds": 2700}, "duration_seconds")],
)
def test_create_infers_completion_without_client_status(
    execution: dict[str, float | int],
    expected_field: str,
) -> None:
    response = client.post(
        "/workouts",
        json={"date": "2026-09-22", **execution},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "completed"
    assert response.json()[expected_field] == execution[expected_field]


def test_create_requires_date() -> None:
    response = client.post("/workouts", json={"title": "Missing date"})

    assert response.status_code == 422


def test_create_rejects_client_supplied_ownership_and_server_fields(
    repository: InMemoryWorkoutRepository,
) -> None:
    for field, value in [
        ("user_id", "user_attacker"),
        ("id", "chosen-id"),
        ("created_at", "2026-09-01T00:00:00Z"),
        ("updated_at", "2026-09-01T00:00:00Z"),
        ("avg_pace", 480),
    ]:
        response = client.post(
            "/workouts",
            json={"date": "2026-09-21", field: value},
        )
        assert response.status_code == 422

    assert (
        repository.list_between(
            USER_ID,
            date(2026, 9, 21),
            date(2026, 9, 21),
        )
        == []
    )


def test_create_preserves_multiple_sessions_on_the_same_date() -> None:
    first = client.post("/workouts", json={"date": "2026-09-21", "title": "AM"})
    second = client.post("/workouts", json={"date": "2026-09-21", "title": "PM"})

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]

    week = client.get("/weeks/2026-09-21")
    assert {workout["title"] for workout in week.json()["workouts"]} == {"AM", "PM"}


def test_patch_updates_only_title_and_preserves_omitted_fields(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(repository)

    response = client.patch("/workouts/workout-1", json={"title": "Recovery Run"})

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Recovery Run"
    assert body["description"] == "Keep it conversational"
    assert body["planned_distance"] == 5.0


def test_patch_updates_planned_distance(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(repository)

    response = client.patch("/workouts/workout-1", json={"planned_distance": 6.5})

    assert response.status_code == 200
    assert response.json()["planned_distance"] == 6.5


@pytest.mark.parametrize(
    ("changes", "field", "value"),
    [
        ({"distance": 5.2}, "distance", 5.2),
        ({"duration_seconds": 2500}, "duration_seconds", 2500),
    ],
)
def test_patch_execution_data_infers_completion_without_client_status(
    repository: InMemoryWorkoutRepository,
    changes: dict[str, float | int],
    field: str,
    value: float,
) -> None:
    seed_workout(repository)

    response = client.patch("/workouts/workout-1", json=changes)

    assert response.status_code == 200
    assert response.json()[field] == value
    assert response.json()["status"] == "completed"


def test_clearing_one_execution_field_keeps_completion(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(
        repository,
        distance=5.2,
        duration_seconds=2500,
        status=WorkoutStatus.COMPLETED,
    )

    distance_response = client.patch("/workouts/workout-1", json={"distance": None})
    assert distance_response.status_code == 200
    assert distance_response.json()["status"] == "completed"

    seed_workout(
        repository,
        workout_id="workout-2",
        distance=5.2,
        duration_seconds=2500,
        status=WorkoutStatus.COMPLETED,
    )
    duration_response = client.patch(
        "/workouts/workout-2",
        json={"duration_seconds": None},
    )
    assert duration_response.status_code == 200
    assert duration_response.json()["status"] == "completed"


def test_clearing_all_execution_data_returns_to_planned(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(
        repository,
        distance=5.2,
        duration_seconds=2500,
        status=WorkoutStatus.COMPLETED,
    )

    first = client.patch("/workouts/workout-1", json={"distance": None})
    second = client.patch("/workouts/workout-1", json={"duration_seconds": None})

    assert first.json()["status"] == "completed"
    assert second.status_code == 200
    assert second.json()["status"] == "planned"


def test_patch_explicit_null_clears_nullable_field(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(repository)

    response = client.patch("/workouts/workout-1", json={"title": None})

    assert response.status_code == 200
    assert response.json()["title"] is None
    assert response.json()["description"] == "Keep it conversational"


@pytest.mark.parametrize("field", ["date", "type", "status"])
def test_patch_rejects_clearing_required_domain_fields(
    repository: InMemoryWorkoutRepository,
    field: str,
) -> None:
    seed_workout(repository)

    response = client.patch("/workouts/workout-1", json={field: None})

    assert response.status_code == 422


def test_patch_date_moves_workout_between_week_queries(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(repository)

    response = client.patch("/workouts/workout-1", json={"date": "2026-09-28"})

    assert response.status_code == 200
    assert response.json()["date"] == "2026-09-28"
    assert client.get("/weeks/2026-09-21").json()["workouts"] == []
    assert [
        workout["id"] for workout in client.get("/weeks/2026-09-28").json()["workouts"]
    ] == ["workout-1"]


def test_patch_preserves_owner_and_created_at_and_changes_updated_at(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(repository)
    before = repository.get("workout-1")
    assert before is not None

    response = client.patch("/workouts/workout-1", json={"status": "completed"})

    assert response.status_code == 200
    after = repository.get("workout-1")
    assert after is not None
    assert after.user_id == before.user_id == USER_ID
    assert after.created_at == before.created_at
    assert after.updated_at > before.updated_at


def test_patch_cannot_change_ownership(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(repository)

    response = client.patch("/workouts/workout-1", json={"user_id": OTHER_USER_ID})

    assert response.status_code == 422
    record = repository.get("workout-1")
    assert record is not None
    assert record.user_id == USER_ID


@pytest.mark.parametrize("workout_id", ["missing", "other-user-workout"])
def test_patch_returns_same_404_for_missing_and_cross_user_workouts(
    repository: InMemoryWorkoutRepository,
    workout_id: str,
) -> None:
    if workout_id == "other-user-workout":
        seed_workout(repository, workout_id=workout_id, user_id=OTHER_USER_ID)

    response = client.patch(f"/workouts/{workout_id}", json={"title": "Changed"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Workout not found"}


def test_delete_owned_workout(
    repository: InMemoryWorkoutRepository,
) -> None:
    seed_workout(repository)

    response = client.delete("/workouts/workout-1")

    assert response.status_code == 204
    assert response.content == b""
    assert repository.get("workout-1") is None


@pytest.mark.parametrize("workout_id", ["missing", "other-user-workout"])
def test_delete_returns_same_404_for_missing_and_cross_user_workouts(
    repository: InMemoryWorkoutRepository,
    workout_id: str,
) -> None:
    if workout_id == "other-user-workout":
        seed_workout(repository, workout_id=workout_id, user_id=OTHER_USER_ID)

    response = client.delete(f"/workouts/{workout_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Workout not found"}
    if workout_id == "other-user-workout":
        assert repository.get(workout_id) is not None


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_stale_conditional_mutation_returns_not_found(method: str) -> None:
    class StaleRepository(InMemoryWorkoutRepository):
        def update(
            self,
            workout_id: str,
            user_id: str,
            changes: dict[str, Any],
            updated_at: datetime,
        ) -> Workout:
            raise WorkoutNotFoundError(workout_id)

        def delete(self, workout_id: str, user_id: str) -> None:
            raise WorkoutNotFoundError(workout_id)

    repository = StaleRepository([], user_id=USER_ID)
    seed_workout(repository)
    app.dependency_overrides[get_workout_repository] = lambda: repository

    response = client.request(
        method,
        "/workouts/workout-1",
        json={"title": "Changed"} if method == "patch" else None,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Workout not found"}


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("post", "/workouts", {"date": "2026-09-21"}),
        ("patch", "/workouts/workout-1", {"title": "Changed"}),
        ("delete", "/workouts/workout-1", None),
    ],
)
def test_mutations_reject_unauthenticated_requests(
    method: str,
    path: str,
    json: dict[str, str] | None,
) -> None:
    app.dependency_overrides.pop(get_current_user, None)

    response = client.request(method, path, json=json)

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_create_does_not_hide_repository_errors() -> None:
    class FailingRepository(InMemoryWorkoutRepository):
        def create(
            self,
            workout: Workout,
            user_id: str,
            created_at: datetime,
            updated_at: datetime,
        ) -> Workout:
            raise RuntimeError("DynamoDB unavailable")

    app.dependency_overrides[get_workout_repository] = lambda: FailingRepository(
        [], user_id=USER_ID
    )
    error_client = TestClient(app, raise_server_exceptions=False)

    response = error_client.post("/workouts", json={"date": "2026-09-21"})

    assert response.status_code == 500
