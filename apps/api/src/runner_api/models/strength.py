from collections.abc import Sequence
from datetime import date as Date
from datetime import datetime
from enum import StrEnum
from typing import Any, Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class DistanceUnit(StrEnum):
    YARDS = "yards"
    METERS = "meters"


class _Ordered(Protocol):
    order: int


class _NumberedSet(Protocol):
    set_number: int


class StrengthMax(BaseModel):
    id: str
    exercise_key: str
    value: float = Field(gt=0, allow_inf_nan=False, description="Max in pounds")
    effective_date: Date
    created_at: datetime


class StrengthMaxUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: float = Field(gt=0, allow_inf_nan=False, description="Max in pounds")
    effective_date: Date


class StrengthMaxCollection(BaseModel):
    current: list[StrengthMax]
    history: list[StrengthMax]


class Exercise(BaseModel):
    id: str
    name: str
    category: str
    default_max_source: str | None = None
    is_custom: bool


class ExerciseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    default_max_source: str | None = Field(default=None, min_length=1, max_length=120)


class PlannedSetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, min_length=1)
    set_number: int = Field(ge=1)
    target_reps: int | None = Field(default=None, gt=0)
    target_distance: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    distance_unit: DistanceUnit | None = None
    target_duration_seconds: int | None = Field(default=None, gt=0)
    percentage: float | None = Field(
        default=None,
        ge=0,
        le=500,
        allow_inf_nan=False,
    )
    max_source: str | None = Field(default=None, min_length=1, max_length=120)
    max_value_at_creation: float | None = Field(
        default=None,
        gt=0,
        allow_inf_nan=False,
        description="Effective max in pounds when the session was prescribed",
    )
    target_weight: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
        description="Prescribed weight in pounds",
    )
    rest_seconds: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_workload(self) -> "PlannedSetInput":
        _validate_workload_targets(
            self.target_reps,
            self.target_distance,
            self.distance_unit,
            self.target_duration_seconds,
        )
        _validate_session_percentage(self.percentage, self.max_source)
        return self


class PlannedSet(BaseModel):
    id: str
    set_number: int = Field(ge=1)
    target_reps: int | None = Field(default=None, gt=0)
    target_distance: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    distance_unit: DistanceUnit | None = None
    target_duration_seconds: int | None = Field(default=None, gt=0)
    percentage: float | None = Field(
        default=None,
        ge=0,
        le=500,
        allow_inf_nan=False,
    )
    max_source: str | None = None
    max_value_at_creation: float | None = Field(
        default=None,
        gt=0,
        allow_inf_nan=False,
        description="Effective max in pounds when the session was prescribed",
    )
    target_weight: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
        description="Prescribed weight in pounds",
    )
    rest_seconds: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_workload(self) -> "PlannedSet":
        _validate_workload_targets(
            self.target_reps,
            self.target_distance,
            self.distance_unit,
            self.target_duration_seconds,
        )
        _validate_session_percentage(self.percentage, self.max_source)
        return self


class ActualSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    planned_set_id: str = Field(min_length=1)
    actual_reps: int | None = Field(default=None, ge=0)
    actual_distance: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
        description="Actual distance in the planned set's distance unit",
    )
    actual_duration_seconds: int | None = Field(default=None, ge=0)
    actual_weight: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
        description="Actual weight in pounds",
    )
    completed: bool = False
    notes: str | None = Field(default=None, max_length=1000)


class ExerciseBlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, min_length=1)
    exercise_id: str = Field(min_length=1)
    order: int = Field(ge=1)
    group_id: str | None = Field(default=None, min_length=1, max_length=120)
    label: str | None = Field(default=None, min_length=1, max_length=40)
    planned_sets: list[PlannedSetInput] = Field(default_factory=list)
    actual_sets: list[ActualSet] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_sets(self) -> "ExerciseBlockInput":
        _validate_set_order(self.planned_sets)
        supplied_ids = {item.id for item in self.planned_sets if item.id is not None}
        actual_ids = [item.planned_set_id for item in self.actual_sets]
        if len(actual_ids) != len(set(actual_ids)):
            raise ValueError("actual sets must reference each planned set at most once")
        if not set(actual_ids).issubset(supplied_ids):
            raise ValueError("actual sets must reference a supplied planned set id")
        _validate_actual_distances(self.planned_sets, self.actual_sets)
        return self


class ExerciseBlock(BaseModel):
    id: str
    exercise_id: str
    order: int = Field(ge=1)
    group_id: str | None = None
    label: str | None = None
    planned_sets: list[PlannedSet]
    actual_sets: list[ActualSet]

    @model_validator(mode="after")
    def validate_sets(self) -> "ExerciseBlock":
        _validate_set_order(self.planned_sets)
        planned_ids = {item.id for item in self.planned_sets}
        actual_ids = [item.planned_set_id for item in self.actual_sets]
        if len(actual_ids) != len(set(actual_ids)):
            raise ValueError("actual sets must reference each planned set at most once")
        if not set(actual_ids).issubset(planned_ids):
            raise ValueError(
                "actual sets must reference a planned set in the same block"
            )
        _validate_actual_distances(self.planned_sets, self.actual_sets)
        return self


class StrengthSession(BaseModel):
    id: str
    date: Date
    title: str
    notes: str | None = None
    exercise_blocks: list[ExerciseBlock]
    program: "StrengthProgramProvenance | None" = None

    @model_validator(mode="after")
    def validate_structure(self) -> "StrengthSession":
        _validate_block_order(self.exercise_blocks)
        _validate_nested_ids(self.exercise_blocks)
        return self


class StrengthSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Date
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    exercise_blocks: list[ExerciseBlockInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_structure(self) -> "StrengthSessionCreate":
        _validate_block_order(self.exercise_blocks)
        _validate_nested_ids(self.exercise_blocks)
        return self


class StrengthSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Date | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    exercise_blocks: list[ExerciseBlockInput] = Field(default_factory=list)

    @field_validator("date", "title")
    @classmethod
    def required_fields_cannot_be_cleared(cls, value: object) -> object:
        if value is None:
            raise ValueError("field cannot be null")
        return value

    @field_validator("exercise_blocks")
    @classmethod
    def validate_block_order(
        cls, value: list[ExerciseBlockInput]
    ) -> list[ExerciseBlockInput]:
        _validate_block_order(value)
        _validate_nested_ids(value)
        return value


class StrengthWeek(BaseModel):
    week_start: Date
    week_end: Date
    sessions: list[StrengthSession]


class TemplatePlannedSetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, min_length=1)
    set_number: int = Field(ge=1)
    target_reps: int | None = Field(default=None, gt=0)
    target_distance: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    distance_unit: DistanceUnit | None = None
    target_duration_seconds: int | None = Field(default=None, gt=0)
    percentage: float | None = Field(
        default=None,
        ge=0,
        le=500,
        allow_inf_nan=False,
    )
    max_source: str | None = Field(default=None, min_length=1, max_length=120)
    target_weight: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
        description="Fixed prescribed weight in pounds",
    )
    rest_seconds: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_prescription(self) -> "TemplatePlannedSetInput":
        _validate_workload_targets(
            self.target_reps,
            self.target_distance,
            self.distance_unit,
            self.target_duration_seconds,
        )
        _validate_template_weight(self.percentage, self.max_source, self.target_weight)
        return self


class TemplatePlannedSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    set_number: int = Field(ge=1)
    target_reps: int | None = Field(default=None, gt=0)
    target_distance: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    distance_unit: DistanceUnit | None = None
    target_duration_seconds: int | None = Field(default=None, gt=0)
    percentage: float | None = Field(
        default=None,
        ge=0,
        le=500,
        allow_inf_nan=False,
    )
    max_source: str | None = None
    target_weight: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
        description="Fixed prescribed weight in pounds",
    )
    rest_seconds: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_prescription(self) -> "TemplatePlannedSet":
        _validate_workload_targets(
            self.target_reps,
            self.target_distance,
            self.distance_unit,
            self.target_duration_seconds,
        )
        _validate_template_weight(self.percentage, self.max_source, self.target_weight)
        return self


class TemplateExerciseBlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, min_length=1)
    exercise_id: str = Field(min_length=1)
    order: int = Field(ge=1)
    group_id: str | None = Field(default=None, min_length=1, max_length=120)
    label: str | None = Field(default=None, min_length=1, max_length=40)
    planned_sets: list[TemplatePlannedSetInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_sets(self) -> "TemplateExerciseBlockInput":
        _validate_set_order(self.planned_sets)
        return self


class TemplateExerciseBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    exercise_id: str
    order: int = Field(ge=1)
    group_id: str | None = None
    label: str | None = None
    planned_sets: list[TemplatePlannedSet]

    @model_validator(mode="after")
    def validate_sets(self) -> "TemplateExerciseBlock":
        _validate_set_order(self.planned_sets)
        return self


class StrengthTemplate(BaseModel):
    id: str
    name: str
    exercise_blocks: list[TemplateExerciseBlock]

    @model_validator(mode="after")
    def validate_structure(self) -> "StrengthTemplate":
        _validate_block_order(self.exercise_blocks)
        _validate_nested_ids(self.exercise_blocks)
        return self


class StrengthProgramDay(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    day_number: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=200)
    exercise_blocks: list[TemplateExerciseBlock]

    @model_validator(mode="after")
    def validate_structure(self) -> "StrengthProgramDay":
        _validate_block_order(self.exercise_blocks)
        _validate_nested_ids(self.exercise_blocks)
        return self


class StrengthProgram(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str = Field(min_length=1, max_length=200)
    days: list[StrengthProgramDay]

    @model_validator(mode="after")
    def validate_days(self) -> "StrengthProgram":
        numbers = [day.day_number for day in self.days]
        if len(numbers) != len(set(numbers)):
            raise ValueError("program day numbers must be unique")
        if numbers != sorted(numbers):
            raise ValueError("program days must be ordered by day number")
        return self


class StrengthProgramDaySchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Date


class StrengthProgramSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_date: Date
    days_per_week: int = Field(ge=2, le=7)
    selected_weekdays: list[int] = Field(min_length=2, max_length=7)
    allow_duplicate: bool = False

    @model_validator(mode="after")
    def validate_weekdays(self) -> "StrengthProgramSchedule":
        if len(self.selected_weekdays) != len(set(self.selected_weekdays)):
            raise ValueError("selected weekdays must be unique")
        if any(day < 0 or day > 6 for day in self.selected_weekdays):
            raise ValueError("selected weekdays must be between 0 and 6")
        if len(self.selected_weekdays) != self.days_per_week:
            raise ValueError("selected weekday count must match days_per_week")
        return self


class StrengthProgramProvenance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    program_id: str
    program_name: str
    instance_id: str
    day_number: int = Field(ge=1)
    total_days: int = Field(ge=1)
    start_date: Date
    days_per_week: int = Field(ge=1, le=7)
    selected_weekdays: list[int]


class StrengthProgramInstanceSummary(BaseModel):
    program_id: str
    program_name: str
    instance_id: str
    total_workouts: int
    scheduled_workouts: int
    completed_workouts: int
    start_date: Date
    days_per_week: int
    selected_weekdays: list[int]


class StrengthProgramScheduleResult(BaseModel):
    instance: StrengthProgramInstanceSummary
    sessions: list[StrengthSession]


class StrengthTemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    exercise_blocks: list[TemplateExerciseBlockInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_structure(self) -> "StrengthTemplateCreate":
        _validate_block_order(self.exercise_blocks)
        _validate_nested_ids(self.exercise_blocks)
        return self


class StrengthTemplateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    exercise_blocks: list[TemplateExerciseBlockInput] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def name_cannot_be_cleared(cls, value: object) -> object:
        if value is None:
            raise ValueError("field cannot be null")
        return value

    @field_validator("exercise_blocks")
    @classmethod
    def validate_block_order(
        cls, value: list[TemplateExerciseBlockInput]
    ) -> list[TemplateExerciseBlockInput]:
        _validate_block_order(value)
        _validate_nested_ids(value)
        return value


def materialize_exercise_blocks(
    blocks: list[ExerciseBlockInput],
) -> list[ExerciseBlock]:
    return [
        ExerciseBlock(
            id=block.id or str(uuid4()),
            exercise_id=block.exercise_id,
            order=block.order,
            group_id=block.group_id,
            label=block.label,
            planned_sets=_materialize_planned_sets(block.planned_sets),
            actual_sets=block.actual_sets,
        )
        for block in blocks
    ]


def materialize_template_blocks(
    blocks: list[TemplateExerciseBlockInput],
) -> list[TemplateExerciseBlock]:
    return [
        TemplateExerciseBlock(
            id=block.id or str(uuid4()),
            exercise_id=block.exercise_id,
            order=block.order,
            group_id=block.group_id,
            label=block.label,
            planned_sets=_materialize_template_planned_sets(block.planned_sets),
        )
        for block in blocks
    ]


def _materialize_planned_sets(sets: list[PlannedSetInput]) -> list[PlannedSet]:
    return [
        PlannedSet(
            id=item.id or str(uuid4()),
            set_number=item.set_number,
            target_reps=item.target_reps,
            target_distance=item.target_distance,
            distance_unit=item.distance_unit,
            target_duration_seconds=item.target_duration_seconds,
            percentage=item.percentage,
            max_source=item.max_source,
            max_value_at_creation=item.max_value_at_creation,
            target_weight=item.target_weight,
            rest_seconds=item.rest_seconds,
        )
        for item in sets
    ]


def _materialize_template_planned_sets(
    sets: list[TemplatePlannedSetInput],
) -> list[TemplatePlannedSet]:
    return [
        TemplatePlannedSet(
            id=item.id or str(uuid4()),
            set_number=item.set_number,
            target_reps=item.target_reps,
            target_distance=item.target_distance,
            distance_unit=item.distance_unit,
            target_duration_seconds=item.target_duration_seconds,
            percentage=item.percentage,
            max_source=item.max_source,
            target_weight=item.target_weight,
            rest_seconds=item.rest_seconds,
        )
        for item in sets
    ]


def _validate_block_order(blocks: Sequence[_Ordered]) -> None:
    orders = [block.order for block in blocks]
    if len(orders) != len(set(orders)):
        raise ValueError("exercise block order values must be unique")
    if orders != sorted(orders):
        raise ValueError("exercise blocks must be ordered by order")


def _validate_set_order(sets: Sequence[_NumberedSet]) -> None:
    numbers = [item.set_number for item in sets]
    if len(numbers) != len(set(numbers)):
        raise ValueError("planned set numbers must be unique")
    if numbers != sorted(numbers):
        raise ValueError("planned sets must be ordered by set_number")


def _validate_nested_ids(blocks: Sequence[Any]) -> None:
    block_ids = [block.id for block in blocks if getattr(block, "id", None) is not None]
    if len(block_ids) != len(set(block_ids)):
        raise ValueError("exercise block ids must be unique")

    set_ids = [
        planned_set.id
        for block in blocks
        for planned_set in block.planned_sets
        if planned_set.id is not None
    ]
    if len(set_ids) != len(set(set_ids)):
        raise ValueError("planned set ids must be unique across exercise blocks")


def _validate_workload_targets(
    target_reps: int | None,
    target_distance: float | None,
    distance_unit: DistanceUnit | None,
    target_duration_seconds: int | None,
) -> None:
    if all(
        value is None
        for value in (target_reps, target_distance, target_duration_seconds)
    ):
        raise ValueError("planned set must include reps, distance, or duration")
    if (target_distance is None) != (distance_unit is None):
        raise ValueError("target distance and distance unit must be provided together")


def _validate_template_weight(
    percentage: float | None,
    max_source: str | None,
    target_weight: float | None,
) -> None:
    if percentage is not None and max_source is None:
        raise ValueError("percentage template sets require a max source")
    if percentage is not None and target_weight is not None:
        raise ValueError(
            "percentage template sets cannot store a resolved target weight"
        )
    if percentage is None and max_source is not None:
        raise ValueError("max source requires a percentage")


def _validate_session_percentage(
    percentage: float | None,
    max_source: str | None,
) -> None:
    if (percentage is None) != (max_source is None):
        raise ValueError("percentage and max source must be provided together")


def _validate_actual_distances(
    planned_sets: Sequence[PlannedSetInput] | Sequence[PlannedSet],
    actual_sets: Sequence[ActualSet],
) -> None:
    planned_by_id = {
        planned_set.id: planned_set
        for planned_set in planned_sets
        if planned_set.id is not None
    }
    for actual_set in actual_sets:
        if actual_set.actual_distance is None:
            continue
        planned_set = planned_by_id.get(actual_set.planned_set_id)
        if (
            planned_set is None
            or planned_set.target_distance is None
            or planned_set.distance_unit is None
        ):
            raise ValueError(
                "actual distance requires a referenced planned distance and unit"
            )
