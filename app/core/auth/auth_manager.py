# TODO
# INSTANCE_ID = str(uuid.uuid4())
# class RegisterRequest(BaseModel):
#     instance_id: str
#     username: str
from typing import Optional

from fastapi import HTTPException
from loguru import logger
from starlette.requests import Request
from jose import jwt, JWTError
from starlette.websockets import WebSocket

from app.config import AccessToken, token_name
from app.core.auth.exception import InvalidTokenError
from app.settings import get_config


def validate_user(request: Request) -> Optional[AccessToken]:
    access_token = request.cookies.get(token_name.access_token, None)
    config = get_config()
    """Verify access token or trigger refresh if expired."""
    if access_token:
        try:
            payload = jwt.decode(
                access_token,
                config.jwt_pub_key,
                algorithms=[config.jwt_algorithm],
                audience=config.jwt_audience,
                issuer=config.jwt_issuer,
            )
        except ValueError as e:
            logger.warning(f"Access token ValueError: {e!r}")
            raise InvalidTokenError()
        except JWTError as e:
            logger.error(f"Access token JWTError: {e!r}")
            # raise HTTPException(status_code=401, detail="Invalid or expired token")
            raise InvalidTokenError()
    else:
        logger.error(f"No Jwt token")
        raise InvalidTokenError()

    if payload["instance_id"] != request.app.state.INSTANCE_ID:
        logger.warning("Token not valid for this instance")
        raise HTTPException(status_code=403, detail="Token not valid for this instance")
    if payload["sub"] != request.app.state.USER:
        logger.warning("Token not valid for this user")
        raise HTTPException(status_code=403, detail="Token not from owner of app")
    return AccessToken(**payload)


async def authenticate_websocket(websocket: WebSocket) -> AccessToken | None:
    """Mirrors validate_user's checks, but closes the socket instead of
    raising, since there's no HTTP response to attach an error to here.
    Returns the decoded token on success, None (after closing) on failure."""

    access_token = websocket.cookies.get(token_name.access_token)
    config = get_config()

    if not access_token:
        await websocket.close(code=4401)
        return None

    try:
        payload = jwt.decode(
            access_token,
            config.jwt_pub_key,
            algorithms=[config.jwt_algorithm],
            audience=config.jwt_audience,
            issuer=config.jwt_issuer,
        )
    except (ValueError, JWTError):
        await websocket.close(code=4401)
        return None

    if payload["instance_id"] != websocket.app.state.INSTANCE_ID:
        logger.warning("Token not valid for this instance")
        await websocket.close(code=4403)
        return None

    if payload["sub"] != websocket.app.state.USER:
        logger.warning("Token not valid for this user")
        await websocket.close(code=4403)
        return None

    return AccessToken(**payload)
