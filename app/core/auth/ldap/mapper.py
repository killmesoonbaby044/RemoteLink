from ldap3 import Entry

from app.core.auth.ldap.ldap_schemas import ACCOUNTDISABLE, LdapUserData


class LdapEntryMapper:
    def map_one(self, allowed_group: str, entry: Entry) -> LdapUserData:
        member_of = self._get_member_of(entry)
        return LdapUserData(
            dn=entry.entry_dn,
            username=self._get_username(entry),
            name=self._get_name(entry),
            is_active=self._is_active(entry),
            is_password_expired=self._is_password_expired(entry),
            member_of=member_of,
            not_in_allowed_group=allowed_group not in member_of,
        )

    def map_many(self, allowed_group: str, entries: list[Entry]) -> list[LdapUserData]:
        return [self.map_one(allowed_group, entry) for entry in entries]

    @staticmethod
    def _get_username(entry: Entry) -> str | None:
        attr = getattr(entry, "sAMAccountName", None)
        return attr.value if attr else None

    @staticmethod
    def _get_name(entry: Entry) -> str | None:
        attr = getattr(entry, "name", None)
        return attr.value if attr else None

    @staticmethod
    def _is_active(entry: Entry) -> bool:
        attr = getattr(entry, "userAccountControl", None)
        if not attr or not attr.value:
            return False
        return not bool(int(attr.value) & ACCOUNTDISABLE)

    @staticmethod
    def _is_password_expired(entry: Entry) -> bool:
        attr = getattr(entry, "pwdLastSet", None)
        if not attr or not attr.raw_values:
            return False
        return attr.raw_values[0] == b"0"

    @staticmethod
    def _get_member_of(entry: Entry) -> list[str]:
        attr = getattr(entry, "memberOf", None)
        return list(attr) if attr else []
