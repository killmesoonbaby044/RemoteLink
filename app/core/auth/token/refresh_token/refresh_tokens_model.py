from uuid import UUID

from sqlalchemy import false, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.infrastructure import Base


class RefreshTokens(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[Base.intpk]
    user_id: Mapped[int]
    token_hash: Mapped[str]
    family_id: Mapped[UUID] = mapped_column(Uuid)
    revoked: Mapped[bool] = mapped_column(server_default=false())
    created_at: Mapped[Base.created_time]
    expires_at: Mapped[Base.TimestampTZ]
