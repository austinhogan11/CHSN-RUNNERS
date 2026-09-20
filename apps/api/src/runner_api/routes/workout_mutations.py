from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from runner_api.auth import CurrentUser, get_current_user
from runner_api.dependencies import get_workout_repository
from runner_api.models.workout import Workout, WorkoutCreate, WorkoutUpdate
from runner_api.repositories.workouts import (
    WorkoutAlreadyExistsError,
    WorkoutNotFoundError,
    WorkoutRepository,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("", response_model=Workout, status_code=status.HTTP_201_CREATED)
def create_workout(
    payload: WorkoutCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[WorkoutRepository, Depends(get_workout_repository)],
) -> Workout:
    workout = Workout(
        id=str(uuid4()),
        **payload.model_dump(),
    )
    now = datetime.now(UTC)

    try:
        return repository.create(
            workout=workout,
            user_id=current_user.id,
            created_at=now,
            updated_at=now,
        )
    except WorkoutAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workout identifier already exists",
        ) from error


@router.patch("/{workout_id}", response_model=Workout)
def update_workout(
    workout_id: str,
    payload: WorkoutUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[WorkoutRepository, Depends(get_workout_repository)],
) -> Workout:
    record = repository.get(workout_id)
    if record is None or record.user_id != current_user.id:
        raise _workout_not_found()

    try:
        return repository.update(
            workout_id=workout_id,
            user_id=current_user.id,
            changes=payload.model_dump(mode="json", exclude_unset=True),
            updated_at=datetime.now(UTC),
        )
    except WorkoutNotFoundError as error:
        raise _workout_not_found() from error


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[WorkoutRepository, Depends(get_workout_repository)],
) -> Response:
    record = repository.get(workout_id)
    if record is None or record.user_id != current_user.id:
        raise _workout_not_found()

    try:
        repository.delete(workout_id, current_user.id)
    except WorkoutNotFoundError as error:
        raise _workout_not_found() from error

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _workout_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Workout not found",
    )
