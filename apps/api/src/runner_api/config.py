from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CHSN-RUNNERS"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    workout_repository: Literal["memory", "dynamodb"] = "memory"
    workout_table_name: str | None = None
    workout_demo_user_id: str = "local-development-user"
    clerk_issuer: str | None = None
    clerk_jwks_url: str | None = None
    clerk_authorized_parties: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
