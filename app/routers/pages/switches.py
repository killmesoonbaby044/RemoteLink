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
async def switches(request: Request):
    """SSH sessions for unix and switch."""

    return templates.TemplateResponse(
        request=request,
        name="pages/switch/switches.html",
    )


@router.get("/inventory", response_class=HTMLResponse)
async def switch_inventory(request: Request):
    return templates.TemplateResponse(
        request=request, name="pages/switch/switch_inventory.html"
    )
