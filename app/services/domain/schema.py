from typing import Optional

from pydantic import BaseModel


class ScriptQueryParams(BaseModel):
    folder: str
    script: str
    args: Optional[str] = None


class ScriptAddUser(BaseModel):
    full_name: str
    username: str
    org_unit_dn: str
