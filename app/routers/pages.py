"""HTML page routes -- everything rendered via Jinja2 templates."""

from __future__ import annotations

from typing import Annotated

from fastapi import Request, APIRouter, Depends
from fastapi.params import Query
from fastapi.responses import HTMLResponse

from app.config import templates
from app.core.auth.auth_manager import validate_user
from app.services.domain.schema import ScriptQueryParams
from app.services.domain.script_helpers import list_scoped_scripts
from app.services.switch.schemas import SSHScriptQueryParams

router = APIRouter(dependencies=[Depends(validate_user)])


@router.get("/", response_class=HTMLResponse)
async def domain_search(request: Request):

    return templates.TemplateResponse(
        request=request,
        name="pages/index.html",
        context={
            "pc_scripts": list_scoped_scripts("pc"),
            "user_scripts": list_scoped_scripts("user"),
            "pc_search_script": "search_pcs",
            "user_search_script": "search_users",
        },
    )


@router.get("/switches", response_class=HTMLResponse)
async def switches(request: Request):
    """SSH sessions for unix and switch."""

    return templates.TemplateResponse(
        request=request,
        name="pages/switches.html",
    )


@router.get("/credentials", response_class=HTMLResponse)
async def credentials_page(request: Request):
    return templates.TemplateResponse(request=request, name="pages/credentials.html")


@router.get("/terminal", response_class=HTMLResponse)
async def terminal_page(
    request: Request,
    request_params: Annotated[ScriptQueryParams, Query()],
):
    """Shared xterm.js page for both SSH sessions and script runs."""
    return templates.TemplateResponse(
        request=request,
        name="pages/terminal.html",
        context={
            "folder": request_params.folder,
            "script": request_params.script,
            "args": request_params.args,
        },
    )


@router.get("/ssh_terminal", response_class=HTMLResponse)
async def terminal_page(
    request: Request,
    request_params: Annotated[SSHScriptQueryParams, Query()],
):
    """Shared xterm.js page for both SSH sessions and script runs."""
    return templates.TemplateResponse(
        request=request,
        name="pages/terminal.html",
        context={"args": request_params.host},
    )


@router.get("/switch_inventory", response_class=HTMLResponse)
async def switch_inventory(request: Request):
    return templates.TemplateResponse(
        request=request, name="pages/switch_inventory.html"
    )


@router.get("/domain_schema", response_class=HTMLResponse)
async def domain_schema(request: Request):
    return templates.TemplateResponse(request=request, name="pages/domain_schema.html")
