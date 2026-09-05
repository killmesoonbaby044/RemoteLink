"""Central place for filesystem paths and app-wide settings.

Paths are resolved from this file's location rather than the process's
working directory, so `uvicorn main:app` works the same regardless of
where it's launched from.
"""

from pathlib import Path
from uuid import UUID

from pydantic import BaseModel
from starlette.templating import Jinja2Templates

# Project root: one level above this "backend" package.
BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / "frontend" / "static"
TEMPLATES_DIR = BASE_DIR / "frontend" / "templates"


# Where runnable script files live (used by the "run a script" feature).
SCRIPTS_DIR = BASE_DIR / "scripts"
SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

SSH_PORT = 22


class TokenName(BaseModel):
    access_token: str = "access_token"


token_name = TokenName()


class AccessToken(BaseModel):
    sub: str
    exp: int
    iss: str
    aud: str
    instance_id: UUID
