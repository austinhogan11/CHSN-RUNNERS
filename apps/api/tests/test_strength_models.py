from datetime import date

import pytest
from pydantic import ValidationError

from runner_api.models.strength import (
    ActualSet,
    DistanceUnit,
    ExerciseBlockInput,
    PlannedSet,
    PlannedSetInput,
    StrengthSession,
    StrengthSessionCreate,
    StrengthTemplateCreate,
    TemplateExerciseBlockInput,
    TemplatePlannedSetInput,
    materialize_exercise_blocks,
    materialize_template_blocks,
)


def test_materialization_generates_ids_and_preserves_session_snapshot_values() -> None:
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
    assert blocks[0].planned_sets[0].target_weight == 170
    assert blocks[0].actual_sets == []


def test_actual_set_must_reference_planned_set_in_same_block() -> None:
    with pytest.raises(ValidationError, match="supplied planned set id"):
        ExerciseBlockInput(
            exercise_id="bench_press",
            order=1,
            planned_sets=[PlannedSetInput(set_number=1, target_reps=5)],
            actual_sets=[ActualSet(planned_set_id="missing", completed=True)],
        )


def test_session_rejects_unsorted_order_values() -> None:
    blocks = [
        {
            "id": "second",
            "exercise_id": "back_squat",
            "order": 2,
            "planned_sets": [PlannedSet(id="set-1", set_number=1, target_reps=5)],
            "actual_sets": [],
        },
        {
            "id": "first",
            "exercise_id": "bench_press",
            "order": 1,
            "planned_sets": [PlannedSet(id="set-2", set_number=1, target_reps=5)],
            "actual_sets": [],
        },
    ]

    with pytest.raises(ValidationError, match="ordered by order"):
        StrengthSession.model_validate(
            {
                "id": "session",
                "date": date(2026, 9, 21),
                "title": "Order test",
                "exercise_blocks": blocks,
            }
        )


@pytest.mark.parametrize(
    ("model", "duplicate", "message"),
    [
        (StrengthSessionCreate, "block", "exercise block ids must be unique"),
        (
            StrengthSessionCreate,
            "set",
            "planned set ids must be unique across exercise blocks",
        ),
        (StrengthTemplateCreate, "block", "exercise block ids must be unique"),
        (
            StrengthTemplateCreate,
            "set",
            "planned set ids must be unique across exercise blocks",
        ),
    ],
)
def test_documents_reject_duplicate_nested_ids(
    model: type[StrengthSessionCreate] | type[StrengthTemplateCreate],
    duplicate: str,
    message: str,
) -> None:
    blocks = [
        {
            "id": "block-1",
            "exercise_id": "bench_press",
            "order": 1,
            "planned_sets": [{"id": "set-1", "set_number": 1, "target_reps": 5}],
        },
        {
            "id": "block-1" if duplicate == "block" else "block-2",
            "exercise_id": "db_row",
            "order": 2,
            "planned_sets": [
                {
                    "id": "set-1" if duplicate == "set" else "set-2",
                    "set_number": 1,
                    "target_reps": 8,
                }
            ],
        },
    ]
    payload: dict[str, object] = {
        "title": "Session",
        "date": date(2026, 9, 21),
    }
    if model is StrengthTemplateCreate:
        payload = {"name": "Template"}

    with pytest.raises(ValidationError, match=message):
        model.model_validate({**payload, "exercise_blocks": blocks})


def test_unique_nested_ids_are_valid_for_sessions_and_templates() -> None:
    blocks = [
        {
            "id": "block-1",
            "exercise_id": "bench_press",
            "order": 1,
            "planned_sets": [{"id": "set-1", "set_number": 1, "target_reps": 5}],
        },
        {
            "id": "block-2",
            "exercise_id": "db_row",
            "order": 2,
            "planned_sets": [{"id": "set-2", "set_number": 1, "target_reps": 8}],
        },
    ]

    session = StrengthSessionCreate.model_validate(
        {
            "date": date(2026, 9, 21),
            "title": "Session",
            "exercise_blocks": blocks,
        }
    )
    template = StrengthTemplateCreate.model_validate(
        {"name": "Template", "exercise_blocks": blocks}
    )

    assert len(session.exercise_blocks) == len(template.exercise_blocks) == 2


@pytest.mark.parametrize(
    "planned_set",
    [
        {
            "set_number": 1,
            "target_reps": 5,
            "percentage": 65,
            "max_source": "bench_press",
        },
        {
            "set_number": 1,
            "target_distance": 20,
            "distance_unit": DistanceUnit.YARDS,
            "target_weight": 80,
        },
        {"set_number": 1, "target_duration_seconds": 30, "target_weight": 45},
    ],
)
def test_rep_distance_and_duration_prescriptions_are_valid(
    planned_set: dict[str, object],
) -> None:
    assert PlannedSetInput.model_validate(planned_set)


def test_empty_prescription_and_distance_without_unit_are_rejected() -> None:
    with pytest.raises(ValidationError, match="reps, distance, or duration"):
        PlannedSetInput(set_number=1, target_weight=100)
    with pytest.raises(ValidationError, match="provided together"):
        PlannedSetInput(set_number=1, target_distance=20)


@pytest.mark.parametrize("model", [PlannedSetInput, TemplatePlannedSetInput])
def test_target_reps_must_be_positive_when_provided(
    model: type[PlannedSetInput] | type[TemplatePlannedSetInput],
) -> None:
    with pytest.raises(ValidationError, match="greater than 0"):
        model.model_validate({"set_number": 1, "target_reps": 0})

    assert ActualSet(planned_set_id="set-1", actual_reps=0)


@pytest.mark.parametrize(
    "payload",
    [
        {"set_number": 1, "target_reps": 5, "percentage": 65},
        {"set_number": 1, "target_reps": 5, "max_source": "bench_press"},
    ],
)
def test_session_percentage_and_max_source_must_be_paired(
    payload: dict[str, object],
) -> None:
    with pytest.raises(ValidationError, match="provided together"):
        PlannedSetInput.model_validate(payload)


def test_session_percentage_snapshot_and_fixed_weight_are_valid() -> None:
    resolved = PlannedSetInput(
        set_number=1,
        target_reps=5,
        percentage=65,
        max_source="bench_press",
        max_value_at_creation=285,
        target_weight=185,
    )
    fixed = PlannedSetInput(set_number=1, target_reps=8, target_weight=70)

    assert resolved.max_value_at_creation == 285
    assert resolved.target_weight == 185
    assert fixed.percentage is None
    assert fixed.target_weight == 70


def test_actual_distance_requires_distance_target_on_referenced_planned_set() -> None:
    with pytest.raises(ValidationError, match="planned distance and unit"):
        ExerciseBlockInput(
            id="block-1",
            exercise_id="bench_press",
            order=1,
            planned_sets=[PlannedSetInput(id="set-1", set_number=1, target_reps=5)],
            actual_sets=[
                ActualSet(
                    planned_set_id="set-1",
                    actual_distance=20,
                    completed=True,
                )
            ],
        )


def test_rep_distance_and_duration_actuals_remain_valid() -> None:
    rep_block = ExerciseBlockInput(
        id="rep-block",
        exercise_id="bench_press",
        order=1,
        planned_sets=[PlannedSetInput(id="rep-set", set_number=1, target_reps=5)],
        actual_sets=[ActualSet(planned_set_id="rep-set", actual_reps=0)],
    )
    distance_block = ExerciseBlockInput(
        id="distance-block",
        exercise_id="farmers_walk",
        order=2,
        planned_sets=[
            PlannedSetInput(
                id="distance-set",
                set_number=1,
                target_distance=20,
                distance_unit=DistanceUnit.YARDS,
            )
        ],
        actual_sets=[ActualSet(planned_set_id="distance-set", actual_distance=22)],
    )
    duration_block = ExerciseBlockInput(
        id="duration-block",
        exercise_id="farmers_walk",
        order=3,
        planned_sets=[
            PlannedSetInput(
                id="duration-set",
                set_number=1,
                target_duration_seconds=30,
            )
        ],
        actual_sets=[
            ActualSet(
                planned_set_id="duration-set",
                actual_duration_seconds=35,
            )
        ],
    )

    assert rep_block.actual_sets[0].actual_reps == 0
    assert distance_block.actual_sets[0].actual_distance == 22
    assert duration_block.actual_sets[0].actual_duration_seconds == 35


def test_percentage_template_is_unresolved_and_fixed_weight_template_is_valid() -> None:
    percentage = TemplatePlannedSetInput(
        set_number=1,
        target_reps=5,
        percentage=65,
        max_source="bench_press",
    )
    fixed = TemplatePlannedSetInput(
        set_number=1,
        target_reps=8,
        target_weight=70,
    )

    assert percentage.target_weight is None
    assert fixed.target_weight == 70
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        TemplatePlannedSetInput.model_validate(
            {
                "set_number": 1,
                "target_reps": 5,
                "percentage": 65,
                "max_source": "bench_press",
                "max_value_at_creation": 285,
            }
        )
    with pytest.raises(ValidationError, match="resolved target weight"):
        TemplatePlannedSetInput(
            set_number=1,
            target_reps=5,
            percentage=65,
            max_source="bench_press",
            target_weight=185,
        )


def test_template_materialization_contains_prescription_only() -> None:
    blocks = materialize_template_blocks(
        [
            TemplateExerciseBlockInput(
                exercise_id="bench_press",
                order=1,
                planned_sets=[
                    TemplatePlannedSetInput(
                        set_number=1,
                        target_reps=5,
                        percentage=65,
                        max_source="bench_press",
                    )
                ],
            )
        ]
    )

    planned = blocks[0].planned_sets[0].model_dump()
    assert planned["percentage"] == 65
    assert planned["max_source"] == "bench_press"
    assert planned["target_weight"] is None
    assert "max_value_at_creation" not in planned
    assert not hasattr(blocks[0], "actual_sets")


def test_session_model_does_not_recalculate_frozen_prescription() -> None:
    planned = PlannedSet(
        id="set",
        set_number=1,
        target_reps=5,
        percentage=50,
        max_source="bench_press",
        max_value_at_creation=265,
        target_weight=135,
    )

    assert planned.max_value_at_creation == 265
    assert planned.target_weight == 135
