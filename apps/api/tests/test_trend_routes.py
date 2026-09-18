from fastapi.testclient import TestClient

from runner_api.main import app

client = TestClient(app)


def test_get_mileage_trend_defaults_to_12_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={"end": "2026-09-20"},
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 12
    assert body[-1]["week_start"] == "2026-09-14"
    assert body[-1]["planned_distance"] == 30.0
    assert body[-1]["actual_distance"] == 5.1


def test_get_mileage_trend_returns_requested_number_of_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 4,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 4
    assert body[0]["week_start"] == "2026-08-24"
    assert body[-1]["week_start"] == "2026-09-14"


def test_get_mileage_trend_includes_empty_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 2,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body[0] == {
        "week_start": "2026-09-07",
        "planned_distance": 0.0,
        "actual_distance": 0.0,
    }


def test_get_mileage_trend_rejects_zero_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 0,
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "weeks must be between 1 and 52"}


def test_get_mileage_trend_rejects_more_than_52_weeks() -> None:
    response = client.get(
        "/trends/mileage",
        params={
            "end": "2026-09-20",
            "weeks": 53,
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "weeks must be between 1 and 52"}
