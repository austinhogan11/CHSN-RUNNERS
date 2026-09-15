from pydantic import BaseModel


class StatusResponse(BaseModel):
    status: str


class VersionResponse(BaseModel):
    version: str
    environment: str
