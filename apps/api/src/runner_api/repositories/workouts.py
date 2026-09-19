from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol, cast

from boto3.dynamodb.conditions import Key

from runner_api.models.workout import Workout

USER_DATE_INDEX = "user-date-index"


class WorkoutRepository(Protocol):
    def get(self, workout_id: str) -> Workout | None: ...

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[Workout]: ...


class DynamoDBTable(Protocol):
    def get_item(self, **kwargs: Any) -> dict[str, Any]: ...

    def query(self, **kwargs: Any) -> dict[str, Any]: ...


class InMemoryWorkoutRepository:
    def __init__(self, workouts: Iterable[Workout], user_id: str) -> None:
        self._workouts = list(workouts)
        self._user_id = user_id

    def get(self, workout_id: str) -> Workout | None:
        return next(
            (workout for workout in self._workouts if workout.id == workout_id),
            None,
        )

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[Workout]:
        if start_date > end_date:
            raise ValueError("start_date must be on or before end_date")

        if user_id != self._user_id:
            return []

        return sorted(
            (
                workout
                for workout in self._workouts
                if start_date <= workout.date <= end_date
            ),
            key=lambda workout: (workout.date, workout.id),
        )


class DynamoDBWorkoutRepository:
    def __init__(self, table: DynamoDBTable) -> None:
        self._table = table

    def get(self, workout_id: str) -> Workout | None:
        response = self._table.get_item(Key={"id": workout_id})
        item = response.get("Item")

        if item is None:
            return None

        return workout_from_item(cast(dict[str, Any], item))

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[Workout]:
        if start_date > end_date:
            raise ValueError("start_date must be on or before end_date")

        # "$" sorts immediately after the "#" date/ID separator, making the
        # upper bound include every ID on end_date without including the next day.
        query: dict[str, Any] = {
            "IndexName": USER_DATE_INDEX,
            "KeyConditionExpression": Key("user_id").eq(user_id)
            & Key("user_date_key").between(
                f"{start_date.isoformat()}#",
                f"{end_date.isoformat()}$",
            ),
            "ScanIndexForward": True,
        }
        workouts: list[Workout] = []

        while True:
            response = self._table.query(**query)
            workouts.extend(
                workout_from_item(cast(dict[str, Any], item))
                for item in response.get("Items", [])
            )

            last_key = response.get("LastEvaluatedKey")
            if last_key is None:
                break

            query["ExclusiveStartKey"] = last_key

        return workouts


def workout_to_item(
    workout: Workout,
    user_id: str,
    created_at: datetime,
    updated_at: datetime,
) -> dict[str, Any]:
    item = workout.model_dump(mode="json", exclude_none=True)
    item.update(
        {
            "user_id": user_id,
            "user_date_key": f"{workout.date.isoformat()}#{workout.id}",
            "created_at": created_at.isoformat(),
            "updated_at": updated_at.isoformat(),
        }
    )
    return cast(dict[str, Any], _to_dynamodb_numbers(item))


def workout_from_item(item: dict[str, Any]) -> Workout:
    workout_fields = Workout.model_fields.keys()
    payload = {
        key: _from_dynamodb_numbers(value)
        for key, value in item.items()
        if key in workout_fields
    }
    return Workout.model_validate(payload)


def _to_dynamodb_numbers(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _to_dynamodb_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_dynamodb_numbers(item) for item in value]
    return value


def _from_dynamodb_numbers(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)
    if isinstance(value, dict):
        return {key: _from_dynamodb_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_from_dynamodb_numbers(item) for item in value]
    return value
