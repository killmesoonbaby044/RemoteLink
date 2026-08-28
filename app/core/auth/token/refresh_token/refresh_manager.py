from datetime import datetime, timezone

from loguru import logger
from starlette.requests import Request

from app.core.auth.crypto import get_token_hash
from app.core.auth.token.refresh_token.refresh_token_service import RefreshTokenService
from app.core.auth.token.jwt_service import JWTService
from app.core.auth.auth_schemas import TokensNames, BearerTokens
from app.core.auth.exception import InvalidTokenError
from app.domains.base import IUnitOfWork
from app.domains.users import UserNotFound


class RefreshTokenManager:
    """Handles the explicit refresh token rotation flow:
    validates the stored token record, detects reuse attacks,
    and issues new token pairs against the DB-backed refresh token family."""

    def __init__(
        self,
        request: Request,
        uow: IUnitOfWork,
        jwt_service: JWTService,
        refresh_token_service: RefreshTokenService,
    ):
        self.request = request
        self._uow = uow
        self.jwt_service = jwt_service
        self.refresh_token_service = refresh_token_service

    async def refresh_tokens(self) -> BearerTokens:
        extracted_token = self._extract_token()
        token_hash = get_token_hash(extracted_token)
        token_record = await self._uow.refresh_token.get_refresh_token(token_hash)
        if not await self._validate_refresh_token(token_record):
            raise InvalidTokenError()

        new_tokens = await self._issue_new_tokens(token_record.user_id)
        await self._rotate_refresh_token(token_record, new_tokens.refresh_token)
        await self._uow.commit()
        return new_tokens

    def _extract_token(self) -> str:
        refresh_token = self.request.cookies.get(TokensNames.refresh_token_v2)
        if not refresh_token:
            logger.info(f"Token refresh denied: Token not found in request")
            raise InvalidTokenError()
        return refresh_token

    async def _validate_refresh_token(self, token_record) -> bool:
        if not token_record:
            logger.info(f"Token refresh denied: Token not found in db")
            return False

        if token_record.revoked:
            logger.warning(
                f"Security breach. Token refresh denied for user_id {token_record.user_id!r}. "
                f"Token already revoked"
            )
            await self._uow.refresh_token.kill_family(token_record.family_id)
            await self._uow.commit()
            return False

        if token_record.expires_at < datetime.now(timezone.utc):
            logger.warning(f"Token refresh denied: Token expired")
            await self._uow.refresh_token.delete(token_record)
            await self._uow.commit()
            return False

        return True

    async def _issue_new_tokens(self, user_id: int) -> BearerTokens:
        try:
            return await self.jwt_service.create_tokens_by_user_id_v2(user_id=user_id)
        except UserNotFound:
            logger.info(
                f"Token refresh denied for user_id: {user_id!r}. Account not found or inactive"
            )
            raise InvalidTokenError()

    async def _rotate_refresh_token(self, token_record, new_refresh_token: str) -> None:
        token_record.revoked = True
        await self.refresh_token_service.append_family_record(
            token_record, new_refresh_token
        )
