from functools import lru_cache
from typing import Any, cast

import boto3

from runner_api.config import settings
from runner_api.data.workouts import WORKOUTS
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
