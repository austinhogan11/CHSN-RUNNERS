import json
import logging
import uuid
from typing import cast

from fastapi.testclient import TestClient
from mangum.types import LambdaContext

from runner_api.lambda_handler import handler
from runner_api.main import app


class FakeLambdaContext:
    function_name = "chsn-runners-api"
    function_version = "$LATEST"
    invoked_function_arn = (
        "arn:aws:lambda:us-east-1:123456789012:function:chsn-runners-api"
    )
    memory_limit_in_mb = 512
    aws_request_id = "lambda-request-789"
    log_group_name = "/aws/lambda/chsn-runners-api"
    log_stream_name = "test-stream"

    identity = None
    client_context = None

    def get_remaining_time_in_millis(self) -> int:
        return 30_000


client = TestClient(app)


def test_uses_incoming_request_id_header() -> None:
    response = client.get(
        "/health",
        headers={"x-request-id": "client-request-123"},
    )

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "client-request-123"


def test_generates_request_id_when_none_exists() -> None:
    response = client.get("/health")

    assert response.status_code == 200

    request_id = response.headers["x-request-id"]

    # Raises ValueError if this is not a valid UUID.
    parsed = uuid.UUID(request_id)

    assert str(parsed) == request_id


def test_gateway_request_id_is_canonical(caplog) -> None:
    event = {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": "/api/health",
        "rawQueryString": "",
        "headers": {
            "host": "example.execute-api.us-east-1.amazonaws.com",
            "x-forwarded-proto": "https",
            "x-request-id": "client-request-123",
        },
        "requestContext": {
            "accountId": "123456789012",
            "apiId": "test",
            "domainName": "example.execute-api.us-east-1.amazonaws.com",
            "domainPrefix": "example",
            "http": {
                "method": "GET",
                "path": "/api/health",
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
                "userAgent": "pytest",
            },
            "requestId": "gateway-request-456",
            "routeKey": "$default",
            "stage": "$default",
            "time": "18/Sep/2026:00:00:00 +0000",
            "timeEpoch": 1789689600000,
        },
        "isBase64Encoded": False,
    }

    context = FakeLambdaContext()

    with caplog.at_level(logging.INFO, logger="runner_api"):
        response = handler(event, cast(LambdaContext, context))

    assert response["statusCode"] == 200
    assert response["headers"]["x-request-id"] == "gateway-request-456"

    request_log = next(
        json.loads(record.getMessage())
        for record in caplog.records
        if '"event": "http_request"' in record.getMessage()
    )

    assert request_log["request_id"] == "gateway-request-456"
    assert request_log["gateway_request_id"] == "gateway-request-456"
    assert request_log["lambda_request_id"] == "lambda-request-789"
