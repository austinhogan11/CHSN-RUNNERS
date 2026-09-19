from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from runner_api.data.workouts import WORKOUTS
from runner_api.models.workout import MileageTrendPoint, WorkoutStatus

router = APIRouter(prefix="/trends", tags=["trends"])


def get_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


@router.get("/mileage", response_model=list[MileageTrendPoint])
def get_mileage_trend(
    end: date,
    weeks: int = 12,
) -> list[MileageTrendPoint]:
    if weeks < 1 or weeks > 52:
        raise HTTPException(
            status_code=400,
            detail="weeks must be between 1 and 52",
        )

    end_week_start = get_week_start(end)

    points: list[MileageTrendPoint] = []

    for offset in range(weeks - 1, -1, -1):
        week_start = end_week_start - timedelta(weeks=offset)
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

        points.append(
            MileageTrendPoint(
                week_start=week_start,
                planned_distance=planned_distance,
                actual_distance=actual_distance,
            )
        )

    return points
