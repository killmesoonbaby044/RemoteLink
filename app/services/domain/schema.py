from typing import Optional

from pydantic import BaseModel


class ScriptQueryParams(BaseModel):
    folder: str
    script: str
    input_data: Optional[str] = None
