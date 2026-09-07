import httpx
from fastapi import APIRouter, HTTPException
from loguru import logger
from starlette.requests import Request
from starlette.responses import Response

from app.config import token_name
from app.core.schemas import Login
from app.settings import get_config

router = APIRouter()


@router.post("/auth")
async def login(
    request: Request,
    response: Response,
    login_user: Login,
):
    config = get_config()
    logger.info(
        f" From {request.client.host!r} trying to login with login {login_user.username!r} -> via LDAP"
    )

    resp: httpx.Response = await request.app.state.http_client.post(
        "/login",
        json={
            **login_user.model_dump(mode="json"),
            "instance_id": request.app.state.INSTANCE_ID,
        },
    )

    if resp.status_code >= 400:

        content_type = resp.headers.get("content-type", "")

        if content_type.startswith("application/json"):
            detail = resp.json().get("detail")
        else:
            detail = resp.text

        raise HTTPException(
            status_code=resp.status_code,
            detail=detail,
        )

    token = resp.json()["access_token"]
    response.set_cookie(
        token_name.access_token,
        token,
        httponly=True,
        samesite="strict",
        max_age=config.jwt_expires,
    )
    logger.info(f"User {login_user.username!r} -> {request.client.host!r} logged in")

    return {"message": "ok"}
