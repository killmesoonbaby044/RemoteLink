"""HTML page routes -- everything rendered via Jinja2 templates."""

from __future__ import annotations

from fastapi import Request, APIRouter
from fastapi.responses import HTMLResponse

from app.services.scripts.script_runner import list_scripts
from app.templating import templates

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):

    return templates.TemplateResponse(
        request=request,
        name="pages/index.html",
        context={"scripts": list_scripts()},
    )
    # return templates.TemplateResponse(request=request, name="index.html")


@router.get("/credentials", response_class=HTMLResponse)
async def credentials_page(request: Request):
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
    request: Request, host: str | None = None, script: str | None = None
):
    """Shared xterm.js page for both SSH sessions and script runs."""

    return templates.TemplateResponse(
        request=request,
        name="pages/terminal.html",
        context={"host": host, "script": script},
    )
