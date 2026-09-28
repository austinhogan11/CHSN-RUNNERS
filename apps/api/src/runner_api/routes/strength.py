from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from runner_api.auth import CurrentUser, get_current_user
from runner_api.data.strength import BUILT_IN_EXERCISE_IDS, BUILT_IN_EXERCISES
from runner_api.dates import get_week_start
from runner_api.dependencies import get_strength_repositories
from runner_api.models.strength import (
    Exercise,
    ExerciseBlock,
    ExerciseCreate,
    StrengthMax,
    StrengthMaxCollection,
    StrengthMaxUpsert,
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
