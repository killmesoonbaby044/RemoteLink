from __future__ import annotations

from fastapi import APIRouter, Depends
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse

from app.config import templates
from app.core.auth.auth_manager import validate_user

router = APIRouter(
    prefix="/network",
    tags=["Network Pages"],
    dependencies=[Depends(validate_user)],
)


@router.get("", response_class=HTMLResponse)
async def network(request: Request):
    """Entry point of the network area: the inventory, plus SSH, lookup
    and interface config started from its rows."""

    return templates.TemplateResponse(
        request=request, name="pages/network/network.html"
    )


@router.get("/lookup", response_class=HTMLResponse)
async def network_lookup(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="pages/network/lookup.html",
    )


@router.get("/interface", response_class=HTMLResponse)
async def network_interface(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="pages/network/interface.html",
    )


# -- /switch: the connect page, and redirects from the old page URLs ----------

legacy_router = APIRouter(
    prefix="/switch",
    tags=["Network Pages"],
    dependencies=[Depends(validate_user)],
)


@legacy_router.get("/connect", response_class=HTMLResponse)
async def switch_connect(request: Request):
    """SSH sessions for unix and switch."""

    return templates.TemplateResponse(
        request=request,
        name="pages/network/connect.html",
    )


def _moved(target: str):
    async def redirect(request: Request) -> RedirectResponse:
        query = request.url.query
        return RedirectResponse(f"{target}?{query}" if query else target)

    return redirect


for _old, _new in {
    "": "/network",
    "/inventory": "/network",
    "/lookup": "/network/lookup",
    "/interface": "/network/interface",
}.items():
    legacy_router.add_api_route(
        _old, _moved(_new), methods=["GET"], include_in_schema=False
    )
