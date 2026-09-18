from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from runner_api.models.workout import WeekSummary, Workout, WorkoutStatus

router = APIRouter(prefix="/weeks", tags=["weeks"])


WORKOUTS = [
    Workout(
        id="workout-1",
        date=date(2026, 9, 14),
        title="Easy Run",
        description="Keep it relaxed",
        planned_distance=5.0,
        distance=5.1,
        duration_seconds=2460,
        avg_pace_seconds=482,
        status=WorkoutStatus.COMPLETED,
    ),
    Workout(
        id="workout-2",
        date=date(2026, 9, 15),
        title="Workout",
        description="6 x 800m at 10K effort",
        planned_distance=7.0,
        status=WorkoutStatus.PLANNED,
    ),
    Workout(
        id="workout-3",
        date=date(2026, 9, 17),
        title="Easy Run",
        planned_distance=6.0,
        status=WorkoutStatus.PLANNED,
    ),
    Workout(
        id="workout-4",
        date=date(2026, 9, 20),
        title="Long Run",
        planned_distance=12.0,
        status=WorkoutStatus.PLANNED,
    ),
]


def get_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


@router.get("/{day}", response_model=WeekSummary)
def get_week(day: date) -> WeekSummary:
    week_start = get_week_start(day)
    week_end = week_start + timedelta(days=6)

    workouts = [
        workout for workout in WORKOUTS if week_start <= workout.date <= week_end
    ]

    if not workouts:
        raise HTTPException(
            status_code=404,
            detail="No workouts found for this week",
        )

    planned_distance = sum(workout.planned_distance for workout in workouts)

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
