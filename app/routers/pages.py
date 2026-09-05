"""HTML page routes -- everything rendered via Jinja2 templates."""

from __future__ import annotations

from typing import Annotated

from fastapi import Request, APIRouter, Depends
from fastapi.responses import HTMLResponse

from app.config import AccessToken
from app.core.auth.auth_manager import validate_user
from app.services.scripts.script_runner import list_scoped_scripts
from app.templating import templates

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    _: Annotated[AccessToken, Depends(validate_user)],
):

    return templates.TemplateResponse(
        request=request,
        name="pages/index.html",
        context={
            "pc_scripts": list_scoped_scripts("pc"),
            "user_scripts": list_scoped_scripts("user"),
            "pc_search_script": "root\\search_pcs",
            "user_search_script": "root\\search_users",
        },
    )


@router.get("/connect", response_class=HTMLResponse)
async def connect_page(
    request: Request,
    _: Annotated[AccessToken, Depends(validate_user)],
):
    """SSH sessions for unix and switch."""

    return templates.TemplateResponse(
        request=request,
        name="pages/connect.html",
    )


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """login"""

    return templates.TemplateResponse(
        request=request,
        name="pages/login.html",
    )


@router.get("/credentials", response_class=HTMLResponse)
async def credentials_page(
    request: Request,
    _: Annotated[AccessToken, Depends(validate_user)],
):
    return templates.TemplateResponse(request=request, name="pages/credentials.html")


# @router.get("/scripts", response_class=HTMLResponse)
# async def scripts_page(request: Request):
#     """Lists the script files available in SCRIPTS_DIR to run."""
#
#     return templates.TemplateResponse(
#         request=request,
#         name="scripts.html",
#         context={"scripts": list_scripts()},
#     )


@router.get("/terminal", response_class=HTMLResponse)
async def terminal_page(
    request: Request,
    _: Annotated[AccessToken, Depends(validate_user)],
    host: str | None = None,
    script: str | None = None,
):
    """Shared xterm.js page for both SSH sessions and script runs."""

    return templates.TemplateResponse(
        request=request,
        name="pages/terminal.html",
        context={"host": host, "script": script},
    )
