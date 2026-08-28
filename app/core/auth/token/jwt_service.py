from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import jwt
from loguru import logger

from app.core.auth.crypto import create_refresh_token
from app.core.settings import TokenSettings
from app.domains.users import UserService, UserDTO
from app.core.auth.auth_schemas import BearerTokens, TokensNames


class JWTService:
    """Central factory for JWT access/refresh token pairs,
    encapsulating signing configuration and user resolution
    for both the JWT-based (V1) and opaque-token (V2) issuance strategies."""

    def __init__(
        self,
        token_settings: TokenSettings,
        user_service: UserService,
    ):
        self.secret_key = token_settings.secret_key
        self.algorithm = token_settings.algorithm
        self.access_token_expire_minutes = token_settings.access_token_expire_minutes
        self.refresh_token_expire_days = token_settings.refresh_token_expire_days
        self.user_service = user_service

    def _create_jwt_token(self, user: UserDTO, token_type: TokensNames):
        ou_id = user.org_unit_id if user else 0
        data_to_encode = {
            "sub": user.username,
            "user_id": user.id,
            "org_unit_id": ou_id,
        }
        if token_type == TokensNames.access_token:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=self.access_token_expire_minutes
            )
        elif token_type == TokensNames.refresh_token:
            expire = datetime.now(timezone.utc) + timedelta(
                days=self.refresh_token_expire_days
            )
            jti = str(uuid4())
            data_to_encode["jti"] = jti
            logger.debug(f"New refresh JWT for user: {user.username} with id: {jti}")

        else:
            raise ValueError(f"Unsupported token type: {token_type!r}")

        exp = int(expire.timestamp())
        data_to_encode.update({"exp": exp, "type": token_type})
        encoded_jwt = jwt.encode(
            data_to_encode, self.secret_key, algorithm=self.algorithm
        )
        return encoded_jwt

    def create_tokens_by_user(self, user) -> BearerTokens:
        access_token = self._create_jwt_token(
            user=user, token_type=TokensNames.access_token
        )
        refresh_token = self._create_jwt_token(
            user=user, token_type=TokensNames.refresh_token
        )
        tokens = BearerTokens(access_token=access_token, refresh_token=refresh_token)

        return tokens

    async def create_tokens_by_user_id(self, user_id: int) -> BearerTokens:
        user = await self.user_service.get_active_user(user_id)
        tokens = self.create_tokens_by_user(user)
        return tokens

    def create_tokens_by_user_v2(self, user) -> BearerTokens:
        access_token = self._create_jwt_token(
            user=user, token_type=TokensNames.access_token
        )
        refresh_token = create_refresh_token()
        return BearerTokens(access_token=access_token, refresh_token=refresh_token)

    async def create_tokens_by_user_id_v2(self, user_id: int) -> BearerTokens:
        user = await self.user_service.get_active_user(user_id)
        return self.create_tokens_by_user_v2(user=user)
