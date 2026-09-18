import json
import logging
import time
import uuid

from fastapi import FastAPI, Request

from runner_api.config import settings
from runner_api.models.system import StatusResponse, VersionResponse
from runner_api.routes.trends import router as trends_router
from runner_api.routes.workouts import router as workouts_router

logger = logging.getLogger("runner_api")
logger.setLevel(logging.INFO)

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.include_router(workouts_router)
app.include_router(trends_router)


@app.middleware("http")
async def log_request(request: Request, call_next):
    event = request.scope.get("aws.event", {})
    context = request.scope.get("aws.context")

    gateway_request_id = None
    if isinstance(event, dict):
        request_context = event.get("requestContext", {})
        if isinstance(request_context, dict):
            gateway_request_id = request_context.get("requestId")

    lambda_request_id = (
        getattr(context, "aws_request_id", None) if context is not None else None
    )

    request_id = (
        gateway_request_id or request.headers.get("x-request-id") or str(uuid.uuid4())
    )

    started_at = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)

        logger.exception(
            json.dumps(
                {
                    "event": "http_request",
                    "request_id": request_id,
                    "gateway_request_id": gateway_request_id,
                    "lambda_request_id": lambda_request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": 500,
                    "duration_ms": duration_ms,
                }
            )
        )
        raise

    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)

    logger.info(
        json.dumps(
            {
                "event": "http_request",
                "request_id": request_id,
                "gateway_request_id": gateway_request_id,
                "lambda_request_id": lambda_request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            }
        )
    )

    response.headers["x-request-id"] = request_id

    return response


@app.get("/health", response_model=StatusResponse)
def health() -> StatusResponse:
    return StatusResponse(status="ok")


@app.get("/ready", response_model=StatusResponse)
def ready() -> StatusResponse:
    return StatusResponse(status="ready")


@app.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        version=settings.app_version,
        environment=settings.environment,
    )
