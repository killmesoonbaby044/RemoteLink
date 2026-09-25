from __future__ import annotations

from typing import Annotated

from fastapi import Request, APIRouter, Depends
from fastapi.params import Query
from fastapi.responses import HTMLResponse

from app.config import templates
from app.core.auth.auth_manager import validate_user
from app.services.domain.schema import ScriptQueryParams
from app.services.switch.schemas import SSHScriptQueryParams

router = APIRouter(tags=["Common HTML Pages"], dependencies=[Depends(validate_user)])


@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="pages/home.html")


@router.get("/inventory_hub", response_class=HTMLResponse)
async def inventory(request: Request):
    return templates.TemplateResponse(request=request, name="pages/inventory_hub.html")


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
