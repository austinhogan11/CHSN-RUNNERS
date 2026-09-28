from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol, cast

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from runner_api.models.strength import (
    Exercise,
    StrengthMax,
    StrengthSession,
    StrengthTemplate,
)
from runner_api.repositories.workouts import DynamoDBTable

USER_DATE_INDEX = "user-date-index"
USER_ID_INDEX = "user-id-index"


class StrengthResourceAlreadyExistsError(Exception):
    pass


class StrengthResourceNotFoundError(Exception):
    pass


@dataclass(frozen=True)
class StrengthSessionRecord:
    session: StrengthSession
    user_id: str
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class StrengthTemplateRecord:
    template: StrengthTemplate
    user_id: str
    created_at: datetime
    updated_at: datetime


class StrengthMaxRepository(Protocol):
    def upsert(self, item: StrengthMax, user_id: str) -> StrengthMax: ...

    def list_for_user(self, user_id: str) -> list[StrengthMax]: ...


class ExerciseRepository(Protocol):
    def get(self, user_id: str, exercise_id: str) -> Exercise | None: ...

    def create(self, exercise: Exercise, user_id: str) -> Exercise: ...

    def list_for_user(self, user_id: str) -> list[Exercise]: ...


class StrengthSessionRepository(Protocol):
    def get(self, session_id: str) -> StrengthSessionRecord | None: ...

    def create(
        self,
        session: StrengthSession,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> StrengthSession: ...

    def update(
        self,
        session: StrengthSession,
        user_id: str,
        updated_at: datetime,
    ) -> StrengthSession: ...

    def delete(self, session_id: str, user_id: str) -> None: ...

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[StrengthSession]: ...


class StrengthTemplateRepository(Protocol):
    def get(self, template_id: str) -> StrengthTemplateRecord | None: ...

    def create(
        self,
        template: StrengthTemplate,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> StrengthTemplate: ...

    def update(
        self,
        template: StrengthTemplate,
        user_id: str,
        updated_at: datetime,
    ) -> StrengthTemplate: ...

    def delete(self, template_id: str, user_id: str) -> None: ...

    def list_for_user(self, user_id: str) -> list[StrengthTemplate]: ...


@dataclass(frozen=True)
class StrengthRepositories:
    maxes: StrengthMaxRepository
    exercises: ExerciseRepository
    sessions: StrengthSessionRepository
    templates: StrengthTemplateRepository


class InMemoryStrengthMaxRepository:
    def __init__(self, items: Iterable[tuple[str, StrengthMax]] = ()) -> None:
        self._items = {
            (user_id, item.exercise_key, item.effective_date): item
            for user_id, item in items
        }

    def upsert(self, item: StrengthMax, user_id: str) -> StrengthMax:
        key = (user_id, item.exercise_key, item.effective_date)
        existing = self._items.get(key)
        if existing is not None:
            item = item.model_copy(
                update={"id": existing.id, "created_at": existing.created_at}
            )
        self._items[key] = item
        return item

    def list_for_user(self, user_id: str) -> list[StrengthMax]:
        return sorted(
            (item for key, item in self._items.items() if key[0] == user_id),
            key=lambda item: (item.exercise_key, item.effective_date, item.id),
        )


class InMemoryExerciseRepository:
    def __init__(self, items: Iterable[tuple[str, Exercise]] = ()) -> None:
        self._items = {(user_id, item.id): item for user_id, item in items}

    def get(self, user_id: str, exercise_id: str) -> Exercise | None:
        return self._items.get((user_id, exercise_id))

    def create(self, exercise: Exercise, user_id: str) -> Exercise:
        key = (user_id, exercise.id)
        if key in self._items:
            raise StrengthResourceAlreadyExistsError(exercise.id)
        self._items[key] = exercise
        return exercise

    def list_for_user(self, user_id: str) -> list[Exercise]:
        return sorted(
            (item for key, item in self._items.items() if key[0] == user_id),
            key=lambda item: (item.name.casefold(), item.id),
        )


class InMemoryStrengthSessionRepository:
    def __init__(self) -> None:
        self._records: dict[str, StrengthSessionRecord] = {}

    def get(self, session_id: str) -> StrengthSessionRecord | None:
        return self._records.get(session_id)

    def create(
        self,
        session: StrengthSession,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> StrengthSession:
        if session.id in self._records:
            raise StrengthResourceAlreadyExistsError(session.id)
        self._records[session.id] = StrengthSessionRecord(
            session=session,
            user_id=user_id,
            created_at=created_at,
            updated_at=updated_at,
        )
        return session

    def update(
        self,
        session: StrengthSession,
        user_id: str,
        updated_at: datetime,
    ) -> StrengthSession:
        record = self._records.get(session.id)
        if record is None or record.user_id != user_id:
            raise StrengthResourceNotFoundError(session.id)
        self._records[session.id] = StrengthSessionRecord(
            session=session,
            user_id=user_id,
            created_at=record.created_at,
            updated_at=updated_at,
        )
        return session

    def delete(self, session_id: str, user_id: str) -> None:
        record = self._records.get(session_id)
        if record is None or record.user_id != user_id:
            raise StrengthResourceNotFoundError(session_id)
        del self._records[session_id]

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[StrengthSession]:
        if start_date > end_date:
            raise ValueError("start_date must be on or before end_date")
        return sorted(
            (
                record.session
                for record in self._records.values()
                if record.user_id == user_id
                and start_date <= record.session.date <= end_date
            ),
            key=lambda session: (session.date, session.id),
        )


class InMemoryStrengthTemplateRepository:
    def __init__(self) -> None:
        self._records: dict[str, StrengthTemplateRecord] = {}

    def get(self, template_id: str) -> StrengthTemplateRecord | None:
        return self._records.get(template_id)

    def create(
        self,
        template: StrengthTemplate,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> StrengthTemplate:
        if template.id in self._records:
            raise StrengthResourceAlreadyExistsError(template.id)
        self._records[template.id] = StrengthTemplateRecord(
            template=template,
            user_id=user_id,
            created_at=created_at,
            updated_at=updated_at,
        )
        return template

    def update(
        self,
        template: StrengthTemplate,
        user_id: str,
        updated_at: datetime,
    ) -> StrengthTemplate:
        record = self._records.get(template.id)
        if record is None or record.user_id != user_id:
            raise StrengthResourceNotFoundError(template.id)
        self._records[template.id] = StrengthTemplateRecord(
            template=template,
            user_id=user_id,
            created_at=record.created_at,
            updated_at=updated_at,
        )
        return template

    def delete(self, template_id: str, user_id: str) -> None:
        record = self._records.get(template_id)
        if record is None or record.user_id != user_id:
            raise StrengthResourceNotFoundError(template_id)
        del self._records[template_id]

    def list_for_user(self, user_id: str) -> list[StrengthTemplate]:
        return sorted(
            (
                record.template
                for record in self._records.values()
                if record.user_id == user_id
            ),
            key=lambda template: (template.name.casefold(), template.id),
        )


class DynamoDBStrengthMaxRepository:
    def __init__(self, table: DynamoDBTable) -> None:
        self._table = table

    def upsert(self, item: StrengthMax, user_id: str) -> StrengthMax:
        max_key = _max_key(item.exercise_key, item.effective_date)
        response = self._table.get_item(
            Key={"user_id": user_id, "max_key": max_key},
            ConsistentRead=True,
        )
        existing = response.get("Item")
        if existing is not None:
            current = strength_max_from_item(cast(dict[str, Any], existing))
            item = item.model_copy(
                update={"id": current.id, "created_at": current.created_at}
            )
        self._table.put_item(Item=strength_max_to_item(item, user_id))
        return item

    def list_for_user(self, user_id: str) -> list[StrengthMax]:
        items = _query_all(
            self._table,
            KeyConditionExpression=Key("user_id").eq(user_id),
            ScanIndexForward=True,
        )
        return [strength_max_from_item(item) for item in items]


class DynamoDBExerciseRepository:
    def __init__(self, table: DynamoDBTable) -> None:
        self._table = table

    def get(self, user_id: str, exercise_id: str) -> Exercise | None:
        response = self._table.get_item(
            Key={"user_id": user_id, "id": exercise_id},
            ConsistentRead=True,
        )
        item = response.get("Item")
        if item is None:
            return None
        return exercise_from_item(cast(dict[str, Any], item))

    def create(self, exercise: Exercise, user_id: str) -> Exercise:
        try:
            self._table.put_item(
                Item=exercise_to_item(exercise, user_id),
                ConditionExpression="attribute_not_exists(#id)",
                ExpressionAttributeNames={"#id": "id"},
            )
        except ClientError as error:
            if _is_conditional_check_failure(error):
                raise StrengthResourceAlreadyExistsError(exercise.id) from error
            raise
        return exercise

    def list_for_user(self, user_id: str) -> list[Exercise]:
        items = _query_all(
            self._table,
            KeyConditionExpression=Key("user_id").eq(user_id),
            ScanIndexForward=True,
        )
        return sorted(
            (exercise_from_item(item) for item in items),
            key=lambda exercise: (exercise.name.casefold(), exercise.id),
        )


class DynamoDBStrengthSessionRepository:
    def __init__(self, table: DynamoDBTable) -> None:
        self._table = table

    def get(self, session_id: str) -> StrengthSessionRecord | None:
        response = self._table.get_item(Key={"id": session_id}, ConsistentRead=True)
        item = response.get("Item")
        if item is None:
            return None
        return strength_session_record_from_item(cast(dict[str, Any], item))

    def create(
        self,
        session: StrengthSession,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> StrengthSession:
        try:
            self._table.put_item(
                Item=strength_session_to_item(session, user_id, created_at, updated_at),
                ConditionExpression="attribute_not_exists(#id)",
                ExpressionAttributeNames={"#id": "id"},
            )
        except ClientError as error:
            if _is_conditional_check_failure(error):
                raise StrengthResourceAlreadyExistsError(session.id) from error
            raise
        return session

    def update(
        self,
        session: StrengthSession,
        user_id: str,
        updated_at: datetime,
    ) -> StrengthSession:
        _update_owned_document(
            self._table,
            session.id,
            user_id,
            {
                "date": session.date.isoformat(),
                "user_date_key": f"{session.date.isoformat()}#{session.id}",
                "title": session.title,
                "notes": session.notes,
                "exercise_blocks": session.model_dump(mode="json")["exercise_blocks"],
            },
            updated_at,
        )
        return session

    def delete(self, session_id: str, user_id: str) -> None:
        _delete_owned_document(self._table, session_id, user_id)

    def list_between(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> list[StrengthSession]:
        if start_date > end_date:
            raise ValueError("start_date must be on or before end_date")
        items = _query_all(
            self._table,
            IndexName=USER_DATE_INDEX,
            KeyConditionExpression=Key("user_id").eq(user_id)
            & Key("user_date_key").between(
                f"{start_date.isoformat()}#",
                f"{end_date.isoformat()}$",
            ),
            ScanIndexForward=True,
        )
        return [strength_session_from_item(item) for item in items]


class DynamoDBStrengthTemplateRepository:
    def __init__(self, table: DynamoDBTable) -> None:
        self._table = table

    def get(self, template_id: str) -> StrengthTemplateRecord | None:
        response = self._table.get_item(Key={"id": template_id}, ConsistentRead=True)
        item = response.get("Item")
        if item is None:
            return None
        return strength_template_record_from_item(cast(dict[str, Any], item))

    def create(
        self,
        template: StrengthTemplate,
        user_id: str,
        created_at: datetime,
        updated_at: datetime,
    ) -> StrengthTemplate:
        try:
            self._table.put_item(
                Item=strength_template_to_item(
                    template, user_id, created_at, updated_at
                ),
                ConditionExpression="attribute_not_exists(#id)",
                ExpressionAttributeNames={"#id": "id"},
            )
        except ClientError as error:
            if _is_conditional_check_failure(error):
                raise StrengthResourceAlreadyExistsError(template.id) from error
            raise
        return template

    def update(
        self,
        template: StrengthTemplate,
        user_id: str,
        updated_at: datetime,
    ) -> StrengthTemplate:
        _update_owned_document(
            self._table,
            template.id,
            user_id,
            {
                "name": template.name,
                "exercise_blocks": template.model_dump(mode="json")["exercise_blocks"],
            },
            updated_at,
        )
        return template

    def delete(self, template_id: str, user_id: str) -> None:
        _delete_owned_document(self._table, template_id, user_id)

    def list_for_user(self, user_id: str) -> list[StrengthTemplate]:
        items = _query_all(
            self._table,
            IndexName=USER_ID_INDEX,
            KeyConditionExpression=Key("user_id").eq(user_id),
            ScanIndexForward=True,
        )
        return sorted(
            (strength_template_from_item(item) for item in items),
            key=lambda template: (template.name.casefold(), template.id),
        )


def strength_max_to_item(item: StrengthMax, user_id: str) -> dict[str, Any]:
    payload = item.model_dump(mode="json")
    payload.update(
        {
            "user_id": user_id,
            "max_key": _max_key(item.exercise_key, item.effective_date),
        }
    )
    return cast(dict[str, Any], _to_dynamodb_numbers(payload))


def strength_max_from_item(item: dict[str, Any]) -> StrengthMax:
    return _model_from_item(StrengthMax, item)


def exercise_to_item(exercise: Exercise, user_id: str) -> dict[str, Any]:
    payload = exercise.model_dump(mode="json", exclude_none=True)
    payload["user_id"] = user_id
    return payload


def exercise_from_item(item: dict[str, Any]) -> Exercise:
    return _model_from_item(Exercise, item)


def strength_session_to_item(
    session: StrengthSession,
    user_id: str,
    created_at: datetime,
    updated_at: datetime,
) -> dict[str, Any]:
    payload = session.model_dump(mode="json", exclude_none=True)
    payload.update(
        {
            "user_id": user_id,
            "user_date_key": f"{session.date.isoformat()}#{session.id}",
            "created_at": created_at.isoformat(),
            "updated_at": updated_at.isoformat(),
        }
    )
    return cast(dict[str, Any], _to_dynamodb_numbers(payload))


def strength_session_from_item(item: dict[str, Any]) -> StrengthSession:
    return _model_from_item(StrengthSession, item)


def strength_session_record_from_item(
    item: dict[str, Any],
) -> StrengthSessionRecord:
    return StrengthSessionRecord(
        session=strength_session_from_item(item),
        user_id=cast(str, item["user_id"]),
        created_at=datetime.fromisoformat(cast(str, item["created_at"])),
        updated_at=datetime.fromisoformat(cast(str, item["updated_at"])),
    )


def strength_template_to_item(
    template: StrengthTemplate,
    user_id: str,
    created_at: datetime,
    updated_at: datetime,
) -> dict[str, Any]:
    payload = template.model_dump(mode="json", exclude_none=True)
    payload.update(
        {
            "user_id": user_id,
            "created_at": created_at.isoformat(),
            "updated_at": updated_at.isoformat(),
        }
    )
    return cast(dict[str, Any], _to_dynamodb_numbers(payload))


def strength_template_from_item(item: dict[str, Any]) -> StrengthTemplate:
    return _model_from_item(StrengthTemplate, item)


def strength_template_record_from_item(
    item: dict[str, Any],
) -> StrengthTemplateRecord:
    return StrengthTemplateRecord(
        template=strength_template_from_item(item),
        user_id=cast(str, item["user_id"]),
        created_at=datetime.fromisoformat(cast(str, item["created_at"])),
        updated_at=datetime.fromisoformat(cast(str, item["updated_at"])),
    )


def _max_key(exercise_key: str, effective_date: date) -> str:
    return f"{exercise_key}#{effective_date.isoformat()}"


def _query_all(table: DynamoDBTable, **query: Any) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    while True:
        response = table.query(**query)
        items.extend(cast(list[dict[str, Any]], response.get("Items", [])))
        last_key = response.get("LastEvaluatedKey")
        if last_key is None:
            break
        query["ExclusiveStartKey"] = last_key
    return items


def _update_owned_document(
    table: DynamoDBTable,
    item_id: str,
    user_id: str,
    values_to_set: dict[str, Any],
    updated_at: datetime,
) -> None:
    names = {"#id": "id", "#owner": "user_id", "#updated_at": "updated_at"}
    values: dict[str, Any] = {
        ":owner": user_id,
        ":updated_at": updated_at.isoformat(),
    }
    set_parts = ["#updated_at = :updated_at"]
    remove_parts: list[str] = []
    for field, value in values_to_set.items():
        name = f"#{field}"
        names[name] = field
        if value is None:
            remove_parts.append(name)
            continue
        placeholder = f":{field}"
        values[placeholder] = _to_dynamodb_numbers(value)
        set_parts.append(f"{name} = {placeholder}")
    expression = f"SET {', '.join(set_parts)}"
    if remove_parts:
        expression += f" REMOVE {', '.join(remove_parts)}"
    try:
        table.update_item(
            Key={"id": item_id},
            UpdateExpression=expression,
            ConditionExpression="attribute_exists(#id) AND #owner = :owner",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )
    except ClientError as error:
        if _is_conditional_check_failure(error):
            raise StrengthResourceNotFoundError(item_id) from error
        raise


def _delete_owned_document(
    table: DynamoDBTable,
    item_id: str,
    user_id: str,
) -> None:
    try:
        table.delete_item(
            Key={"id": item_id},
            ConditionExpression="attribute_exists(#id) AND #owner = :owner",
            ExpressionAttributeNames={"#id": "id", "#owner": "user_id"},
            ExpressionAttributeValues={":owner": user_id},
        )
    except ClientError as error:
        if _is_conditional_check_failure(error):
            raise StrengthResourceNotFoundError(item_id) from error
        raise


def _model_from_item(model: type[Any], item: dict[str, Any]) -> Any:
    fields = model.model_fields.keys()
    payload = {
        key: _from_dynamodb_numbers(value)
        for key, value in item.items()
        if key in fields
    }
    return model.model_validate(payload)


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
