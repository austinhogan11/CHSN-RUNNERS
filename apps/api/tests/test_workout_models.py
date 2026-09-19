from datetime import date, time

import pytest
from pydantic import ValidationError

from runner_api.models.workout import (
    MileageTrendPoint,
    WeekSummary,
    Workout,
    WorkoutStatus,
    WorkoutType,
    calculate_average_pace_seconds,
)


def test_minimal_workout_requires_only_id_and_date() -> None:
    workout = Workout(id="workout-1", date=date(2026, 9, 21))

    assert workout.type == WorkoutType.RUN
    assert workout.status == WorkoutStatus.PLANNED
    assert workout.title is None
    assert workout.description is None
    assert workout.planned_distance is None
    assert workout.start_time is None
    assert workout.duration_seconds is None
    assert workout.distance is None
    assert "avg_pace_seconds" not in workout.model_dump()


@pytest.mark.parametrize("workout_type", list(WorkoutType))
def test_workout_accepts_each_type(workout_type: WorkoutType) -> None:
    workout = Workout(
        id=f"workout-{workout_type}",
        date=date(2026, 9, 21),
        type=workout_type,
    )

    assert workout.type == workout_type


def test_workout_accepts_all_optional_fields() -> None:
    workout = Workout(
        id="workout-2",
        date=date(2026, 9, 22),
        type=WorkoutType.CROSS_TRAINING,
        title="Bike",
        description="Easy aerobic ride",
        planned_distance=20,
        start_time=time(7, 15),
        duration_seconds=3600,
        distance=18.5,
        status=WorkoutStatus.COMPLETED,
    )

    assert workout.title == "Bike"
    assert workout.start_time == time(7, 15)
    assert workout.distance == 18.5


@pytest.mark.parametrize(
    ("status", "distance"),
    [
        (WorkoutStatus.PLANNED, None),
        (WorkoutStatus.COMPLETED, None),
        (WorkoutStatus.SKIPPED, 4.0),
    ],
)
def test_statuses_do_not_require_or_forbid_execution_data(
    status: WorkoutStatus,
    distance: float | None,
) -> None:
    workout = Workout(
        id=f"workout-{status}",
        date=date(2026, 9, 23),
        status=status,
        distance=distance,
    )

    assert workout.status == status
    assert workout.distance == distance


def test_explicit_rest_session_is_valid() -> None:
    workout = Workout(
        id="rest-1",
        date=date(2026, 9, 24),
        type=WorkoutType.REST,
    )

    assert workout.type == WorkoutType.REST
    assert workout.planned_distance is None
    assert workout.distance is None


def test_non_distance_session_is_valid() -> None:
    workout = Workout(
        id="strength-1",
        date=date(2026, 9, 24),
        type=WorkoutType.STRENGTH,
        title="Strength",
        duration_seconds=2700,
        status=WorkoutStatus.COMPLETED,
    )

    assert workout.distance is None
    assert workout.duration_seconds == 2700


def test_multiple_sessions_can_share_a_date() -> None:
    sessions = [
        Workout(id="run-am", date=date(2026, 9, 25)),
        Workout(id="run-pm", date=date(2026, 9, 25)),
    ]

    assert [session.id for session in sessions] == ["run-am", "run-pm"]


@pytest.mark.parametrize("field", ["planned_distance", "distance"])
@pytest.mark.parametrize("value", [-1.0, float("inf"), float("-inf"), float("nan")])
def test_distance_fields_reject_negative_or_non_finite_values(
    field: str,
    value: float,
) -> None:
    with pytest.raises(ValidationError):
        Workout.model_validate(
            {
                "id": "invalid-distance",
                "date": date(2026, 9, 26),
                field: value,
            }
        )


def test_workout_rejects_negative_duration() -> None:
    with pytest.raises(ValidationError):
        Workout(
            id="invalid-duration",
            date=date(2026, 9, 26),
            duration_seconds=-1,
        )


@pytest.mark.parametrize(
    ("duration_seconds", "distance"),
    [(None, 5.0), (2400, None), (2400, 0), (None, None)],
)
def test_average_pace_is_unavailable_without_positive_distance_and_duration(
    duration_seconds: int | None,
    distance: float | None,
) -> None:
    assert calculate_average_pace_seconds(duration_seconds, distance) is None


def test_average_pace_is_derived_from_duration_and_distance() -> None:
    assert calculate_average_pace_seconds(2460, 5.1) == 482
    assert calculate_average_pace_seconds(965, 2) == 483


def test_week_summary_contains_workouts() -> None:
    workout = Workout(
        id="workout-5",
        date=date(2026, 9, 21),
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
