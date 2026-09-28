from datetime import date

import pytest
from pydantic import ValidationError

from runner_api.models.strength import (
    ActualSet,
    ExerciseBlockInput,
    PlannedSet,
    PlannedSetInput,
    StrengthSession,
    materialize_exercise_blocks,
)


def test_materialization_generates_nested_ids_and_preserves_snapshot_values() -> None:
    blocks = materialize_exercise_blocks(
        [
            ExerciseBlockInput(
                exercise_id="bench_press",
                order=1,
                planned_sets=[
                    PlannedSetInput(
                        set_number=1,
                        target_reps=5,
                        percentage=65,
                        max_source="bench_press",
                        max_value_at_creation=265,
                        target_weight=170,
                    )
                ],
            )
        ]
    )

    assert blocks[0].id
    assert blocks[0].planned_sets[0].id
    assert blocks[0].planned_sets[0].max_value_at_creation == 265
    assert blocks[0].actual_sets == []


def test_actual_set_must_reference_planned_set_in_same_block() -> None:
    with pytest.raises(ValidationError, match="supplied planned set id"):
        ExerciseBlockInput(
            exercise_id="bench_press",
            order=1,
            planned_sets=[PlannedSetInput(set_number=1, target_reps=5)],
            actual_sets=[ActualSet(planned_set_id="missing", completed=True)],
        )


def test_session_rejects_duplicate_or_unsorted_order_values() -> None:
    planned = [PlannedSet(id="set", set_number=1, target_reps=5)]
    base = {
        "date": date(2026, 9, 21),
        "title": "Order test",
        "exercise_blocks": [
            {
                "id": "second",
                "exercise_id": "back_squat",
                "order": 2,
                "planned_sets": planned,
                "actual_sets": [],
            },
            {
                "id": "first",
                "exercise_id": "bench_press",
                "order": 1,
                "planned_sets": planned,
                "actual_sets": [],
            },
        ],
    }

    with pytest.raises(ValidationError, match="ordered by order"):
        StrengthSession(id="session", **base)


def test_model_does_not_derive_prescription_from_current_max() -> None:
    planned = PlannedSet(
        id="set",
        set_number=1,
        target_reps=5,
        percentage=50,
        max_source="bench_press",
        max_value_at_creation=265,
        target_weight=135,
    )

    assert planned.model_dump() == {
        "id": "set",
        "set_number": 1,
        "target_reps": 5,
        "percentage": 50.0,
        "max_source": "bench_press",
        "max_value_at_creation": 265.0,
        "target_weight": 135.0,
        "rest_seconds": None,
    }
