from datetime import date

from runner_api.models.workout import Workout, WorkoutStatus, WorkoutType

WORKOUTS = [
    Workout(
        id="workout-1",
        date=date(2026, 9, 14),
        type=WorkoutType.RUN,
        title="Easy Run",
        description="Keep it relaxed",
        planned_distance=5.0,
        distance=5.1,
        duration_seconds=2460,
        status=WorkoutStatus.COMPLETED,
    ),
    Workout(
        id="workout-2",
        date=date(2026, 9, 15),
        type=WorkoutType.RUN,
        title="Workout",
        description="6 x 800m at 10K effort",
        planned_distance=7.0,
        status=WorkoutStatus.PLANNED,
    ),
    Workout(
        id="workout-3",
        date=date(2026, 9, 17),
        type=WorkoutType.RUN,
        title="Easy Run",
        planned_distance=6.0,
        status=WorkoutStatus.PLANNED,
    ),
    Workout(
        id="workout-4",
        date=date(2026, 9, 20),
        type=WorkoutType.RUN,
        title="Long Run",
        planned_distance=12.0,
        status=WorkoutStatus.PLANNED,
    ),
]
