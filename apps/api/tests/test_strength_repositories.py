from datetime import UTC, date, datetime
from decimal import Decimal

from runner_api.models.strength import (
    ActualSet,
    DistanceUnit,
    ExerciseBlock,
    PlannedSet,
    StrengthMax,
    StrengthProgramProvenance,
    StrengthSession,
    StrengthTemplate,
    TemplateExerciseBlock,
    TemplatePlannedSet,
)
from runner_api.repositories.strength import (
    strength_max_from_item,
    strength_max_to_item,
    strength_session_from_item,
    strength_session_to_item,
    strength_template_from_item,
    strength_template_to_item,
)

TIMESTAMP = datetime(2026, 9, 1, tzinfo=UTC)


def test_max_item_round_trip_preserves_history_key_and_decimal_value() -> None:
    item = StrengthMax(
        id="max-1",
        exercise_key="bench_press",
        value=267.5,
        effective_date=date(2026, 9, 1),
        created_at=TIMESTAMP,
    )

    stored = strength_max_to_item(item, "user-1")

    assert stored["max_key"] == "bench_press#2026-09-01"
    assert stored["value"] == Decimal("267.5")
    assert "unit" not in stored
    assert strength_max_from_item(stored) == item


def test_session_item_round_trip_preserves_nested_planned_and_actual_sets() -> None:
    session = StrengthSession(
        id="session-1",
        date=date(2026, 9, 21),
        title="Bench",
        notes=None,
        exercise_blocks=[
            ExerciseBlock(
                id="block-1",
                exercise_id="bench_press",
                order=1,
                group_id="group-a",
                label="A1",
                planned_sets=[
                    PlannedSet(
                        id="set-1",
                        set_number=1,
                        target_distance=20,
                        distance_unit=DistanceUnit.YARDS,
                        target_weight=80,
                        rest_seconds=90,
                    )
                ],
                actual_sets=[
                    ActualSet(
                        planned_set_id="set-1",
                        actual_distance=22,
                        actual_weight=85,
                        completed=True,
                    )
                ],
            ),
            ExerciseBlock(
                id="block-2",
                exercise_id="timed_hold",
                order=2,
                planned_sets=[
                    PlannedSet(
                        id="set-2",
                        set_number=1,
                        target_duration_seconds=30,
                        target_weight=45,
                    )
                ],
                actual_sets=[
                    ActualSet(
                        planned_set_id="set-2",
                        actual_duration_seconds=35,
                        actual_weight=45,
                        completed=True,
                    )
                ],
            ),
        ],
        program=StrengthProgramProvenance(
            program_id="ppsa-sport-strength",
            program_name="PPSA Sport Strength",
            instance_id="instance-1",
            day_number=1,
            total_days=36,
            start_date=date(2026, 9, 21),
            days_per_week=3,
            selected_weekdays=[0, 2, 4],
        ),
    )

    stored = strength_session_to_item(
        session, "user-1", created_at=TIMESTAMP, updated_at=TIMESTAMP
    )

    assert stored["user_date_key"] == "2026-09-21#session-1"
    assert stored["program"]["instance_id"] == "instance-1"
    distance_set = stored["exercise_blocks"][0]["planned_sets"][0]
    duration_set = stored["exercise_blocks"][1]["planned_sets"][0]
    assert distance_set["target_distance"] == Decimal("20.0")
    assert distance_set["distance_unit"] == "yards"
    assert stored["exercise_blocks"][0]["actual_sets"][0]["actual_distance"] == Decimal(
        "22.0"
    )
    assert duration_set["target_duration_seconds"] == 30
    assert (
        stored["exercise_blocks"][1]["actual_sets"][0]["actual_duration_seconds"] == 35
    )
    assert strength_session_from_item(stored) == session


def test_template_item_round_trip_contains_prescription_only() -> None:
    template = StrengthTemplate(
        id="template-1",
        name="Bench",
        exercise_blocks=[
            TemplateExerciseBlock(
                id="block-1",
                exercise_id="bench_press",
                order=1,
                planned_sets=[
                    TemplatePlannedSet(
                        id="set-1",
                        set_number=1,
                        target_reps=5,
                        percentage=65,
                        max_source="bench_press",
                    )
                ],
            )
        ],
    )

    stored = strength_template_to_item(
        template, "user-1", created_at=TIMESTAMP, updated_at=TIMESTAMP
    )

    assert "actual_sets" not in stored["exercise_blocks"][0]
    planned = stored["exercise_blocks"][0]["planned_sets"][0]
    assert "max_value_at_creation" not in planned
    assert "target_weight" not in planned
    assert strength_template_from_item(stored) == template
