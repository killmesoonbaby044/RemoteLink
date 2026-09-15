"""HTML page routes -- everything rendered via Jinja2 templates."""

from __future__ import annotations


from fastapi import Request, APIRouter, Depends
from fastapi.responses import HTMLResponse

from app.config import templates
from app.core.auth.auth_manager import validate_user
from app.services.sessions.script_helpers import list_scoped_scripts

router = APIRouter(dependencies=[Depends(validate_user)])


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):

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


@router.get("/switches", response_class=HTMLResponse)
async def connect_page(request: Request):
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
    host: str | None = None,
    script: str | None = None,
):
    """Shared xterm.js page for both SSH sessions and script runs."""

    return templates.TemplateResponse(
        request=request,
        name="pages/terminal.html",
        context={"host": host, "script": script},
    )


@router.get("/switch_inventory", response_class=HTMLResponse)
async def switch_inventory(request: Request):
    return templates.TemplateResponse(
        request=request, name="pages/switch_inventory.html"
    )


@router.get("/domain_schema", response_class=HTMLResponse)
async def domain_schema(request: Request):
    return templates.TemplateResponse(
        request=request, name="pages/domain_schema.html"
    )
