from fastapi import FastAPI

from runner_api.config import settings
from runner_api.models.system import StatusResponse, VersionResponse

app = FastAPI(title=settings.app_name, version=settings.app_version)


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
