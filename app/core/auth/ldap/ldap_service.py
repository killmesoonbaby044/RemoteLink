from ldap3.core.exceptions import LDAPInvalidCredentialsResult
from loguru import logger

from app.core.auth.ldap.exceptions import LdapAuthError
from app.core.auth.ldap.ldap_repo import LdapRepository
from app.core.auth.ldap.ldap_schemas import LdapUserData, LdapUserBasic
from app.core.auth.ldap.mapper import LdapEntryMapper


class LdapService:
    def __init__(self, ldap_repo: LdapRepository):
        self._repo = ldap_repo
        self._mapper = LdapEntryMapper()

    async def get_allowed_users(self) -> list[LdapUserData]:
        allowed_users_entries = await self._repo.get_users_from_allowed_group()
        if not allowed_users_entries:
            logger.debug("Failure in retrieving users from LDAP")
            return []
        allowed_group = self._repo.get_allowed_group()
        return self._mapper.map_many(
            allowed_group=allowed_group, entries=allowed_users_entries
        )

    async def get_authenticated_user(
        self, username: str, password: str
    ) -> LdapUserBasic:
        ldap_user = await self._get_ldap_user(username)
        if not ldap_user:
            logger.info("Reason: user does not exist")
            raise LdapAuthError()
        try:
            await self._repo.authenticate(ldap_user.dn, password)
        except LDAPInvalidCredentialsResult:
            logger.info(f"Reason: {ldap_user.failure_reason}")
            raise LdapAuthError()

        return self.auth_user_validation(ldap_user)

    async def _get_ldap_user(self, username: str) -> LdapUserData | None:
        ldap_user_entry = await self._repo.get_user(username)
        if not ldap_user_entry:
            return None
        allowed_group = self._repo.get_allowed_group()

        return self._mapper.map_one(allowed_group=allowed_group, entry=ldap_user_entry)

    @staticmethod
    def auth_user_validation(ldap_user: LdapUserData) -> LdapUserBasic:
        if not ldap_user:
            raise LdapAuthError()
        elif ldap_user.not_in_allowed_group:
            logger.info("Reason: Group assignments")
            raise LdapAuthError()

        return LdapUserBasic(
            username=ldap_user.username,
            name=ldap_user.name,
            member_of=ldap_user.member_of,
        )
