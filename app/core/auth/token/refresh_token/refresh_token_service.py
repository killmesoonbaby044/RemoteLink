from datetime import datetime, timezone, timedelta
from uuid import uuid4

from app.core.auth.crypto import get_token_hash
from app.core.settings import TokenSettings
from app.domains.base import IUnitOfWork


class RefreshTokenService:
    """Encapsulates refresh token DB writes; callers own commit."""

    def __init__(self, uow: IUnitOfWork, token_settings: TokenSettings):
        self._uow = uow
        self._token_settings = token_settings

    def _make_expires_at(self) -> datetime:
        return datetime.now(timezone.utc) + timedelta(
            days=self._token_settings.refresh_token_expire_days
        )

    async def create_family_record(self, user_id: int, refresh_token: str) -> None:
        """Insert the root record of a new token family."""
        await self._uow.refresh_token.create_new_record(
            user_id=user_id,
            token_hash=get_token_hash(refresh_token),
            family_id=uuid4(),
            expires_at=self._make_expires_at(),
        )

    async def append_family_record(self, token_record, new_refresh_token: str) -> None:
        """Insert the next record in an existing token family (rotation step)."""
        await self._uow.refresh_token.create_new_record(
            user_id=token_record.user_id,
            token_hash=get_token_hash(new_refresh_token),
            family_id=token_record.family_id,
            expires_at=self._make_expires_at(),
        )
