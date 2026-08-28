import json
from typing import Optional
from loguru import logger

from app.core.auth.auth_schemas import TokenRedisPrefix, BearerTokens
from app.core.types import GeneralRedis, BanTTL


class RedisTokenRepository:
    """Repository for managing token refresh synchronization via Redis."""

    LOCK_TTL = 10  # seconds - lock expiration
    TOKENS_TTL = 30  # seconds - how long to keep new tokens in Redis

    def __init__(self, redis: GeneralRedis, ban_ttl: BanTTL):
        self.redis = redis
        self.prefix = TokenRedisPrefix()
        self._BAN_TTL = ban_ttl  # seconds - ban token

    async def acquire_refresh_lock(self, jti: str) -> bool:
        """
        Try to acquire a distributed lock for token refresh.
        Returns True if lock acquired, False otherwise.
        """
        lock_key = self.prefix.lock + jti
        result = await self.redis.set(lock_key, "1", nx=True, ex=self.LOCK_TTL)
        return result is not None

    async def release_refresh_lock(self, jti: str) -> None:
        """(not used)Release the refresh lock (used on error cleanup)."""
        lock_key = self.prefix.lock + jti
        await self.redis.delete(lock_key)

    async def store_new_tokens(self, old_jti: str, tokens: BearerTokens) -> None:
        """Store newly generated tokens in Redis for concurrent requests."""
        tokens_key = self.prefix.result + old_jti
        tokens_data = {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
        }
        await self.redis.set(
            name=tokens_key, value=json.dumps(tokens_data), ex=self.TOKENS_TTL
        )

    async def get_new_tokens(self, old_jti: str) -> Optional[BearerTokens]:
        """Retrieve new tokens from Redis if they exist."""
        tokens_key = self.prefix.result + old_jti
        tokens_data = await self.redis.get(tokens_key)

        if not tokens_data:
            return None

        try:
            data = json.loads(tokens_data)
            return BearerTokens(
                access_token=data["access_token"],
                refresh_token=data["refresh_token"],
            )
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Failed to parse tokens from Redis for jti {old_jti}: {e!r}")
            return None

    async def revoke_token(self, old_jti: str):
        tokens_key = self.prefix.ban + old_jti
        return await self.redis.set(tokens_key, "1", nx=True, ex=self._BAN_TTL)

    async def is_revoked(self, jti: str) -> bool:
        key = self.prefix.ban + jti
        return await self.redis.exists(key) == 1
