from datetime import UTC, date, datetime
from decimal import Decimal

from runner_api.models.strength import (
    ActualSet,
    ExerciseBlock,
    PlannedSet,
    StrengthMax,
    StrengthSession,
    StrengthTemplate,
    StrengthUnit,
    TemplateExerciseBlock,
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
        unit=StrengthUnit.LB,
        effective_date=date(2026, 9, 1),
        created_at=TIMESTAMP,
    )

    stored = strength_max_to_item(item, "user-1")

    assert stored["max_key"] == "bench_press#2026-09-01"
    assert stored["value"] == Decimal("267.5")
    assert strength_max_from_item(stored) == item


def test_session_item_round_trip_preserves_nested_planned_and_actual_sets() -> None:
    planned = PlannedSet(
        id="set-1",
        set_number=1,
        target_reps=5,
        percentage=62.5,
        max_source="bench_press",
        max_value_at_creation=265,
        target_weight=165,
        rest_seconds=90,
    )
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
                planned_sets=[planned],
                actual_sets=[
                    ActualSet(
                        planned_set_id="set-1",
                        actual_reps=4,
                        actual_weight=170,
                        completed=True,
                    )
                ],
            )
        ],
    )

    stored = strength_session_to_item(
        session, "user-1", created_at=TIMESTAMP, updated_at=TIMESTAMP
    )

    assert stored["user_date_key"] == "2026-09-21#session-1"
    assert stored["exercise_blocks"][0]["planned_sets"][0]["percentage"] == Decimal(
        "62.5"
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
                planned_sets=[PlannedSet(id="set-1", set_number=1, target_reps=5)],
            )
        ],
    )

    stored = strength_template_to_item(
        template, "user-1", created_at=TIMESTAMP, updated_at=TIMESTAMP
    )

    assert "actual_sets" not in stored["exercise_blocks"][0]
    assert strength_template_from_item(stored) == template
