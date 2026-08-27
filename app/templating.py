"""Shared Jinja2Templates instance, so every router renders from the
same template environment/config."""

from fastapi.templating import Jinja2Templates

from app.config import TEMPLATES_DIR

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
