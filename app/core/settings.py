from functools import lru_cache
from pathlib import Path
from typing import Optional, final

from pydantic import BaseModel
from pydantic_settings import (
    SettingsConfigDict,
    BaseSettings,
    PydanticBaseSettingsSource,
    YamlConfigSettingsSource,
)


class DBSettings(BaseModel):
    hostname: str
    # database_port: str
    username: str
    password: str
    name: str


class RedisSettings(BaseModel):
    host: str
    password: str


class TokenSettings(BaseModel):
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    refresh_token_expire_days: int


class LdapSettings(BaseModel):
    hostname: str
    hostname_backup: Optional[str] = None
    username: str
    password: str


class LdapSchemaSettings(BaseModel):
    base_dn: str
    allowed_group: str


CONFIG_FILE_PATH: Path = Path(__file__).parent / "config.yaml"


@final
class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="APP__",
        env_nested_delimiter="__",
        yaml_file=CONFIG_FILE_PATH,
        yaml_file_encoding="utf-8",
        extra="ignore",
    )

    db: DBSettings
    redis: RedisSettings
    token: TokenSettings
    ldap: LdapSettings
    ldap_schema: LdapSchemaSettings
    environment: str
    log_level: str

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        **kwargs,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            YamlConfigSettingsSource(settings_cls),
            kwargs["env_settings"],
            kwargs["dotenv_settings"],
        )

    @property
    def db_url(self) -> str:
        return (
            f"postgresql+asyncpg://"
            f"{self.db.username}:{self.db.password}"
            f"@{self.db.hostname}/{self.db.name}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://:{self.redis.password}@{self.redis.host}"


@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()
