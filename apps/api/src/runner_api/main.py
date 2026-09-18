import json
import logging
import time
import uuid

from fastapi import FastAPI, Request

from runner_api.config import settings
from runner_api.models.system import StatusResponse, VersionResponse

logger = logging.getLogger("runner_api")
logger.setLevel(logging.INFO)

app = FastAPI(title=settings.app_name, version=settings.app_version)


@app.middleware("http")
async def log_request(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
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
