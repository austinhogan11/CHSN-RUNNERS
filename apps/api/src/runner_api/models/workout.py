from datetime import date as Date
from datetime import time
from enum import StrEnum
from math import floor

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    date: Date
    type: WorkoutType = WorkoutType.RUN
    title: str | None = None
    description: str | None = None

    planned_distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    start_time: time | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    status: WorkoutStatus = WorkoutStatus.PLANNED


class WorkoutCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Date
    type: WorkoutType = WorkoutType.RUN
    status: WorkoutStatus = WorkoutStatus.PLANNED
    title: str | None = None
    description: str | None = None
    planned_distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    start_time: time | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class WorkoutUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Date | None = None
    type: WorkoutType | None = None
    status: WorkoutStatus | None = None
    title: str | None = None
    description: str | None = None
    planned_distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    start_time: time | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    @field_validator("date", "type", "status")
    @classmethod
    def required_fields_cannot_be_cleared(cls, value: object) -> object:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class WeekSummary(BaseModel):
    week_start: Date
    planned_distance: float
    actual_distance: float
    workouts: list[Workout]


class MileageTrendPoint(BaseModel):
    week_start: Date
    planned_distance: float
    actual_distance: float
