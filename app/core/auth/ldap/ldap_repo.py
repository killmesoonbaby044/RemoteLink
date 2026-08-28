import asyncio
from typing import Optional
from fastapi.concurrency import run_in_threadpool
from ldap3 import Entry, SUBTREE
from ldap3.utils.conv import escape_filter_chars

from app.core.ldap import LdapClient
from app.core.settings import LdapSchemaSettings


class LdapRepository:
    def __init__(self, client: LdapClient, settings: LdapSchemaSettings):
        self._client = client
        self.settings = settings

    def _search_sync(self, ldap_filter: str, attributes: list[str]):
        with self._client.service_connection() as conn:
            conn.search(
                search_base=self.settings.base_dn,
                search_filter=ldap_filter,
                search_scope=SUBTREE,
                attributes=attributes,
            )
            return conn.entries

    def _authenticate(self, user_dn: str, password: str) -> None:
        with self._client.connection(user_dn, password):
            pass

    # add to wait_for
    # try:
    #     return await asyncio.wait_for(...)
    # except asyncio.TimeoutError:
    #     raise LdapTimeoutError(...)
    # except LDAPException:
    #     raise LdapConnectionError(...)

    # Guards the async caller; thread may run until receive_timeout (3s) elapses naturally.
    async def search(self, ldap_filter: str, attributes: list[str]):
        return await asyncio.wait_for(
            run_in_threadpool(self._search_sync, ldap_filter, attributes), timeout=5
        )

    async def authenticate(self, user_dn: str, password: str) -> None:
        return await asyncio.wait_for(
            run_in_threadpool(self._authenticate, user_dn, password), timeout=5
        )

    async def get_user(self, username: str) -> Optional[Entry]:
        safe_username = escape_filter_chars(username)

        users = await self.search(
            ldap_filter=f"(sAMAccountName={safe_username})",
            attributes=[
                "cn",
                "memberOf",
                "name",
                "sAMAccountName",
                "userAccountControl",
                "lockoutTime",
                "pwdLastSet",
            ],
        )
        return users[0] if users else None

    async def get_users_from_allowed_group(self):
        safe_allowed_group = escape_filter_chars(self.settings.allowed_group)

        allowed_users = await self.search(
            ldap_filter=f"(memberOf={safe_allowed_group})",
            attributes=[
                "sAMAccountName",
                "name",
                "memberOf",
                "userAccountControl",
                "lockoutTime",
                "pwdLastSet",
            ],
        )
        return allowed_users

    def get_allowed_group(self) -> str:
        return self.settings.allowed_group
