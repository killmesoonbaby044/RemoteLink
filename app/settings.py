from base64 import b64decode
from functools import lru_cache
from typing import Literal, final, Optional

from pydantic import BaseModel, field_validator, Base64Bytes
from pydantic_settings import BaseSettings, SettingsConfigDict

# class JwtConfig(BaseModel):
#     secret_key: str
#     algorithm: str = "HS256"
#     refresh_expires_in_minutes: int = 14400  # 10 days
#
#
# class APIConfig(BaseModel):
#     title: str = "Template API"
#     version: str = "1.0.0"
#     port: int = 8000
#     host: str = "0.0.0.0"
#     allowed_hosts: list[str]
#
#     page_max_size: int = 100
#     page_default_size: int = 10
#

#
#
# class PathsConfig:
#     src_path = Path(__file__).parent.parent
#     app_path = src_path / "app"
#     database_path = app_path / "database"
#     models_path = database_path / "models"
#     modules_path = app_path / "api" / "modules"
#


@final
class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    auth_api: str
    jwt_issuer: str
    jwt_audience: str
    jwt_pub_key: Base64Bytes
    jwt_algorithm: Optional[str] = "ES256"
    jwt_expires: Optional[int] = 864000


@lru_cache
def get_config() -> Config:
    return Config()
