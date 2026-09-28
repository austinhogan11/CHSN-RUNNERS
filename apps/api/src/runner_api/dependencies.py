from functools import lru_cache
from typing import Any, cast

import boto3

from runner_api.config import settings
from runner_api.data.workouts import WORKOUTS
from runner_api.repositories.strength import (
    DynamoDBExerciseRepository,
    DynamoDBStrengthMaxRepository,
    DynamoDBStrengthSessionRepository,
    DynamoDBStrengthTemplateRepository,
    InMemoryExerciseRepository,
    InMemoryStrengthMaxRepository,
    InMemoryStrengthSessionRepository,
    InMemoryStrengthTemplateRepository,
    StrengthRepositories,
)
from runner_api.repositories.workouts import (
    DynamoDBTable,
    DynamoDBWorkoutRepository,
    InMemoryWorkoutRepository,
    WorkoutRepository,
)


@lru_cache
def get_workout_repository() -> WorkoutRepository:
    if settings.workout_repository == "memory":
        return InMemoryWorkoutRepository(
            WORKOUTS,
            user_id=settings.workout_demo_user_id,
        )

    if settings.workout_table_name is None:
        raise RuntimeError(
            "WORKOUT_TABLE_NAME is required when WORKOUT_REPOSITORY=dynamodb"
        )

    dynamodb = boto3.resource("dynamodb")
    table = cast(DynamoDBTable, cast(Any, dynamodb).Table(settings.workout_table_name))
    return DynamoDBWorkoutRepository(table)


@lru_cache
def get_strength_repositories() -> StrengthRepositories:
    if settings.strength_repository == "memory":
        return StrengthRepositories(
            maxes=InMemoryStrengthMaxRepository(),
            exercises=InMemoryExerciseRepository(),
            sessions=InMemoryStrengthSessionRepository(),
            templates=InMemoryStrengthTemplateRepository(),
        )

    table_names = {
        "maxes": settings.strength_max_table_name,
        "exercises": settings.strength_exercise_table_name,
        "sessions": settings.strength_session_table_name,
        "templates": settings.strength_template_table_name,
    }
    missing = [name for name, table_name in table_names.items() if table_name is None]
    if missing:
        names = ", ".join(name.upper() for name in missing)
        raise RuntimeError(
            f"Strength table names are required for DynamoDB repositories: {names}"
        )

    dynamodb = cast(Any, boto3.resource("dynamodb"))
    return StrengthRepositories(
        maxes=DynamoDBStrengthMaxRepository(
            cast(DynamoDBTable, dynamodb.Table(table_names["maxes"]))
        ),
        exercises=DynamoDBExerciseRepository(
            cast(DynamoDBTable, dynamodb.Table(table_names["exercises"]))
        ),
        sessions=DynamoDBStrengthSessionRepository(
            cast(DynamoDBTable, dynamodb.Table(table_names["sessions"]))
        ),
        templates=DynamoDBStrengthTemplateRepository(
            cast(DynamoDBTable, dynamodb.Table(table_names["templates"]))
        ),
    )
