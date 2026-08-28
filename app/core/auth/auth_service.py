from loguru import logger

from app.core.auth.exception import UserDisabledError, InvalidCredentialsError
from app.core.auth.token.refresh_token.refresh_token_service import RefreshTokenService
from app.domains.base import IUnitOfWork
from app.domains.users import UserService
from app.core.auth.token import JWTService
from app.core.auth.ldap import LdapService, LdapUserBasic
from app.core.auth.auth_schemas import Login, BearerTokens
from app.core.auth.crypto import verify_password


class AuthService:
    """Orchestrates credential validation across local and LDAP login strategies.
    For V2 flows, persists the initial opaque refresh token record
    that anchors a token family in the DB."""

    def __init__(
        self,
        uow: IUnitOfWork,
        ldap_service: LdapService,
        user_service: UserService,
        jwt_service: JWTService,
        refresh_token_service: RefreshTokenService,
    ):
        self._uow = uow
        self.ldap_service = ldap_service
        self.user_service = user_service
        self.jwt_service = jwt_service
        self.refresh_token_service = refresh_token_service

    async def login_local(self, data: Login) -> BearerTokens:
        user = await self.user_service.get_local_user(username=data.username)
        if (
            not user
            or not verify_password(data.password, user.password)
            or not user.status
        ):
            raise InvalidCredentialsError()
        return self.jwt_service.create_tokens_by_user(user=user)

    async def login_local_v2(self, data: Login) -> BearerTokens:
        user = await self.user_service.get_local_user(username=data.username)
        if (
            not user
            or not verify_password(data.password, user.password)
            or not user.status
        ):
            raise InvalidCredentialsError()
        tokens = self.jwt_service.create_tokens_by_user_v2(user=user)
        await self.refresh_token_service.create_family_record(
            user.id, tokens.refresh_token
        )
        await self._uow.commit()
        return tokens

    async def login_ldap(self, login_user: Login) -> BearerTokens:
        ldap_user: LdapUserBasic = await self.ldap_service.get_authenticated_user(
            username=login_user.username, password=login_user.password
        )
        user = await self.user_service.get_or_create_ldap_user(ldap_user)
        if not user.status:
            logger.info(f"{ldap_user.username} LDAP user is disabled")
            raise UserDisabledError()

        tokens = self.jwt_service.create_tokens_by_user(user=user)
        return tokens
