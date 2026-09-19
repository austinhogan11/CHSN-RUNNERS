from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any

import pytest

from runner_api.models.workout import Workout, WorkoutStatus, WorkoutType
from runner_api.repositories.workouts import (
    USER_DATE_INDEX,
    DynamoDBWorkoutRepository,
    workout_from_item,
    workout_to_item,
)


class FakeTable:
    def __init__(
        self,
        *,
        get_response: dict[str, Any] | None = None,
        query_responses: list[dict[str, Any]] | None = None,
    ) -> None:
        self.get_response = get_response or {}
        self.query_responses = query_responses or []
        self.get_calls: list[dict[str, Any]] = []
        self.query_calls: list[dict[str, Any]] = []

    def get_item(self, **kwargs: Any) -> dict[str, Any]:
        self.get_calls.append(kwargs)
        return self.get_response

    def query(self, **kwargs: Any) -> dict[str, Any]:
        self.query_calls.append(kwargs)
        return self.query_responses[len(self.query_calls) - 1]


def test_workout_from_item_converts_decimals_and_missing_optional_fields() -> None:
    workout = workout_from_item(
        {
            "id": "workout-1",
            "user_id": "runner-1",
            "user_date_key": "2026-09-14#workout-1",
            "date": "2026-09-14",
            "type": "run",
            "status": "completed",
            "distance": Decimal("5.1"),
            "duration_seconds": Decimal(2460),
            "created_at": "2026-09-01T00:00:00+00:00",
            "updated_at": "2026-09-01T00:00:00+00:00",
        }
    )

    assert isinstance(workout, Workout)
    assert workout.distance == 5.1
    assert isinstance(workout.distance, float)
    assert workout.duration_seconds == 2460
    assert isinstance(workout.duration_seconds, int)
    assert workout.title is None
    assert workout.planned_distance is None


def test_workout_to_item_adds_ownership_keys_and_omits_nulls_and_derived_pace() -> None:
    timestamp = datetime(2026, 9, 1, tzinfo=UTC)
    workout = Workout(
        id="workout-1",
        date=date(2026, 9, 14),
        type=WorkoutType.RUN,
        title="Easy Run",
        planned_distance=5.0,
        distance=5.1,
        duration_seconds=2460,
        status=WorkoutStatus.COMPLETED,
    )

    item = workout_to_item(workout, "runner-1", timestamp, timestamp)

    assert item["id"] == "workout-1"
    assert item["user_id"] == "runner-1"
    assert item["user_date_key"] == "2026-09-14#workout-1"
    assert item["date"] == "2026-09-14"
    assert item["planned_distance"] == Decimal("5.0")
    assert item["distance"] == Decimal("5.1")
    assert item["duration_seconds"] == 2460
    assert item["created_at"] == "2026-09-01T00:00:00+00:00"
    assert "description" not in item
    assert "start_time" not in item
    assert "avg_pace_seconds" not in item


def test_workout_to_item_serializes_start_time() -> None:
    timestamp = datetime(2026, 9, 1, tzinfo=UTC)
    workout = Workout(
        id="workout-1",
        date=date(2026, 9, 14),
        start_time=time(6, 30),
    )

    item = workout_to_item(workout, "runner-1", timestamp, timestamp)

    assert item["start_time"] == "06:30:00"


def test_get_returns_a_domain_workout() -> None:
    table = FakeTable(
        get_response={
            "Item": {
                "id": "workout-1",
                "date": "2026-09-14",
                "type": "run",
                "status": "planned",
            }
        }
    )
    repository = DynamoDBWorkoutRepository(table)

    workout = repository.get("workout-1")

    assert isinstance(workout, Workout)
    assert workout.id == "workout-1"
    assert table.get_calls == [{"Key": {"id": "workout-1"}}]


def test_get_returns_none_when_item_does_not_exist() -> None:
    repository = DynamoDBWorkoutRepository(FakeTable())

    assert repository.get("missing") is None


def test_list_between_builds_inclusive_user_date_query_and_paginates() -> None:
    first_item = {
        "id": "run-am",
        "date": "2026-09-14",
        "type": "run",
        "status": "completed",
        "distance": Decimal("5.1"),
    }
    second_item = {
        "id": "run-pm",
        "date": "2026-09-14",
        "type": "run",
        "status": "completed",
        "distance": Decimal("3.2"),
    }
    last_key = {"id": "run-am", "user_id": "runner-1"}
    table = FakeTable(
        query_responses=[
            {"Items": [first_item], "LastEvaluatedKey": last_key},
            {"Items": [second_item]},
        ]
    )
    repository = DynamoDBWorkoutRepository(table)

    workouts = repository.list_between(
        "runner-1",
        date(2026, 9, 14),
        date(2026, 9, 20),
    )

    assert [workout.id for workout in workouts] == ["run-am", "run-pm"]
    assert all(isinstance(workout, Workout) for workout in workouts)
    assert table.query_calls[0]["IndexName"] == USER_DATE_INDEX
    assert table.query_calls[0]["ScanIndexForward"] is True
    assert table.query_calls[1]["ExclusiveStartKey"] == last_key

    condition = table.query_calls[0]["KeyConditionExpression"].get_expression()
    partition = condition["values"][0].get_expression()
    date_range = condition["values"][1].get_expression()
    assert condition["operator"] == "AND"
    assert [getattr(value, "name", value) for value in partition["values"]] == [
        "user_id",
        "runner-1",
    ]
    assert [getattr(value, "name", value) for value in date_range["values"]] == [
        "user_date_key",
        "2026-09-14#",
        "2026-09-20$",
    ]


def test_list_between_rejects_inverted_range() -> None:
    repository = DynamoDBWorkoutRepository(FakeTable())

    with pytest.raises(ValueError, match="start_date must be on or before end_date"):
        repository.list_between(
            "runner-1",
            date(2026, 9, 20),
            date(2026, 9, 14),
        )
