from __future__ import annotations

from fastapi import APIRouter, Depends
from starlette.requests import Request
from starlette.responses import HTMLResponse

from app.config import templates
from app.core.auth.auth_manager import validate_user
from app.services.domain.script_helpers import list_scoped_scripts

router = APIRouter(
    prefix="/domain",
    tags=["Domain Pages"],
    dependencies=[Depends(validate_user)],
)


@router.get("", response_class=HTMLResponse)
async def domain_search(request: Request):

    return templates.TemplateResponse(
        request=request,
        name="pages/domain/domain.html",
        context={
            "pc_scripts": list_scoped_scripts("pc"),
            "user_scripts": list_scoped_scripts("user"),
            "pc_search_script": "search_pcs",
            "user_search_script": "search_users",
        },
    )


@router.get("/add_user", response_class=HTMLResponse)
async def domain_add_user(request: Request):

    return templates.TemplateResponse(
        request=request,
        name="pages/domain/domain_add_user.html",
    )


@router.get("/inventory", response_class=HTMLResponse)
async def domain_schema(request: Request):
    return templates.TemplateResponse(
        request=request, name="pages/domain/domain_schema.html"
    )
