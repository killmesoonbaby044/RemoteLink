from pydantic import BaseModel

ACCOUNTDISABLE = 0x0002


class LdapConfig(BaseModel):
    BASE_DN: str
    ALLOWED_GROUP: str


class LdapUserBasic(BaseModel):
    username: str
    name: str | None
    member_of: list[str]


class LdapUserData(BaseModel):
    dn: str
    username: str
    name: str | None
    is_active: bool
    is_password_expired: bool
    member_of: list[str]
    not_in_allowed_group: bool

    @property
    def failure_reason(self) -> str | None:
        if self.is_active is False:
            return "User Disabled"
        if self.is_password_expired:
            return "Expired password"

        return "Credential failure"
