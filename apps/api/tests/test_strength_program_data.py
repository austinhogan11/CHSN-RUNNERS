import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from runner_api.data.strength import BUILT_IN_EXERCISE_IDS, BUILT_IN_EXERCISES
from runner_api.data.strength_programs import (
    BUILT_IN_STRENGTH_PROGRAMS,
    load_strength_programs,
)
from runner_api.models.strength import (
    DistanceUnit,
    StrengthProgramDay,
    TemplateExerciseBlock,
)


def test_ppsa_program_loads_all_36_ordered_days() -> None:
    assert len(BUILT_IN_STRENGTH_PROGRAMS) == 1
    program = BUILT_IN_STRENGTH_PROGRAMS[0]

    assert program.id == "ppsa-sport-strength"
    assert program.name == "PPSA Sport Strength"
    assert [day.day_number for day in program.days] == list(range(1, 37))
    assert len({day.id for day in program.days}) == 36
    assert all(
        block.exercise_id in BUILT_IN_EXERCISE_IDS
        for day in program.days
        for block in day.exercise_blocks
    )


def test_ppsa_representative_early_middle_and_late_days_match_source() -> None:
    program = BUILT_IN_STRENGTH_PROGRAMS[0]

    day_1_clean = _block(program.days[0], "hang_power_clean")
    assert _percentages(day_1_clean) == [50, 55, 55]
    assert [item.target_reps for item in day_1_clean.planned_sets] == [5, 5, 5]
    assert {item.rest_seconds for item in day_1_clean.planned_sets} == {90}

    day_18_bench = _block(program.days[17], "bench_press")
    assert _percentages(day_18_bench) == [72, 80, 85, 88]
    assert [item.target_reps for item in day_18_bench.planned_sets] == [3] * 4

    day_36_snatch = _block(program.days[35], "power_snatch")
    assert _percentages(day_36_snatch) == [60, 65, 70]
    day_36_farmers = _block(program.days[35], "db_farmers_walk")
    assert [item.target_distance for item in day_36_farmers.planned_sets] == [50] * 4
    assert {item.distance_unit for item in day_36_farmers.planned_sets} == {
        DistanceUnit.YARDS
    }


def test_ppsa_percentage_sources_match_documented_max_rules() -> None:
    expected_sources = {
        "back_squat": "back_squat",
        "bench_press": "bench_press",
        "clean_pull": "power_clean",
        "clean_pull_power_clean": "power_clean",
        "front_squat": "front_squat",
        "hang_power_clean": "power_clean",
        "hang_power_snatch": "power_snatch",
        "knee_level_hang_clean": "power_clean",
        "knee_level_hang_snatch": "power_snatch",
        "power_clean": "power_clean",
        "power_snatch": "power_snatch",
        "snatch_grip_deadlift": "deadlift",
        "three_position_power_clean": "power_clean",
        "three_position_power_snatch": "power_snatch",
    }
    observed: dict[str, set[str]] = {}
    for day in BUILT_IN_STRENGTH_PROGRAMS[0].days:
        for block in day.exercise_blocks:
            for planned_set in block.planned_sets:
                if planned_set.percentage is not None:
                    observed.setdefault(block.exercise_id, set()).add(
                        planned_set.max_source or ""
                    )

    assert observed == {
        exercise_id: {max_source}
        for exercise_id, max_source in expected_sources.items()
    }


def test_ppsa_supersets_and_circuits_are_preserved() -> None:
    day_1 = BUILT_IN_STRENGTH_PROGRAMS[0].days[0]
    press = next(
        block
        for block in day_1.exercise_blocks
        if block.exercise_id == "bb_strict_standing_overhead_press"
        and block.label == "A1"
    )
    chin_up = _block(day_1, "slow_strict_chin_up")

    assert press.group_id == chin_up.group_id == "ppsa-day-01-superset-1"
    assert (press.label, chin_up.label) == ("A1", "A2")
    warm_up = [block for block in day_1.exercise_blocks if block.label == "Warm-up A"]
    assert len(warm_up) == 7
    assert {block.group_id for block in warm_up} == {"ppsa-day-01-warmup-a"}


def test_ppsa_added_exercises_resolve_in_catalog() -> None:
    catalog = {exercise.id: exercise for exercise in BUILT_IN_EXERCISES}

    assert catalog["three_position_power_clean"].name == "3-Position Power Clean"
    assert catalog["clean_pull_power_clean"].default_max_source == "power_clean"
    assert catalog["snatch_grip_deadlift"].default_max_source == "deadlift"
    assert catalog["conditioning_hard_way"].category == "conditioning"
    assert catalog["gasser"].category == "conditioning"


def _block(day: StrengthProgramDay, exercise_id: str) -> TemplateExerciseBlock:
    return next(
        block for block in day.exercise_blocks if block.exercise_id == exercise_id
    )


def _percentages(block: TemplateExerciseBlock) -> list[float]:
    return [
        item.percentage for item in block.planned_sets if item.percentage is not None
    ]


def test_program_seed_loads_ordered_prescription_only_days(tmp_path: Path) -> None:
    seed_path = tmp_path / "programs.json"
    seed_path.write_text(
        json.dumps(
            [
                {
                    "id": "reviewed-program",
                    "name": "Reviewed Program",
                    "days": [
                        {
                            "id": "reviewed-day-1",
                            "day_number": 1,
                            "name": "Day 1",
                            "exercise_blocks": [
                                {
                                    "id": "reviewed-block-1",
                                    "exercise_id": "bench_press",
                                    "order": 1,
                                    "group_id": "a",
                                    "label": "A1",
                                    "planned_sets": [
                                        {
                                            "id": "reviewed-set-1",
                                            "set_number": 1,
                                            "target_reps": 5,
                                            "percentage": 65,
                                            "max_source": "bench_press",
                                        }
                                    ],
                                }
                            ],
                        },
                        {
                            "id": "reviewed-day-2",
                            "day_number": 2,
                            "name": "Day 2",
                            "exercise_blocks": [],
                        },
                    ],
                }
            ]
        ),
        encoding="utf-8",
    )

    programs = load_strength_programs(seed_path)

    assert [day.day_number for day in programs[0].days] == [1, 2]
    block = programs[0].days[0].exercise_blocks[0]
    assert block.group_id == "a"
    assert block.planned_sets[0].percentage == 65
    assert not hasattr(block, "actual_sets")


def test_program_seed_rejects_execution_data(tmp_path: Path) -> None:
    seed_path = tmp_path / "programs.json"
    seed_path.write_text(
        json.dumps(
            [
                {
                    "id": "invalid-program",
                    "name": "Invalid Program",
                    "days": [
                        {
                            "id": "invalid-day-1",
                            "day_number": 1,
                            "name": "Day 1",
                            "exercise_blocks": [
                                {
                                    "id": "invalid-block-1",
                                    "exercise_id": "bench_press",
                                    "order": 1,
                                    "planned_sets": [],
                                    "actual_sets": [],
                                }
                            ],
                        }
                    ],
                }
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValidationError, match="actual_sets"):
        load_strength_programs(seed_path)


def test_program_seed_rejects_out_of_order_days(tmp_path: Path) -> None:
    seed_path = tmp_path / "programs.json"
    seed_path.write_text(
        json.dumps(
            [
                {
                    "id": "invalid-program",
                    "name": "Invalid Program",
                    "days": [
                        {
                            "id": "invalid-day-2",
                            "day_number": 2,
                            "name": "Day 2",
                            "exercise_blocks": [],
                        },
                        {
                            "id": "invalid-day-1",
                            "day_number": 1,
                            "name": "Day 1",
                            "exercise_blocks": [],
                        },
                    ],
                }
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValidationError, match="ordered by day number"):
        load_strength_programs(seed_path)


def test_program_seed_rejects_unknown_exercise_ids(tmp_path: Path) -> None:
    seed_path = tmp_path / "programs.json"
    seed_path.write_text(
        json.dumps(
            [
                {
                    "id": "invalid-program",
                    "name": "Invalid Program",
                    "days": [
                        {
                            "id": "invalid-day-1",
                            "day_number": 1,
                            "name": "Day 1",
                            "exercise_blocks": [
                                {
                                    "id": "invalid-block",
                                    "exercise_id": "not-in-catalog",
                                    "order": 1,
                                    "planned_sets": [
                                        {
                                            "id": "invalid-set",
                                            "set_number": 1,
                                            "target_reps": 5,
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="not-in-catalog"):
        load_strength_programs(seed_path)
