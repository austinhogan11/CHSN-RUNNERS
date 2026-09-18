from datetime import date, time

import pytest
from pydantic import ValidationError

from runner_api.models.workout import (
    MileageTrendPoint,
    WeekSummary,
    Workout,
    WorkoutStatus,
)


def test_planned_workout_allows_missing_execution_fields() -> None:
    workout = Workout(
        id="workout-1",
        date=date(2026, 9, 21),
        title="Easy Run",
        planned_distance=6.0,
    )

    assert workout.status == WorkoutStatus.PLANNED
    assert workout.description is None
    assert workout.start_time is None
    assert workout.duration_seconds is None
    assert workout.distance is None
    assert workout.avg_pace_seconds is None


def test_completed_workout_accepts_execution_data() -> None:
    workout = Workout(
        id="workout-2",
        date=date(2026, 9, 22),
        title="Threshold Workout",
        description="4 x 1 mile at threshold",
        planned_distance=8.0,
        start_time=time(7, 15),
        duration_seconds=3720,
        distance=8.1,
        avg_pace_seconds=459,
        status=WorkoutStatus.COMPLETED,
    )

    assert workout.status == WorkoutStatus.COMPLETED
    assert workout.distance == 8.1
    assert workout.duration_seconds == 3720
    assert workout.avg_pace_seconds == 459


def test_workout_rejects_negative_planned_distance() -> None:
    with pytest.raises(ValidationError):
        Workout(
            id="workout-3",
            date=date(2026, 9, 23),
            title="Easy Run",
            planned_distance=-1.0,
        )


def test_workout_rejects_negative_actual_distance() -> None:
    with pytest.raises(ValidationError):
        Workout(
            id="workout-4",
            date=date(2026, 9, 24),
            title="Easy Run",
            planned_distance=5.0,
            distance=-0.5,
        )


def test_week_summary_contains_workouts() -> None:
    workout = Workout(
        id="workout-5",
        date=date(2026, 9, 21),
        title="Easy Run",
        planned_distance=6.0,
        distance=6.2,
        status=WorkoutStatus.COMPLETED,
    )

    summary = WeekSummary(
        week_start=date(2026, 9, 21),
        planned_distance=6.0,
        actual_distance=6.2,
        workouts=[workout],
    )

    assert summary.week_start == date(2026, 9, 21)
    assert summary.planned_distance == 6.0
    assert summary.actual_distance == 6.2
    assert summary.workouts == [workout]


def test_mileage_trend_point_represents_weekly_totals() -> None:
    point = MileageTrendPoint(
        week_start=date(2026, 9, 21),
        planned_distance=42.0,
        actual_distance=40.6,
    )

    assert point.week_start == date(2026, 9, 21)
    assert point.planned_distance == 42.0
    assert point.actual_distance == 40.6
