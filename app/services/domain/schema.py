from typing import Optional

from pydantic import BaseModel


class ScriptQueryParams(BaseModel):
    folder: str
    script: str
    args: Optional[str] = None
