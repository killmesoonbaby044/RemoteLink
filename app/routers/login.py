from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel
from starlette.requests import Request
from starlette.responses import Response

from app.core.client.http import HttpClient
from app.settings import get_config

router = APIRouter()


class Login(BaseModel):
    username: str
    password: str


@router.post("/auth")
async def login(
    request: Request,
    response: Response,
    login_user: Login,
):
    logger.info(
        f" From {request.client.host} trying to login with login {login_user.username!r} -> via LDAP"
    )
    client = HttpClient(get_config().AUTH_API)
    response = await client.post("/", json=login_user.dict())
    # tokens = await auth_service.login_ldap(login_user=login_user)
    #
    # set_auth_cookies(response, tokens)
    # logger.info(
    #     f"User {login_user.username!r} -> {request.client.host} logged in via LDAP"
    # )

    return {"message": [response.json(), response.status_code]}
