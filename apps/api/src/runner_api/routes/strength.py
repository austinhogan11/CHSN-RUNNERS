from datetime import UTC, date, datetime, timedelta
from math import floor
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from runner_api.auth import CurrentUser, get_current_user
from runner_api.data.strength import BUILT_IN_EXERCISE_IDS, BUILT_IN_EXERCISES
from runner_api.data.strength_programs import BUILT_IN_STRENGTH_PROGRAMS
from runner_api.dates import get_week_start
from runner_api.dependencies import get_strength_repositories
from runner_api.models.strength import (
    Exercise,
    ExerciseBlock,
    ExerciseCreate,
    PlannedSet,
    StrengthMax,
    StrengthMaxCollection,
    StrengthMaxUpsert,
    StrengthProgram,
    StrengthProgramDay,
    StrengthProgramDaySchedule,
    StrengthProgramInstanceSummary,
    StrengthProgramProvenance,
    StrengthProgramSchedule,
    StrengthProgramScheduleResult,
    StrengthSession,
    StrengthSessionCreate,
    StrengthSessionUpdate,
    StrengthTemplate,
    StrengthTemplateCreate,
    StrengthTemplateUpdate,
    StrengthWeek,
    TemplateExerciseBlock,
    materialize_exercise_blocks,
    materialize_template_blocks,
)
from runner_api.repositories.strength import (
    StrengthRepositories,
    StrengthResourceAlreadyExistsError,
    StrengthResourceNotFoundError,
)

router = APIRouter(prefix="/strength", tags=["strength"])


@router.get("/maxes", response_model=StrengthMaxCollection)
def get_maxes(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthMaxCollection:
    history = repositories.maxes.list_for_user(current_user.id)
    current_by_exercise: dict[str, StrengthMax] = {}
    today = datetime.now(UTC).date()
    for item in history:
        if item.effective_date > today:
            continue
        current = current_by_exercise.get(item.exercise_key)
        if current is None or item.effective_date > current.effective_date:
            current_by_exercise[item.exercise_key] = item
    return StrengthMaxCollection(
        current=sorted(
            current_by_exercise.values(), key=lambda item: item.exercise_key
        ),
        history=history,
    )


@router.put("/maxes/{exercise_key}", response_model=StrengthMax)
def put_max(
    exercise_key: str,
    payload: StrengthMaxUpsert,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthMax:
    item = StrengthMax(
        id=str(uuid4()),
        exercise_key=exercise_key,
        value=payload.value,
        effective_date=payload.effective_date,
        created_at=datetime.now(UTC),
    )
    return repositories.maxes.upsert(item, current_user.id)


@router.get("/exercises", response_model=list[Exercise])
def get_exercises(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> list[Exercise]:
    custom = repositories.exercises.list_for_user(current_user.id)
    return sorted(
        [*BUILT_IN_EXERCISES, *custom],
        key=lambda item: (item.name.casefold(), item.id),
    )


@router.post(
    "/exercises",
    response_model=Exercise,
    status_code=status.HTTP_201_CREATED,
)
def create_exercise(
    payload: ExerciseCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> Exercise:
    exercise = Exercise(
        id=str(uuid4()),
        name=payload.name,
        category=payload.category,
        default_max_source=payload.default_max_source,
        is_custom=True,
    )
    try:
        return repositories.exercises.create(exercise, current_user.id)
    except StrengthResourceAlreadyExistsError as error:
        raise _conflict("Exercise") from error


@router.get("/programs", response_model=list[StrengthProgram])
def get_programs(
    _: Annotated[CurrentUser, Depends(get_current_user)],
) -> tuple[StrengthProgram, ...]:
    return BUILT_IN_STRENGTH_PROGRAMS


@router.get("/program-instances", response_model=list[StrengthProgramInstanceSummary])
def get_program_instances(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> list[StrengthProgramInstanceSummary]:
    return _program_instance_summaries(
        repositories.sessions.list_for_user(current_user.id)
    )


@router.post(
    "/programs/{program_id}/schedule",
    response_model=StrengthProgramScheduleResult,
    status_code=status.HTTP_201_CREATED,
)
def schedule_program(
    program_id: str,
    payload: StrengthProgramSchedule,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthProgramScheduleResult:
    program = next(
        (item for item in BUILT_IN_STRENGTH_PROGRAMS if item.id == program_id),
        None,
    )
    if program is None:
        raise _not_found("Strength program")

    existing = _program_instance_summaries(
        repositories.sessions.list_for_user(current_user.id)
    )
    if not payload.allow_duplicate and any(
        item.program_id == program_id for item in existing
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This training plan is already scheduled. Confirm that you want "
                "to schedule another run."
            ),
        )

    max_history = repositories.maxes.list_for_user(current_user.id)
    dates = _program_schedule_dates(
        payload.start_date,
        payload.selected_weekdays,
        len(program.days),
    )
    instance_id = str(uuid4())
    sessions = [
        StrengthSession(
            id=str(uuid4()),
            date=scheduled_date,
            title=f"PPSA Day {program_day.day_number}",
            notes=None,
            exercise_blocks=_instantiate_program_day(
                program_day, scheduled_date, max_history
            ),
            program=StrengthProgramProvenance(
                program_id=program.id,
                program_name=program.name,
                instance_id=instance_id,
                day_number=program_day.day_number,
                total_days=len(program.days),
                start_date=payload.start_date,
                days_per_week=payload.days_per_week,
                selected_weekdays=sorted(payload.selected_weekdays),
            ),
        )
        for program_day, scheduled_date in zip(program.days, dates, strict=True)
    ]
    for session in sessions:
        _validate_exercise_access(
            session.exercise_blocks, current_user.id, repositories
        )
    now = datetime.now(UTC)
    try:
        repositories.sessions.create_many(
            sessions,
            current_user.id,
            created_at=now,
            updated_at=now,
        )
    except StrengthResourceAlreadyExistsError as error:
        raise _conflict("Strength session") from error
    return StrengthProgramScheduleResult(
        instance=_program_instance_summaries(sessions)[0],
        sessions=sessions,
    )


@router.post(
    "/programs/{program_id}/days/{day_number}/schedule",
    response_model=StrengthSession,
    status_code=status.HTTP_201_CREATED,
)
def schedule_program_day(
    program_id: str,
    day_number: int,
    payload: StrengthProgramDaySchedule,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthSession:
    program = next(
        (item for item in BUILT_IN_STRENGTH_PROGRAMS if item.id == program_id),
        None,
    )
    if program is None:
        raise _not_found("Strength program")
    program_day = next(
        (item for item in program.days if item.day_number == day_number),
        None,
    )
    if program_day is None:
        raise _not_found("Strength program day")

    blocks = _instantiate_program_day(
        program_day,
        payload.date,
        repositories.maxes.list_for_user(current_user.id),
    )
    _validate_exercise_access(blocks, current_user.id, repositories)
    session = StrengthSession(
        id=str(uuid4()),
        date=payload.date,
        title=f"{program.name} · {program_day.name}",
        notes=None,
        exercise_blocks=blocks,
    )
    now = datetime.now(UTC)
    return repositories.sessions.create(
        session,
        current_user.id,
        created_at=now,
        updated_at=now,
    )


@router.get("/weeks/{day}", response_model=StrengthWeek)
def get_strength_week(
    day: date,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthWeek:
    week_start = get_week_start(day)
    week_end = week_start + timedelta(days=6)
    return StrengthWeek(
        week_start=week_start,
        week_end=week_end,
        sessions=repositories.sessions.list_between(
            current_user.id, week_start, week_end
        ),
    )


@router.get("/sessions/{session_id}", response_model=StrengthSession)
def get_session(
    session_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthSession:
    record = repositories.sessions.get(session_id)
    if record is None or record.user_id != current_user.id:
        raise _not_found("Strength session")
    return record.session


@router.post(
    "/sessions",
    response_model=StrengthSession,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: StrengthSessionCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthSession:
    blocks = materialize_exercise_blocks(payload.exercise_blocks)
    _validate_exercise_access(blocks, current_user.id, repositories)
    session = StrengthSession(
        id=str(uuid4()),
        date=payload.date,
        title=payload.title,
        notes=payload.notes,
        exercise_blocks=blocks,
    )
    now = datetime.now(UTC)
    try:
        return repositories.sessions.create(
            session, current_user.id, created_at=now, updated_at=now
        )
    except StrengthResourceAlreadyExistsError as error:
        raise _conflict("Strength session") from error


@router.patch("/sessions/{session_id}", response_model=StrengthSession)
def update_session(
    session_id: str,
    payload: StrengthSessionUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthSession:
    record = repositories.sessions.get(session_id)
    if record is None or record.user_id != current_user.id:
        raise _not_found("Strength session")

    changes = payload.model_dump(mode="json", exclude_unset=True)
    if "exercise_blocks" in changes:
        blocks = materialize_exercise_blocks(payload.exercise_blocks)
        _validate_exercise_access(blocks, current_user.id, repositories)
        changes["exercise_blocks"] = blocks
    values = record.session.model_dump()
    values.update(changes)
    session = StrengthSession.model_validate(values)
    try:
        return repositories.sessions.update(
            session, current_user.id, updated_at=datetime.now(UTC)
        )
    except StrengthResourceNotFoundError as error:
        raise _not_found("Strength session") from error


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_session(
    session_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> Response:
    record = repositories.sessions.get(session_id)
    if record is None or record.user_id != current_user.id:
        raise _not_found("Strength session")
    try:
        repositories.sessions.delete(session_id, current_user.id)
    except StrengthResourceNotFoundError as error:
        raise _not_found("Strength session") from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/templates", response_model=list[StrengthTemplate])
def get_templates(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> list[StrengthTemplate]:
    return repositories.templates.list_for_user(current_user.id)


@router.post(
    "/templates",
    response_model=StrengthTemplate,
    status_code=status.HTTP_201_CREATED,
)
def create_template(
    payload: StrengthTemplateCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthTemplate:
    blocks = materialize_template_blocks(payload.exercise_blocks)
    _validate_exercise_access(blocks, current_user.id, repositories)
    template = StrengthTemplate(
        id=str(uuid4()),
        name=payload.name,
        exercise_blocks=blocks,
    )
    now = datetime.now(UTC)
    try:
        return repositories.templates.create(
            template, current_user.id, created_at=now, updated_at=now
        )
    except StrengthResourceAlreadyExistsError as error:
        raise _conflict("Strength template") from error


@router.patch("/templates/{template_id}", response_model=StrengthTemplate)
def update_template(
    template_id: str,
    payload: StrengthTemplateUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> StrengthTemplate:
    record = repositories.templates.get(template_id)
    if record is None or record.user_id != current_user.id:
        raise _not_found("Strength template")

    changes = payload.model_dump(mode="json", exclude_unset=True)
    if "exercise_blocks" in changes:
        blocks = materialize_template_blocks(payload.exercise_blocks)
        _validate_exercise_access(blocks, current_user.id, repositories)
        changes["exercise_blocks"] = blocks
    values = record.template.model_dump()
    values.update(changes)
    template = StrengthTemplate.model_validate(values)
    try:
        return repositories.templates.update(
            template, current_user.id, updated_at=datetime.now(UTC)
        )
    except StrengthResourceNotFoundError as error:
        raise _not_found("Strength template") from error


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_template(
    template_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repositories: Annotated[StrengthRepositories, Depends(get_strength_repositories)],
) -> Response:
    record = repositories.templates.get(template_id)
    if record is None or record.user_id != current_user.id:
        raise _not_found("Strength template")
    try:
        repositories.templates.delete(template_id, current_user.id)
    except StrengthResourceNotFoundError as error:
        raise _not_found("Strength template") from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _validate_exercise_access(
    blocks: list[ExerciseBlock] | list[TemplateExerciseBlock],
    user_id: str,
    repositories: StrengthRepositories,
) -> None:
    for exercise_id in {block.exercise_id for block in blocks}:
        if exercise_id in BUILT_IN_EXERCISE_IDS:
            continue
        if repositories.exercises.get(user_id, exercise_id) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Unknown exercise: {exercise_id}",
            )


def _instantiate_program_day(
    program_day: StrengthProgramDay,
    scheduled_date: date,
    max_history: list[StrengthMax],
) -> list[ExerciseBlock]:
    blocks: list[ExerciseBlock] = []
    for source_block in program_day.exercise_blocks:
        planned_sets: list[PlannedSet] = []
        for source_set in source_block.planned_sets:
            effective_max = _effective_max(
                max_history,
                source_set.max_source,
                scheduled_date,
            )
            target_weight = source_set.target_weight
            if source_set.percentage is not None:
                target_weight = (
                    _round_to_five(source_set.percentage * effective_max.value / 100)
                    if effective_max is not None
                    else None
                )
            planned_sets.append(
                PlannedSet(
                    id=str(uuid4()),
                    set_number=source_set.set_number,
                    target_reps=source_set.target_reps,
                    target_distance=source_set.target_distance,
                    distance_unit=source_set.distance_unit,
                    target_duration_seconds=source_set.target_duration_seconds,
                    percentage=source_set.percentage,
                    max_source=source_set.max_source,
                    max_value_at_creation=(
                        effective_max.value if effective_max else None
                    ),
                    target_weight=target_weight,
                    rest_seconds=source_set.rest_seconds,
                )
            )
        blocks.append(
            ExerciseBlock(
                id=str(uuid4()),
                exercise_id=source_block.exercise_id,
                order=source_block.order,
                group_id=source_block.group_id,
                label=source_block.label,
                planned_sets=planned_sets,
                actual_sets=[],
            )
        )
    return blocks


def _effective_max(
    history: list[StrengthMax],
    source: str | None,
    scheduled_date: date,
) -> StrengthMax | None:
    if source is None:
        return None
    applicable = [
        item
        for item in history
        if item.exercise_key == source and item.effective_date <= scheduled_date
    ]
    return max(
        applicable,
        key=lambda item: (item.effective_date, item.created_at),
        default=None,
    )


def _round_to_five(value: float) -> float:
    return float(floor(value / 5 + 0.5) * 5)


def _program_schedule_dates(
    start_date: date,
    selected_weekdays: list[int],
    day_count: int,
) -> list[date]:
    if day_count == 0:
        return []
    selected = set(selected_weekdays)
    dates = [start_date]
    candidate = start_date
    while len(dates) < day_count:
        candidate += timedelta(days=1)
        if candidate.weekday() in selected:
            dates.append(candidate)
    return dates


def _program_instance_summaries(
    sessions: list[StrengthSession],
) -> list[StrengthProgramInstanceSummary]:
    grouped: dict[str, list[StrengthSession]] = {}
    for session in sessions:
        if session.program is not None:
            grouped.setdefault(session.program.instance_id, []).append(session)
    summaries = []
    for items in grouped.values():
        first = items[0].program
        if first is None:
            continue
        summaries.append(
            StrengthProgramInstanceSummary(
                program_id=first.program_id,
                program_name=first.program_name,
                instance_id=first.instance_id,
                total_workouts=first.total_days,
                scheduled_workouts=len(items),
                completed_workouts=sum(_session_is_completed(item) for item in items),
                start_date=first.start_date,
                days_per_week=first.days_per_week,
                selected_weekdays=first.selected_weekdays,
            )
        )
    return sorted(summaries, key=lambda item: (item.start_date, item.instance_id))


def _session_is_completed(session: StrengthSession) -> bool:
    planned_ids = {
        planned.id
        for block in session.exercise_blocks
        for planned in block.planned_sets
    }
    completed_ids = {
        actual.planned_set_id
        for block in session.exercise_blocks
        for actual in block.actual_sets
        if actual.completed
    }
    return bool(planned_ids) and planned_ids.issubset(completed_ids)


def _not_found(resource: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{resource} not found",
    )


def _conflict(resource: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"{resource} identifier already exists",
    )
