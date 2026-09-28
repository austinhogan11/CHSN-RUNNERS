from collections.abc import Sequence
from datetime import date as Date
from datetime import datetime
from enum import StrEnum
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrengthUnit(StrEnum):
    LB = "lb"
    KG = "kg"


class _Ordered(Protocol):
    order: int


class _NumberedSet(Protocol):
    set_number: int


class StrengthMax(BaseModel):
    id: str
    exercise_key: str
    value: float = Field(gt=0, allow_inf_nan=False)
    unit: StrengthUnit
    effective_date: Date
    created_at: datetime


class StrengthMaxUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: float = Field(gt=0, allow_inf_nan=False)
    unit: StrengthUnit
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
    target_reps: int = Field(ge=0)
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
    )
    target_weight: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    rest_seconds: int | None = Field(default=None, ge=0)


class PlannedSet(BaseModel):
    id: str
    set_number: int = Field(ge=1)
    target_reps: int = Field(ge=0)
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
    )
    target_weight: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    rest_seconds: int | None = Field(default=None, ge=0)


class ActualSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    planned_set_id: str = Field(min_length=1)
    actual_reps: int | None = Field(default=None, ge=0)
    actual_weight: float | None = Field(default=None, ge=0, allow_inf_nan=False)
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
        return self


class StrengthSession(BaseModel):
    id: str
    date: Date
    title: str
    notes: str | None = None
    exercise_blocks: list[ExerciseBlock]

    @model_validator(mode="after")
    def validate_block_order(self) -> "StrengthSession":
        _validate_block_order(self.exercise_blocks)
        return self


class StrengthSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Date
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    exercise_blocks: list[ExerciseBlockInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_block_order(self) -> "StrengthSessionCreate":
        _validate_block_order(self.exercise_blocks)
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
        return value


class StrengthWeek(BaseModel):
    week_start: Date
    week_end: Date
    sessions: list[StrengthSession]


class TemplateExerciseBlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, min_length=1)
    exercise_id: str = Field(min_length=1)
    order: int = Field(ge=1)
    group_id: str | None = Field(default=None, min_length=1, max_length=120)
    label: str | None = Field(default=None, min_length=1, max_length=40)
    planned_sets: list[PlannedSetInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_sets(self) -> "TemplateExerciseBlockInput":
        _validate_set_order(self.planned_sets)
        return self


class TemplateExerciseBlock(BaseModel):
    id: str
    exercise_id: str
    order: int = Field(ge=1)
    group_id: str | None = None
    label: str | None = None
    planned_sets: list[PlannedSet]

    @model_validator(mode="after")
    def validate_sets(self) -> "TemplateExerciseBlock":
        _validate_set_order(self.planned_sets)
        return self


class StrengthTemplate(BaseModel):
    id: str
    name: str
    exercise_blocks: list[TemplateExerciseBlock]

    @model_validator(mode="after")
    def validate_block_order(self) -> "StrengthTemplate":
        _validate_block_order(self.exercise_blocks)
        return self


class StrengthTemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    exercise_blocks: list[TemplateExerciseBlockInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_block_order(self) -> "StrengthTemplateCreate":
        _validate_block_order(self.exercise_blocks)
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
            planned_sets=_materialize_planned_sets(block.planned_sets),
        )
        for block in blocks
    ]


def _materialize_planned_sets(sets: list[PlannedSetInput]) -> list[PlannedSet]:
    return [
        PlannedSet(
            id=item.id or str(uuid4()),
            set_number=item.set_number,
            target_reps=item.target_reps,
            percentage=item.percentage,
            max_source=item.max_source,
            max_value_at_creation=item.max_value_at_creation,
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
