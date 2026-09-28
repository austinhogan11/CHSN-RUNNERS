from collections.abc import Iterator
from datetime import UTC, date, datetime
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient

from runner_api.auth import CurrentUser, get_current_user
from runner_api.dependencies import get_strength_repositories
from runner_api.main import app
from runner_api.models.strength import Exercise, StrengthSession, StrengthTemplate
from runner_api.repositories.strength import (
    InMemoryExerciseRepository,
    InMemoryStrengthMaxRepository,
    InMemoryStrengthSessionRepository,
    InMemoryStrengthTemplateRepository,
    StrengthRepositories,
)

USER_ID = "user_strength"
OTHER_USER_ID = "user_strength_other"
NOW = datetime(2026, 9, 1, tzinfo=UTC)
client = TestClient(app)


@pytest.fixture
def repositories() -> StrengthRepositories:
    return StrengthRepositories(
        maxes=InMemoryStrengthMaxRepository(),
        exercises=InMemoryExerciseRepository(),
        sessions=InMemoryStrengthSessionRepository(),
        templates=InMemoryStrengthTemplateRepository(),
    )


@pytest.fixture(autouse=True)
def authenticated_dependencies(
    repositories: StrengthRepositories,
) -> Iterator[None]:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_ID)
    app.dependency_overrides[get_strength_repositories] = lambda: repositories
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_strength_repositories, None)


def session_payload() -> dict[str, object]:
    return {
        "date": "2026-09-23",
        "title": "Upper body",
        "notes": "PPSA session",
        "exercise_blocks": [
            {
                "id": "block-a1",
                "exercise_id": "chin_up",
                "order": 1,
                "group_id": "superset-a",
                "label": "A1",
                "planned_sets": [
                    {
                        "id": "chin-set-1",
                        "set_number": 1,
                        "target_reps": 5,
                        "rest_seconds": 60,
                    },
                    {
                        "id": "chin-set-2",
                        "set_number": 2,
                        "target_reps": 5,
                    },
                ],
                "actual_sets": [
                    {
                        "planned_set_id": "chin-set-1",
                        "actual_reps": 5,
                        "actual_weight": 0,
                        "completed": True,
                    }
                ],
            },
            {
                "id": "block-a2",
                "exercise_id": "db_row",
                "order": 2,
                "group_id": "superset-a",
                "label": "A2",
                "planned_sets": [
                    {
                        "id": "row-set-1",
                        "set_number": 1,
                        "target_reps": 8,
                        "target_weight": 60,
                    }
                ],
                "actual_sets": [],
            },
        ],
    }


def template_payload() -> dict[str, object]:
    return {
        "name": "Bench progression",
        "exercise_blocks": [
            {
                "id": "template-bench",
                "exercise_id": "bench_press",
                "order": 1,
                "planned_sets": [
                    {
                        "id": "template-set-1",
                        "set_number": 1,
                        "target_reps": 5,
                        "percentage": 50,
                        "max_source": "bench_press",
                    }
                ],
            },
            {
                "id": "template-row",
                "exercise_id": "db_row",
                "order": 2,
                "planned_sets": [
                    {
                        "id": "template-set-2",
                        "set_number": 1,
                        "target_reps": 8,
                        "target_weight": 70,
                    }
                ],
            },
        ],
    }


def test_max_upsert_preserves_history_and_returns_current_value() -> None:
    first = client.put(
        "/strength/maxes/bench_press",
        json={"value": 265, "effective_date": "2026-09-01"},
    )
    second = client.put(
        "/strength/maxes/bench_press",
        json={"value": 275, "effective_date": "2026-09-15"},
    )
    corrected = client.put(
        "/strength/maxes/bench_press",
        json={"value": 280, "effective_date": "2026-09-15"},
    )
    future = client.put(
        "/strength/maxes/bench_press",
        json={"value": 300, "effective_date": "2999-01-01"},
    )

    assert (
        first.status_code
        == second.status_code
        == corrected.status_code
        == future.status_code
        == 200
    )
    assert corrected.json()["id"] == second.json()["id"]
    assert corrected.json()["created_at"] == second.json()["created_at"]
    assert "unit" not in corrected.json()

    body = client.get("/strength/maxes").json()
    assert [(item["effective_date"], item["value"]) for item in body["history"]] == [
        ("2026-09-01", 265.0),
        ("2026-09-15", 280.0),
        ("2999-01-01", 300.0),
    ]
    assert body["current"][0]["value"] == 280.0


def test_maxes_are_scoped_to_authenticated_user(
    repositories: StrengthRepositories,
) -> None:
    other = client.put(
        "/strength/maxes/deadlift",
        json={"value": 405, "effective_date": "2026-09-01"},
    ).json()
    item = repositories.maxes.list_for_user(USER_ID)[0].model_copy(
        update={"id": "other-max", "exercise_key": "private_max"}
    )
    repositories.maxes.upsert(item, OTHER_USER_ID)

    body = client.get("/strength/maxes").json()
    assert [item["id"] for item in body["history"]] == [other["id"]]


def test_exercise_library_returns_built_ins_and_user_custom_exercises() -> None:
    created = client.post(
        "/strength/exercises",
        json={
            "name": "Landmine Press",
            "category": "landmine",
            "default_max_source": "overhead_press",
        },
    )

    assert created.status_code == 201
    assert created.json()["is_custom"] is True
    body = client.get("/strength/exercises").json()
    ids = {exercise["id"] for exercise in body}
    assert {"bench_press", "back_squat", created.json()["id"]}.issubset(ids)


def test_custom_exercises_are_scoped_to_user(
    repositories: StrengthRepositories,
) -> None:
    custom = client.post(
        "/strength/exercises",
        json={"name": "Private movement", "category": "custom"},
    ).json()
    repositories.exercises.create(
        Exercise(
            id="other-exercise",
            name="Other user's movement",
            category="custom",
            is_custom=True,
        ),
        OTHER_USER_ID,
    )

    visible_custom_ids = {
        item["id"]
        for item in client.get("/strength/exercises").json()
        if item["is_custom"]
    }
    assert visible_custom_ids == {custom["id"]}


def test_other_users_custom_exercise_cannot_be_used(
    repositories: StrengthRepositories,
) -> None:
    repositories.exercises.create(
        Exercise(
            id="other-exercise",
            name="Other user's movement",
            category="custom",
            is_custom=True,
        ),
        OTHER_USER_ID,
    )
    payload = session_payload()
    blocks = cast(list[dict[str, Any]], payload["exercise_blocks"])
    blocks[0]["exercise_id"] = "other-exercise"

    response = client.post("/strength/sessions", json=payload)

    assert response.status_code == 422
    assert response.json() == {"detail": "Unknown exercise: other-exercise"}


def test_session_crud_preserves_order_prescription_execution_and_superset(
    repositories: StrengthRepositories,
) -> None:
    created = client.post("/strength/sessions", json=session_payload())

    assert created.status_code == 201
    session = created.json()
    session_id = session["id"]
    record = repositories.sessions.get(session_id)
    assert record is not None
    assert record.user_id == USER_ID
    assert [block["order"] for block in session["exercise_blocks"]] == [1, 2]
    assert [block["group_id"] for block in session["exercise_blocks"]] == [
        "superset-a",
        "superset-a",
    ]
    first_block = session["exercise_blocks"][0]
    assert [item["set_number"] for item in first_block["planned_sets"]] == [1, 2]
    assert first_block["planned_sets"][0]["target_reps"] == 5
    assert first_block["actual_sets"][0]["actual_reps"] == 5
    assert "actual_reps" not in first_block["planned_sets"][0]

    fetched = client.get(f"/strength/sessions/{session_id}")
    assert fetched.status_code == 200
    assert fetched.json() == session

    updated = client.patch(
        f"/strength/sessions/{session_id}",
        json={"title": "Updated upper body", "notes": None},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated upper body"
    assert updated.json()["notes"] is None
    assert updated.json()["exercise_blocks"] == session["exercise_blocks"]

    deleted = client.delete(f"/strength/sessions/{session_id}")
    assert deleted.status_code == 204
    assert client.get(f"/strength/sessions/{session_id}").status_code == 404


def test_session_patch_distinguishes_omitted_blocks_from_empty_blocks() -> None:
    session_id = client.post("/strength/sessions", json=session_payload()).json()["id"]

    omitted = client.patch(
        f"/strength/sessions/{session_id}", json={"title": "Keep blocks"}
    )
    cleared = client.patch(
        f"/strength/sessions/{session_id}", json={"exercise_blocks": []}
    )

    assert len(omitted.json()["exercise_blocks"]) == 2
    assert cleared.json()["exercise_blocks"] == []
    assert (
        client.patch(
            f"/strength/sessions/{session_id}", json={"exercise_blocks": None}
        ).status_code
        == 422
    )


def test_strength_week_is_monday_through_sunday_and_orders_sessions() -> None:
    later = session_payload()
    later["date"] = "2026-09-27"
    earlier = session_payload()
    earlier["date"] = "2026-09-21"
    later_response = client.post("/strength/sessions", json=later)
    earlier_response = client.post("/strength/sessions", json=earlier)

    response = client.get("/strength/weeks/2026-09-24")

    assert response.status_code == 200
    assert response.json()["week_start"] == "2026-09-21"
    assert response.json()["week_end"] == "2026-09-27"
    assert [item["id"] for item in response.json()["sessions"]] == [
        earlier_response.json()["id"],
        later_response.json()["id"],
    ]


def test_session_date_patch_moves_session_between_weeks() -> None:
    session_id = client.post("/strength/sessions", json=session_payload()).json()["id"]

    response = client.patch(
        f"/strength/sessions/{session_id}", json={"date": "2026-09-28"}
    )

    assert response.status_code == 200
    assert client.get("/strength/weeks/2026-09-21").json()["sessions"] == []
    assert [
        item["id"]
        for item in client.get("/strength/weeks/2026-09-28").json()["sessions"]
    ] == [session_id]


def test_session_supports_distance_and_duration_execution() -> None:
    payload = {
        "date": "2026-09-23",
        "title": "Carries and holds",
        "exercise_blocks": [
            {
                "id": "carry-block",
                "exercise_id": "farmers_walk",
                "order": 1,
                "planned_sets": [
                    {
                        "id": "carry-set",
                        "set_number": 1,
                        "target_distance": 20,
                        "distance_unit": "yards",
                        "target_weight": 80,
                    }
                ],
                "actual_sets": [
                    {
                        "planned_set_id": "carry-set",
                        "actual_distance": 22,
                        "actual_weight": 85,
                        "completed": True,
                    }
                ],
            },
            {
                "id": "hold-block",
                "exercise_id": "farmers_walk",
                "order": 2,
                "planned_sets": [
                    {
                        "id": "hold-set",
                        "set_number": 1,
                        "target_duration_seconds": 30,
                    }
                ],
                "actual_sets": [
                    {
                        "planned_set_id": "hold-set",
                        "actual_duration_seconds": 35,
                        "completed": True,
                    }
                ],
            },
        ],
    }

    response = client.post("/strength/sessions", json=payload)

    assert response.status_code == 201
    blocks = response.json()["exercise_blocks"]
    assert blocks[0]["planned_sets"][0]["distance_unit"] == "yards"
    assert blocks[0]["actual_sets"][0]["actual_distance"] == 22.0
    assert blocks[1]["planned_sets"][0]["target_duration_seconds"] == 30
    assert blocks[1]["actual_sets"][0]["actual_duration_seconds"] == 35


@pytest.mark.parametrize(
    "fields",
    [
        {"percentage": 65},
        {"max_source": "bench_press"},
    ],
)
def test_session_route_requires_percentage_and_max_source_pairing(
    fields: dict[str, object],
) -> None:
    payload = session_payload()
    blocks = cast(list[dict[str, Any]], payload["exercise_blocks"])
    planned_sets = cast(list[dict[str, Any]], blocks[0]["planned_sets"])
    planned_sets[0].update(fields)

    response = client.post("/strength/sessions", json=payload)

    assert response.status_code == 422


def test_session_route_accepts_resolved_percentage_and_fixed_weight_sets() -> None:
    payload = session_payload()
    blocks = cast(list[dict[str, Any]], payload["exercise_blocks"])
    percentage_sets = cast(list[dict[str, Any]], blocks[0]["planned_sets"])
    percentage_sets[0].update(
        {
            "percentage": 65,
            "max_source": "bench_press",
            "max_value_at_creation": 285,
            "target_weight": 185,
        }
    )

    response = client.post("/strength/sessions", json=payload)

    assert response.status_code == 201
    response_blocks = response.json()["exercise_blocks"]
    assert response_blocks[0]["planned_sets"][0]["target_weight"] == 185.0
    assert response_blocks[1]["planned_sets"][0]["target_weight"] == 60.0


def test_session_route_rejects_actual_distance_for_rep_only_set() -> None:
    payload = session_payload()
    blocks = cast(list[dict[str, Any]], payload["exercise_blocks"])
    actual_sets = cast(list[dict[str, Any]], blocks[0]["actual_sets"])
    actual_sets[0]["actual_distance"] = 20

    response = client.post("/strength/sessions", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_cross_user_session_access_is_hidden(
    repositories: StrengthRepositories,
    method: str,
) -> None:
    session = StrengthSession(
        id="other-session",
        date=date(2026, 9, 23),
        title="Private",
        exercise_blocks=[],
    )
    repositories.sessions.create(session, OTHER_USER_ID, NOW, NOW)

    request = getattr(client, method)
    kwargs = {"json": {"title": "Changed"}} if method == "patch" else {}
    response = request("/strength/sessions/other-session", **kwargs)

    assert response.status_code == 404
    assert response.json() == {"detail": "Strength session not found"}


def test_template_crud_preserves_prescription_without_execution(
    repositories: StrengthRepositories,
) -> None:
    created = client.post("/strength/templates", json=template_payload())

    assert created.status_code == 201
    template = created.json()
    template_id = template["id"]
    record = repositories.templates.get(template_id)
    assert record is not None
    assert record.user_id == USER_ID
    planned = template["exercise_blocks"][0]["planned_sets"][0]
    assert planned["percentage"] == 50.0
    assert planned["max_source"] == "bench_press"
    assert "max_value_at_creation" not in planned
    assert planned["target_weight"] is None
    assert template["exercise_blocks"][1]["planned_sets"][0]["target_weight"] == 70.0
    assert "actual_sets" not in template["exercise_blocks"][0]
    assert client.get("/strength/templates").json() == [template]

    updated = client.patch(
        f"/strength/templates/{template_id}", json={"name": "Updated template"}
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated template"
    assert updated.json()["exercise_blocks"] == template["exercise_blocks"]

    assert client.delete(f"/strength/templates/{template_id}").status_code == 204
    assert client.get("/strength/templates").json() == []


def test_template_patch_distinguishes_omitted_blocks_from_empty_blocks() -> None:
    template_id = client.post("/strength/templates", json=template_payload()).json()[
        "id"
    ]

    omitted = client.patch(
        f"/strength/templates/{template_id}", json={"name": "Keep blocks"}
    )
    cleared = client.patch(
        f"/strength/templates/{template_id}", json={"exercise_blocks": []}
    )

    assert len(omitted.json()["exercise_blocks"]) == 2
    assert cleared.json()["exercise_blocks"] == []
    assert (
        client.patch(
            f"/strength/templates/{template_id}", json={"exercise_blocks": None}
        ).status_code
        == 422
    )


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_cross_user_template_access_is_hidden(
    repositories: StrengthRepositories,
    method: str,
) -> None:
    template = StrengthTemplate(
        id="other-template",
        name="Private",
        exercise_blocks=[],
    )
    repositories.templates.create(template, OTHER_USER_ID, NOW, NOW)

    request = getattr(client, method)
    kwargs = {"json": {"name": "Changed"}} if method == "patch" else {}
    response = request("/strength/templates/other-template", **kwargs)

    assert response.status_code == 404
    assert response.json() == {"detail": "Strength template not found"}


@pytest.mark.parametrize(
    "mutation",
    [
        lambda payload: payload["exercise_blocks"][0]["planned_sets"][0].update(
            {"target_reps": -1}
        ),
        lambda payload: payload["exercise_blocks"][0]["planned_sets"][0].update(
            {"target_reps": 0}
        ),
        lambda payload: payload["exercise_blocks"][0]["planned_sets"][0].update(
            {"target_weight": -1}
        ),
        lambda payload: payload["exercise_blocks"][0]["planned_sets"][0].update(
            {"percentage": 501}
        ),
        lambda payload: (
            payload["exercise_blocks"][0]["planned_sets"][0].pop("target_reps"),
            payload["exercise_blocks"][0]["planned_sets"][0].update(
                {"target_weight": 100}
            ),
        ),
    ],
)
def test_session_rejects_invalid_prescription_values(mutation) -> None:
    payload = session_payload()
    mutation(payload)

    assert client.post("/strength/sessions", json=payload).status_code == 422


def test_max_rejects_non_positive_value() -> None:
    response = client.put(
        "/strength/maxes/bench_press",
        json={"value": 0, "effective_date": "2026-09-01"},
    )

    assert response.status_code == 422


def test_max_rejects_unit_field_in_pounds_only_contract() -> None:
    response = client.put(
        "/strength/maxes/bench_press",
        json={"value": 265, "unit": "kg", "effective_date": "2026-09-01"},
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("get", "/strength/maxes", None),
        ("put", "/strength/maxes/bench_press", {}),
        ("get", "/strength/exercises", None),
        ("post", "/strength/exercises", {}),
        ("get", "/strength/weeks/2026-09-21", None),
        ("get", "/strength/sessions/session-id", None),
        ("post", "/strength/sessions", {}),
        ("patch", "/strength/sessions/session-id", {}),
        ("delete", "/strength/sessions/session-id", None),
        ("get", "/strength/templates", None),
        ("post", "/strength/templates", {}),
        ("patch", "/strength/templates/template-id", {}),
        ("delete", "/strength/templates/template-id", None),
    ],
)
def test_strength_routes_require_authentication(
    method: str,
    path: str,
    payload: dict[str, object] | None,
) -> None:
    app.dependency_overrides.pop(get_current_user, None)

    response = client.request(method, path, json=payload)

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}
