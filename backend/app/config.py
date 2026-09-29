from pathlib import Path
from typing import List, Union
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base backend directory: c:/Users/.../trace/backend
BACKEND_DIR = Path(__file__).resolve().parent.parent
CANONICAL_DB_PATH = BACKEND_DIR / "tracelt.db"
DEFAULT_SQLITE_URL = f"sqlite:///{CANONICAL_DB_PATH.as_posix()}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tracelt API"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Security & JWT
    SECRET_KEY: str = "tracelt_development_super_secret_jwt_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_URL: str = DEFAULT_SQLITE_URL

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def resolve_database_url(cls, v: Union[str, None]) -> str:
        if not v or not isinstance(v, str):
            return DEFAULT_SQLITE_URL
        v_stripped = v.strip()
        if v_stripped.startswith("sqlite:///"):
            raw_path = v_stripped[len("sqlite:///"):]
            p = Path(raw_path)
            if not p.is_absolute() and not raw_path.startswith("/"):
                if p.parts and p.parts[0] == "backend":
                    resolved_file = (BACKEND_DIR.parent / p).resolve()
                else:
                    resolved_file = (BACKEND_DIR / p).resolve()
                return f"sqlite:///{resolved_file.as_posix()}"
        return v_stripped

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
