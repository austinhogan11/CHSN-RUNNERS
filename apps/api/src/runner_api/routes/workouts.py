from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends

from runner_api.auth import CurrentUser, get_current_user
from runner_api.dependencies import get_workout_repository
from runner_api.models.workout import WeekSummary, WorkoutStatus
from runner_api.repositories.workouts import WorkoutRepository

router = APIRouter(prefix="/weeks", tags=["weeks"])


def get_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


@router.get("/{day}", response_model=WeekSummary)
def get_week(
    day: date,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[WorkoutRepository, Depends(get_workout_repository)],
) -> WeekSummary:
    week_start = get_week_start(day)
    week_end = week_start + timedelta(days=6)

    workouts = repository.list_between(
        current_user.id,
        week_start,
        week_end,
    )

    planned_distance = sum(workout.planned_distance or 0 for workout in workouts)

    actual_distance = sum(
        workout.distance or 0
        for workout in workouts
        if workout.status == WorkoutStatus.COMPLETED
    )

    return WeekSummary(
        week_start=week_start,
        planned_distance=planned_distance,
        actual_distance=actual_distance,
        workouts=workouts,
    )
