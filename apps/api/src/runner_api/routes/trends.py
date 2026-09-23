from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from runner_api.auth import CurrentUser, get_current_user
from runner_api.dependencies import get_workout_repository
from runner_api.models.workout import MileageTrendPoint, has_actual_execution
from runner_api.repositories.workouts import WorkoutRepository

router = APIRouter(prefix="/trends", tags=["trends"])


def get_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


@router.get("/mileage", response_model=list[MileageTrendPoint])
def get_mileage_trend(
    end: date,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[WorkoutRepository, Depends(get_workout_repository)],
    weeks: int = 12,
) -> list[MileageTrendPoint]:
    if weeks < 1 or weeks > 52:
        raise HTTPException(
            status_code=400,
            detail="weeks must be between 1 and 52",
        )

    end_week_start = get_week_start(end)
    range_start = end_week_start - timedelta(weeks=weeks - 1)
    range_end = end_week_start + timedelta(days=6)
    range_workouts = repository.list_between(
        current_user.id,
        range_start,
        range_end,
    )

    points: list[MileageTrendPoint] = []

    for offset in range(weeks - 1, -1, -1):
        week_start = end_week_start - timedelta(weeks=offset)
        week_end = week_start + timedelta(days=6)

        workouts = [
            workout
            for workout in range_workouts
            if week_start <= workout.date <= week_end
        ]

        planned_distance = sum(workout.planned_distance or 0 for workout in workouts)

        actual_distance = sum(
            workout.distance or 0
            for workout in workouts
            if has_actual_execution(workout.distance, workout.duration_seconds)
        )

        points.append(
            MileageTrendPoint(
                week_start=week_start,
                planned_distance=planned_distance,
                actual_distance=actual_distance,
            )
        )

    return points
