from datetime import date, time
from enum import StrEnum

from pydantic import BaseModel, Field


class WorkoutStatus(StrEnum):
    PLANNED = "planned"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class Workout(BaseModel):
    id: str
    date: date
    title: str
    description: str | None = None

    planned_distance: float = Field(ge=0)

    start_time: time | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    distance: float | None = Field(default=None, ge=0)
    avg_pace_seconds: int | None = Field(default=None, ge=0)

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
