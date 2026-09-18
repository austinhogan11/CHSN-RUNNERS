from datetime import date

from runner_api.models.workout import Workout, WorkoutStatus

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
