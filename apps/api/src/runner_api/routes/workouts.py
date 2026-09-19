from datetime import date, timedelta

from fastapi import APIRouter

from runner_api.data.workouts import WORKOUTS
from runner_api.models.workout import WeekSummary, WorkoutStatus

router = APIRouter(prefix="/weeks", tags=["weeks"])


def get_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


@router.get("/{day}", response_model=WeekSummary)
def get_week(day: date) -> WeekSummary:
    week_start = get_week_start(day)
    week_end = week_start + timedelta(days=6)

    workouts = [
        workout for workout in WORKOUTS if week_start <= workout.date <= week_end
    ]

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
