from fastapi.exceptions import RequestValidationError
from loguru import logger
from starlette.requests import Request
from starlette.responses import JSONResponse, HTMLResponse

from app.core.auth.exception import AuthenticationError, UserDisabledError
from app.services.domain.exceptions import InvalidScriptError
from app.services.switch.inventory.inventory_errors import (
    InventoryError,
    NotFoundError,
    ConflictError,
)


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


async def inventory_error_handler(
    request: Request, exc: InventoryError
) -> JSONResponse:
    logger.error(f"Inventory error: {exc}")
    if isinstance(exc, NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})
    if isinstance(exc, ConflictError):
        return JSONResponse(status_code=409, content={"detail": str(exc)})
    return JSONResponse(
        status_code=400, content={"detail": str(exc)}
    )  # ValidationError etc.


async def script_error_handler(
    request: Request, exc: InvalidScriptError
) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    errors = []

    for error in exc.errors():
        location = " → ".join(str(x) for x in error["loc"])
        message = error["msg"]
        errors.append(f"{location}: {message}")

    text = "\n".join(errors)

    return HTMLResponse(
        f"""
        <!DOCTYPE html>
        <html>
        <body>
            <script>
                alert({text!r});
                window.history.back();
            </script>
        </body>
        </html>
        """,
        status_code=422,
    )


exception_handlers = {
    AuthenticationError: authentication_error_handler,
    UserDisabledError: user_disabled_handler,
    InventoryError: inventory_error_handler,
    InvalidScriptError: script_error_handler,
    RequestValidationError: validation_exception_handler,
}
