import asyncio

from fastapi import Request
from jose import jwt, JWTError, ExpiredSignatureError
from loguru import logger

from app.core.types import AccessToken
from app.domains.users import UserNotFound
from app.core.auth.exception import InvalidTokenError
from app.core.auth.token.jwt_service import JWTService
from app.core.auth.token.redis_token_repo import RedisTokenRepository
from app.core.auth.cookie_helper import get_cookie_token
from app.core.auth.auth_schemas import (
    AccessTokenPayload,
    RefreshTokenPayload,
    BearerTokens,
    TokensNames,
)


class AuthTokenManager:
    """Verifies incoming access tokens on each request and coordinates a distributed,
    Redis-locked silent refresh when the access token is expired,
    ensuring only one concurrent request performs the actual rotation."""

    def __init__(
        self,
        request: Request,
        access_token: AccessToken,
        jwt_service: JWTService,
        redis_token_repo: RedisTokenRepository,
    ):
        self.request = request
        self.access_token = access_token
        self.jwt_service = jwt_service
        self.redis_token_repo = redis_token_repo

    async def verify_access_token(self) -> AccessTokenPayload:
        """Verify access token or trigger refresh if expired."""
        if self.access_token:
            try:
                payload = jwt.decode(
                    self.access_token,
                    self.jwt_service.secret_key,
                    algorithms=[self.jwt_service.algorithm],
                )
                return AccessTokenPayload(**payload)
            except ExpiredSignatureError:
                # Token expired, proceed to refresh
                pass
            except ValueError as e:
                logger.warning(f"Access token ValueError: {e!r}")
                raise InvalidTokenError()
            except JWTError as e:
                logger.error(f"Access token JWTError: {e!r}")
                raise InvalidTokenError()

        return await self._refresh_tokens()

    def _decode_refresh_token(self, refresh_token: str) -> RefreshTokenPayload:
        """Decode and validate refresh token structure."""
        try:
            payload = RefreshTokenPayload(
                **jwt.decode(
                    refresh_token,
                    self.jwt_service.secret_key,
                    algorithms=[self.jwt_service.algorithm],
                )
            )

            if payload.type != TokensNames.refresh_token:
                logger.warning(f"Invalid token type: {payload.type}")
                raise InvalidTokenError()
            return payload

        except ExpiredSignatureError:
            logger.info("Refresh token expired")
            raise InvalidTokenError()
        except (ValueError, JWTError) as e:
            logger.error(f"Token verification failed: {e!r}")
            raise InvalidTokenError()
        except Exception as e:
            logger.critical(f"Unexpected error in token decoding: {e!r}")
            raise InvalidTokenError()

    async def _refresh_tokens(self) -> AccessTokenPayload:
        """Handle token refresh with distributed locking."""
        # Prevent recursive refresh attempts
        if getattr(self.request.state, "refresh_applied", False):
            raise InvalidTokenError()

        refresh_token = get_cookie_token(self.request, TokensNames.refresh_token)
        if not refresh_token:
            logger.debug("No tokens found")
            raise InvalidTokenError()

        refresh_token_payload = self._decode_refresh_token(refresh_token)

        jti = refresh_token_payload.jti

        # Check if tokens are refreshing by another concurrent request
        existing_tokens = await self.redis_token_repo.get_new_tokens(jti)
        if existing_tokens:
            return await self._finalize_refresh(new_tokens=existing_tokens, old_jti=jti)

        # Try to acquire lock for token refresh
        lock_acquired = await self.redis_token_repo.acquire_refresh_lock(jti)

        if lock_acquired:
            if await self.redis_token_repo.is_revoked(jti):
                logger.error(f"Attempted refresh with blacklisted token: {jti}")
                raise InvalidTokenError()

            return await self._perform_token_refresh(jti, refresh_token_payload)
        else:
            return await self._wait_for_token_refresh(jti)

    async def _perform_token_refresh(
        self, old_jti: str, refresh_token_payload: RefreshTokenPayload
    ) -> AccessTokenPayload:
        """Perform the actual token refresh (called by lock holder)."""

        try:
            new_tokens = await self.jwt_service.create_tokens_by_user_id(
                user_id=refresh_token_payload.user_id
            )
        except UserNotFound:
            logger.info(
                f"Token refresh denied for user {refresh_token_payload.sub!r}. "
                f"Account not found or inactive"
            )
            raise InvalidTokenError()

        # Store in Redis for concurrent requests
        await self.redis_token_repo.store_new_tokens(old_jti, new_tokens)

        return await self._finalize_refresh(new_tokens=new_tokens, old_jti=old_jti)

    async def _wait_for_token_refresh(
        self,
        old_jti: str,
    ) -> AccessTokenPayload:
        delay = 0.02
        max_delay = 0.25
        loop = asyncio.get_running_loop()
        deadline = loop.time() + 1.0

        while loop.time() < deadline:
            new_tokens = await self.redis_token_repo.get_new_tokens(old_jti)
            if new_tokens:
                return await self._finalize_refresh(
                    new_tokens=new_tokens, old_jti=old_jti
                )
            await asyncio.sleep(delay)
            delay = min(delay * 2, max_delay)

        self.request.state.is_not_refresh_leader = True
        raise InvalidTokenError()

    async def _finalize_refresh(
        self,
        new_tokens: BearerTokens,
        old_jti: str,
    ) -> AccessTokenPayload:
        self.access_token = new_tokens.access_token
        self.request.state.refresh_applied = True
        self.request.state.middleware_data = new_tokens
        self.request.state.old_token_jti = old_jti

        return await self.verify_access_token()
