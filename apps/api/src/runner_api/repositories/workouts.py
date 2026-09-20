from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Protocol, cast

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from runner_api.models.workout import Workout

USER_DATE_INDEX = "user-date-index"
SEED_TIMESTAMP = datetime(1970, 1, 1, tzinfo=UTC)


class WorkoutAlreadyExistsError(Exception):
    pass


class WorkoutNotFoundError(Exception):
    pass


@dataclass(frozen=True)
class WorkoutRecord:
    workout: Workout
    user_id: str
    created_at: datetime
    updated_at: datetime


class WorkoutRepository(Protocol):
    def get(self, workout_id: str) -> WorkoutRecord | None: ...

    def create(
        self,
        workout: Workout,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> Workout: ...

    def update(
        self,
        workout_id: str,
        user_id: str,
        changes: dict[str, Any],
        updated_at: datetime,
    ) -> Workout: ...

    def delete(self, workout_id: str, user_id: str) -> None: ...

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[Workout]: ...


class DynamoDBTable(Protocol):
    def get_item(self, **kwargs: Any) -> dict[str, Any]: ...

    def put_item(self, **kwargs: Any) -> dict[str, Any]: ...

    def query(self, **kwargs: Any) -> dict[str, Any]: ...

    def update_item(self, **kwargs: Any) -> dict[str, Any]: ...

    def delete_item(self, **kwargs: Any) -> dict[str, Any]: ...


class InMemoryWorkoutRepository:
    def __init__(self, workouts: Iterable[Workout], user_id: str) -> None:
        self._records = {
            workout.id: WorkoutRecord(
                workout=workout,
                user_id=user_id,
                created_at=SEED_TIMESTAMP,
                updated_at=SEED_TIMESTAMP,
            )
            for workout in workouts
        }

    def get(self, workout_id: str) -> WorkoutRecord | None:
        return self._records.get(workout_id)

    def create(
        self,
        workout: Workout,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> Workout:
        if workout.id in self._records:
            raise WorkoutAlreadyExistsError(workout.id)

        self._records[workout.id] = WorkoutRecord(
            workout=workout,
            user_id=user_id,
            created_at=created_at,
            updated_at=updated_at,
        )
        return workout

    def update(
        self,
        workout_id: str,
        user_id: str,
        changes: dict[str, Any],
        updated_at: datetime,
    ) -> Workout:
        record = self._records.get(workout_id)
        if record is None or record.user_id != user_id:
            raise WorkoutNotFoundError(workout_id)

        payload = record.workout.model_dump()
        payload.update(changes)
        workout = Workout.model_validate(payload)
        self._records[workout_id] = WorkoutRecord(
            workout=workout,
            user_id=record.user_id,
            created_at=record.created_at,
            updated_at=updated_at,
        )
        return workout

    def delete(self, workout_id: str, user_id: str) -> None:
        record = self._records.get(workout_id)
        if record is None or record.user_id != user_id:
            raise WorkoutNotFoundError(workout_id)

        del self._records[workout_id]

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[Workout]:
        if start_date > end_date:
            raise ValueError("start_date must be on or before end_date")

        return sorted(
            (
                record.workout
                for record in self._records.values()
                if record.user_id == user_id
                and start_date <= record.workout.date <= end_date
            ),
            key=lambda workout: (workout.date, workout.id),
        )


class DynamoDBWorkoutRepository:
    def __init__(self, table: DynamoDBTable) -> None:
        self._table = table

    def get(self, workout_id: str) -> WorkoutRecord | None:
        response = self._table.get_item(
            Key={"id": workout_id},
            ConsistentRead=True,
        )
        item = response.get("Item")

        if item is None:
            return None

        return workout_record_from_item(cast(dict[str, Any], item))

    def create(
        self,
        workout: Workout,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> Workout:
        try:
            self._table.put_item(
                Item=workout_to_item(workout, user_id, created_at, updated_at),
                ConditionExpression="attribute_not_exists(#id)",
                ExpressionAttributeNames={"#id": "id"},
            )
        except ClientError as error:
            if _is_conditional_check_failure(error):
                raise WorkoutAlreadyExistsError(workout.id) from error
            raise

        return workout

    def update(
        self,
        workout_id: str,
        user_id: str,
        changes: dict[str, Any],
        updated_at: datetime,
    ) -> Workout:
        names = {
            "#id": "id",
            "#owner": "user_id",
            "#updated_at": "updated_at",
        }
        values: dict[str, Any] = {
            ":owner": user_id,
            ":updated_at": updated_at.isoformat(),
        }
        set_parts = ["#updated_at = :updated_at"]
        remove_parts: list[str] = []

        for field, value in changes.items():
            name = f"#{field}"
            names[name] = field
            if value is None:
                remove_parts.append(name)
                continue

            placeholder = f":{field}"
            values[placeholder] = _to_dynamodb_numbers(value)
            set_parts.append(f"{name} = {placeholder}")

            if field == "date":
                names["#user_date_key"] = "user_date_key"
                values[":user_date_key"] = f"{value}#{workout_id}"
                set_parts.append("#user_date_key = :user_date_key")

        expression = f"SET {', '.join(set_parts)}"
        if remove_parts:
            expression += f" REMOVE {', '.join(remove_parts)}"

        try:
            response = self._table.update_item(
                Key={"id": workout_id},
                UpdateExpression=expression,
                ConditionExpression="attribute_exists(#id) AND #owner = :owner",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ReturnValues="ALL_NEW",
            )
        except ClientError as error:
            if _is_conditional_check_failure(error):
                raise WorkoutNotFoundError(workout_id) from error
            raise

        attributes = response.get("Attributes")
        if attributes is None:
            raise RuntimeError("DynamoDB update did not return the updated workout")

        return workout_from_item(cast(dict[str, Any], attributes))

    def delete(self, workout_id: str, user_id: str) -> None:
        try:
            self._table.delete_item(
                Key={"id": workout_id},
                ConditionExpression="attribute_exists(#id) AND #owner = :owner",
                ExpressionAttributeNames={"#id": "id", "#owner": "user_id"},
                ExpressionAttributeValues={":owner": user_id},
            )
        except ClientError as error:
            if _is_conditional_check_failure(error):
                raise WorkoutNotFoundError(workout_id) from error
            raise

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


def workout_record_from_item(item: dict[str, Any]) -> WorkoutRecord:
    return WorkoutRecord(
        workout=workout_from_item(item),
        user_id=cast(str, item["user_id"]),
        created_at=datetime.fromisoformat(cast(str, item["created_at"])),
        updated_at=datetime.fromisoformat(cast(str, item["updated_at"])),
    )


def _is_conditional_check_failure(error: ClientError) -> bool:
    return (
        error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException"
    )


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
