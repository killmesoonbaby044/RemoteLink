from typing import Optional
from pydantic import BaseModel


class Login(BaseModel):
    username: str
    password: str


class AccessTokenPayload(BaseModel):
    sub: str
    user_id: int
    org_unit_id: int
    type: str


class RefreshTokenPayload(AccessTokenPayload):
    jti: str


class BearerTokens(BaseModel):
    access_token: Optional[str] = "access_token"
    refresh_token: Optional[str] = "refresh_token"
    refresh_token_v2: Optional[str] = "refresh_token_v2"


TokensNames = BearerTokens()


class TokenRedisPrefix(BaseModel):
    lock: str = "refresh:lock:"
    result: str = "refresh:result:"
    ban: str = "token:ban:"


class ExposeCookie(BaseModel):
    expose: str = "expose_objects"


ExposeCookieName = ExposeCookie()
