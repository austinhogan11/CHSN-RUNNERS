from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CHSN-RUNNERS"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    workout_repository: Literal["memory", "dynamodb"] = "memory"
    workout_table_name: str | None = None
    # Temporary single-user identity until authentication supplies request ownership.
    workout_default_user_id: str = "local-development-user"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
