from loguru import logger
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth.exception import AuthenticationError, UserDisabledError


async def authentication_error_handler(
    request: Request, _exc: AuthenticationError
) -> JSONResponse:
    if not getattr(request.state, "is_not_refresh_leader", False):
        logger.info(
            f"Auth failure from {request.headers.get('X-Real-IP') or request.client.host} "
            f"- {request.headers.get('user-agent')}"
        )
    return JSONResponse(status_code=401, content={"detail": "Unauthorized"})


async def user_disabled_handler(
    request: Request, _exc: UserDisabledError
) -> JSONResponse:
    logger.info(f"Disabled user attempted login from {request.client.host}")
    return JSONResponse(status_code=403, content={"detail": "Account disabled"})


exception_handlers = {
    AuthenticationError: authentication_error_handler,
    UserDisabledError: user_disabled_handler,
}
