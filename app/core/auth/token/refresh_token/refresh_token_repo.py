from datetime import datetime
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.token.refresh_token.refresh_tokens_model import RefreshTokens
from app.domains.base import BaseRepository


class RefreshTokenRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        super().__init__(session=session, model=RefreshTokens)

    async def get_refresh_token(self, token_hash):
        return await self.get_filter_row(token_hash=token_hash)

    async def kill_family(self, family_id: int):
        await self.session.execute(
            delete(self.model).where(self.model.family_id == family_id)
        )

    async def create_new_record(
        self, user_id: int, token_hash: str, family_id: UUID, expires_at: datetime
    ):
        self.add_entity(
            user_id=user_id,
            token_hash=token_hash,
            family_id=family_id,
            expires_at=expires_at,
        )

    async def get_refresh_token_family(self, token_hash):
        return (await self.get_filter_rows(token_hash=token_hash)).all()
