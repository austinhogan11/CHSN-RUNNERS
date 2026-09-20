from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any

import pytest
from botocore.exceptions import ClientError

from runner_api.models.workout import Workout, WorkoutStatus, WorkoutType
from runner_api.repositories.workouts import (
    USER_DATE_INDEX,
    DynamoDBWorkoutRepository,
    WorkoutAlreadyExistsError,
    WorkoutNotFoundError,
    WorkoutRecord,
    workout_from_item,
    workout_record_from_item,
    workout_to_item,
)


class FakeTable:
    def __init__(
        self,
        *,
        get_response: dict[str, Any] | None = None,
        put_response: dict[str, Any] | None = None,
        query_responses: list[dict[str, Any]] | None = None,
        update_response: dict[str, Any] | None = None,
        delete_response: dict[str, Any] | None = None,
        put_error: ClientError | None = None,
        update_error: ClientError | None = None,
        delete_error: ClientError | None = None,
    ) -> None:
        self.get_response = get_response or {}
        self.put_response = put_response or {}
        self.query_responses = query_responses or []
        self.update_response = update_response or {}
        self.delete_response = delete_response or {}
        self.put_error = put_error
        self.update_error = update_error
        self.delete_error = delete_error
        self.get_calls: list[dict[str, Any]] = []
        self.put_calls: list[dict[str, Any]] = []
        self.query_calls: list[dict[str, Any]] = []
        self.update_calls: list[dict[str, Any]] = []
        self.delete_calls: list[dict[str, Any]] = []

    def get_item(self, **kwargs: Any) -> dict[str, Any]:
        self.get_calls.append(kwargs)
        return self.get_response

    def put_item(self, **kwargs: Any) -> dict[str, Any]:
        self.put_calls.append(kwargs)
        if self.put_error is not None:
            raise self.put_error
        return self.put_response

    def query(self, **kwargs: Any) -> dict[str, Any]:
        self.query_calls.append(kwargs)
        return self.query_responses[len(self.query_calls) - 1]

    def update_item(self, **kwargs: Any) -> dict[str, Any]:
        self.update_calls.append(kwargs)
        if self.update_error is not None:
            raise self.update_error
        return self.update_response

    def delete_item(self, **kwargs: Any) -> dict[str, Any]:
        self.delete_calls.append(kwargs)
        if self.delete_error is not None:
            raise self.delete_error
        return self.delete_response


def client_error(code: str) -> ClientError:
    return ClientError(
        {"Error": {"Code": code, "Message": "test error"}},
        "TestOperation",
    )


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


def test_workout_record_from_item_includes_ownership_and_timestamps() -> None:
    record = workout_record_from_item(
        {
            "id": "workout-1",
            "user_id": "runner-1",
            "user_date_key": "2026-09-14#workout-1",
            "date": "2026-09-14",
            "type": "run",
            "status": "planned",
            "created_at": "2026-09-01T00:00:00+00:00",
            "updated_at": "2026-09-02T00:00:00+00:00",
        }
    )

    assert isinstance(record, WorkoutRecord)
    assert record.workout.id == "workout-1"
    assert record.user_id == "runner-1"
    assert record.created_at == datetime(2026, 9, 1, tzinfo=UTC)
    assert record.updated_at == datetime(2026, 9, 2, tzinfo=UTC)


def test_get_returns_owned_workout_record() -> None:
    table = FakeTable(
        get_response={
            "Item": {
                "id": "workout-1",
                "date": "2026-09-14",
                "type": "run",
                "status": "planned",
                "user_id": "runner-1",
                "created_at": "2026-09-01T00:00:00+00:00",
                "updated_at": "2026-09-01T00:00:00+00:00",
            }
        }
    )
    repository = DynamoDBWorkoutRepository(table)

    record = repository.get("workout-1")

    assert isinstance(record, WorkoutRecord)
    assert record.workout.id == "workout-1"
    assert record.user_id == "runner-1"
    assert table.get_calls == [{"Key": {"id": "workout-1"}, "ConsistentRead": True}]


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


def test_create_serializes_workout_and_conditionally_prevents_overwrite() -> None:
    table = FakeTable()
    repository = DynamoDBWorkoutRepository(table)
    timestamp = datetime(2026, 9, 1, tzinfo=UTC)
    workout = Workout(
        id="workout-1",
        date=date(2026, 9, 14),
        planned_distance=5.5,
    )

    created = repository.create(workout, "runner-1", timestamp, timestamp)

    assert created is workout
    assert table.put_calls == [
        {
            "Item": {
                "id": "workout-1",
                "date": "2026-09-14",
                "type": "run",
                "planned_distance": Decimal("5.5"),
                "status": "planned",
                "user_id": "runner-1",
                "user_date_key": "2026-09-14#workout-1",
                "created_at": "2026-09-01T00:00:00+00:00",
                "updated_at": "2026-09-01T00:00:00+00:00",
            },
            "ConditionExpression": "attribute_not_exists(#id)",
            "ExpressionAttributeNames": {"#id": "id"},
        }
    ]


def test_create_maps_conditional_collision_without_swallowing_other_errors() -> None:
    timestamp = datetime(2026, 9, 1, tzinfo=UTC)
    workout = Workout(id="workout-1", date=date(2026, 9, 14))
    collision_repository = DynamoDBWorkoutRepository(
        FakeTable(put_error=client_error("ConditionalCheckFailedException"))
    )

    with pytest.raises(WorkoutAlreadyExistsError):
        collision_repository.create(workout, "runner-1", timestamp, timestamp)

    unavailable_repository = DynamoDBWorkoutRepository(
        FakeTable(put_error=client_error("InternalServerError"))
    )
    with pytest.raises(ClientError):
        unavailable_repository.create(workout, "runner-1", timestamp, timestamp)


def test_update_builds_partial_set_remove_and_recomputes_date_key() -> None:
    table = FakeTable(
        update_response={
            "Attributes": {
                "id": "workout-1",
                "user_id": "runner-1",
                "user_date_key": "2026-09-21#workout-1",
                "date": "2026-09-21",
                "type": "run",
                "status": "planned",
                "title": "Updated",
                "created_at": "2026-09-01T00:00:00+00:00",
                "updated_at": "2026-09-02T00:00:00+00:00",
            }
        }
    )
    repository = DynamoDBWorkoutRepository(table)
    updated_at = datetime(2026, 9, 2, tzinfo=UTC)

    workout = repository.update(
        "workout-1",
        "runner-1",
        {
            "date": "2026-09-21",
            "title": "Updated",
            "description": None,
            "planned_distance": None,
        },
        updated_at,
    )

    assert isinstance(workout, Workout)
    assert workout.date == date(2026, 9, 21)
    assert workout.title == "Updated"
    call = table.update_calls[0]
    assert call["Key"] == {"id": "workout-1"}
    assert call["ConditionExpression"] == "attribute_exists(#id) AND #owner = :owner"
    assert call["ReturnValues"] == "ALL_NEW"
    assert "#updated_at = :updated_at" in call["UpdateExpression"]
    assert "#date = :date" in call["UpdateExpression"]
    assert "#user_date_key = :user_date_key" in call["UpdateExpression"]
    assert "REMOVE #description, #planned_distance" in call["UpdateExpression"]
    assert call["ExpressionAttributeValues"][":user_date_key"] == (
        "2026-09-21#workout-1"
    )
    assert ":description" not in call["ExpressionAttributeValues"]
    assert ":planned_distance" not in call["ExpressionAttributeValues"]


def test_update_converts_floats_and_maps_stale_conditional_failure() -> None:
    table = FakeTable(update_error=client_error("ConditionalCheckFailedException"))
    repository = DynamoDBWorkoutRepository(table)

    with pytest.raises(WorkoutNotFoundError):
        repository.update(
            "workout-1",
            "runner-1",
            {"planned_distance": 6.5},
            datetime(2026, 9, 2, tzinfo=UTC),
        )

    assert table.update_calls[0]["ExpressionAttributeValues"][
        ":planned_distance"
    ] == Decimal("6.5")


def test_delete_is_owner_conditional_and_maps_stale_failure() -> None:
    table = FakeTable()
    repository = DynamoDBWorkoutRepository(table)

    repository.delete("workout-1", "runner-1")

    assert table.delete_calls == [
        {
            "Key": {"id": "workout-1"},
            "ConditionExpression": "attribute_exists(#id) AND #owner = :owner",
            "ExpressionAttributeNames": {"#id": "id", "#owner": "user_id"},
            "ExpressionAttributeValues": {":owner": "runner-1"},
        }
    ]

    stale_repository = DynamoDBWorkoutRepository(
        FakeTable(delete_error=client_error("ConditionalCheckFailedException"))
    )
    with pytest.raises(WorkoutNotFoundError):
        stale_repository.delete("workout-1", "runner-1")


def test_update_and_delete_propagate_nonconditional_storage_errors() -> None:
    update_repository = DynamoDBWorkoutRepository(
        FakeTable(update_error=client_error("InternalServerError"))
    )
    with pytest.raises(ClientError):
        update_repository.update(
            "workout-1",
            "runner-1",
            {"title": "Updated"},
            datetime(2026, 9, 2, tzinfo=UTC),
        )

    delete_repository = DynamoDBWorkoutRepository(
        FakeTable(delete_error=client_error("InternalServerError"))
    )
    with pytest.raises(ClientError):
        delete_repository.delete("workout-1", "runner-1")
