from typing import Optional
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.utils import get_authorization_scheme_param
from starlette.requests import Request
from starlette.responses import Response

from app.core.auth.auth_schemas import TokensNames, ExposeCookieName


class OAuth2PasswordBearerCookie(OAuth2PasswordBearer):
    def __call__(self, request: Request) -> Optional[str]:
        auth_header = request.headers.get("Authorization")
        scheme, param = get_authorization_scheme_param(auth_header)
        if scheme and scheme.lower() == "bearer" and param:
            return param

        token = get_cookie_token(request, TokensNames.access_token)
        return token


def get_cookie_token(request: Request, token_type: TokensNames) -> Optional[str]:
    param = request.cookies.get(token_type, None)
    return param
    # scheme, param = get_authorization_scheme_param(cookie)
    # if scheme and scheme.lower() == "bearer" and param:
    # return param
    # return None


def set_auth_cookies(response: Response, tokens) -> Response:
    response.set_cookie(
        TokensNames.access_token,
        f"{tokens.access_token}",
        # f"Bearer {tokens.access_token}",
        httponly=True,
        max_age=900,
        # domain="127.0.0.1",
        # secure=True,
        # samesite="none",
    )
    response.set_cookie(
        TokensNames.refresh_token,
        f"{tokens.refresh_token}",
        # f"Bearer {tokens.refresh_token}",
        httponly=True,
        max_age=604800,
        # domain="127.0.0.1",
        # secure=True,
        # samesite="none",
    )
    return response


def set_auth_cookies_v2(response: Response, tokens) -> Response:
    response.set_cookie(
        TokensNames.access_token,
        f"{tokens.access_token}",
        # f"Bearer {tokens.access_token}",
        httponly=True,
        max_age=900,
        # domain="127.0.0.1",
        # secure=True,
        # samesite="none",
    )
    response.set_cookie(
        TokensNames.refresh_token_v2,
        f"{tokens.refresh_token}",
        # f"Bearer {tokens.refresh_token}",
        httponly=True,
        max_age=604800,
        # domain="127.0.0.1",
        path="/login/refresh",
        # secure=True,
        # samesite="none",
    )
    return response


def set_expose_cookies(response: Response, objects: str) -> Response:
    response.set_cookie(
        ExposeCookieName.expose,
        objects,
        max_age=900,
        # domain="127.0.0.1",
        secure=True,
        samesite="none",
    )
    return response


def delete_cookies(response: Response) -> Response:
    response.delete_cookie(TokensNames.access_token)
    response.delete_cookie(TokensNames.refresh_token)
    response.delete_cookie(TokensNames.refresh_token_v2)
    response.delete_cookie(ExposeCookieName.expose)
    return response
