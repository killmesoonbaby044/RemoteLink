from __future__ import annotations

from fastapi import APIRouter, Depends
from starlette.requests import Request
from starlette.responses import HTMLResponse

from app.config import templates
from app.core.auth.auth_manager import validate_user

router = APIRouter(
    prefix="/switch",
    tags=["Switch Pages"],
    dependencies=[Depends(validate_user)],
)


@router.get("", response_class=HTMLResponse)
async def network_hub(request: Request):
    """Network hub: links to connect, MAC lookup and interface config."""

    return templates.TemplateResponse(
        request=request,
        name="pages/switch/network_hub.html",
    )


@router.get("/connect", response_class=HTMLResponse)
async def switch_connect(request: Request):
    """SSH sessions for unix and switch."""

    return templates.TemplateResponse(
        request=request,
        name="pages/switch/switch_connect.html",
    )


@router.get("/lookup", response_class=HTMLResponse)
async def switch_lookup(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="pages/switch/switch_lookup.html",
    )


@router.get("/interface", response_class=HTMLResponse)
async def switch_interface(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="pages/switch/switch_interface.html",
    )


@router.get("/inventory", response_class=HTMLResponse)
async def switch_inventory(request: Request):
    return templates.TemplateResponse(
        request=request, name="pages/switch/switch_inventory.html"
    )
