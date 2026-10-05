import json
from pathlib import Path

from pydantic import TypeAdapter

from runner_api.data.strength import BUILT_IN_EXERCISE_IDS
from runner_api.models.strength import StrengthProgram

_PROGRAMS_FILE = Path(__file__).with_name("strength_programs.json")
_PROGRAMS_ADAPTER = TypeAdapter(list[StrengthProgram])


def load_strength_programs(path: Path = _PROGRAMS_FILE) -> tuple[StrengthProgram, ...]:
    """Load and validate reviewable prescription-only program seed data."""
    if not path.exists():
        return ()
    with path.open(encoding="utf-8") as source:
        programs = tuple(_PROGRAMS_ADAPTER.validate_python(json.load(source)))
    unknown_exercise_ids = sorted(
        {
            block.exercise_id
            for program in programs
            for day in program.days
            for block in day.exercise_blocks
            if block.exercise_id not in BUILT_IN_EXERCISE_IDS
        }
    )
    if unknown_exercise_ids:
        raise ValueError(
            "program seed references unknown built-in exercises: "
            + ", ".join(unknown_exercise_ids)
        )
    return programs


BUILT_IN_STRENGTH_PROGRAMS = load_strength_programs()
