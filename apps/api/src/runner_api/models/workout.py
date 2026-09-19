from datetime import date, time
from enum import StrEnum
from math import floor

from pydantic import BaseModel, Field


class WorkoutStatus(StrEnum):
    PLANNED = "planned"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class WorkoutType(StrEnum):
    RUN = "run"
    REST = "rest"
    STRENGTH = "strength"
    CROSS_TRAINING = "cross_training"
    OTHER = "other"


def calculate_average_pace_seconds(
    duration_seconds: int | None,
    distance: float | None,
) -> int | None:
    if duration_seconds is None or distance is None or distance <= 0:
        return None

    return floor(duration_seconds / distance + 0.5)


class Workout(BaseModel):
    id: str
    date: date
    type: WorkoutType = WorkoutType.RUN
    title: str | None = None
    description: str | None = None

    planned_distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    start_time: time | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    status: WorkoutStatus = WorkoutStatus.PLANNED


class WeekSummary(BaseModel):
    week_start: date
    planned_distance: float
    actual_distance: float
    workouts: list[Workout]


class MileageTrendPoint(BaseModel):
    week_start: date
    planned_distance: float
    actual_distance: float
