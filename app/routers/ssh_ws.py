"""WebSocket endpoint that proxies an interactive SSH session to xterm.js."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, WebSocket
from fastapi.params import Query
from loguru import logger
from starlette.websockets import WebSocketDisconnect

from app.core.auth.auth_manager import authenticate_websocket
from app.services.sessions.ssh_session import SSHSession
from app.services.switch.schemas import SSHScriptQueryParams

router = APIRouter()


@router.websocket("/ws/ssh")
async def ssh_terminal(
    websocket: WebSocket,
    request_params: Annotated[SSHScriptQueryParams, Query()],
) -> None:
    await websocket.accept()
    token = await authenticate_websocket(websocket)
    if token is None:
        return

    session: SSHSession | None = None

    try:
        auth = await _authenticate(websocket)

        if auth is None:
            return

        username, password = auth

        if not request_params.host:
            await _send_error(websocket, "Host is required")
            return

        session = SSHSession(websocket, request_params.host, username, password)
        await session.run()

    except WebSocketDisconnect:
        pass

    except Exception as exc:
        logger.warning(f"SSH error: {exc!r}")
        await _send_error(websocket, str(exc))

    finally:
        if session:
            await session.close()

        try:
            await websocket.close()
        except Exception:
            pass


async def _authenticate(websocket: WebSocket) -> tuple[str, str] | None:
    """Reads and validates the first (auth) message. None on failure."""

    message = await websocket.receive_json()

    if message.get("type") != "auth":
        await _send_error(websocket, "Authentication required")
        return None

    username = message.get("username")
    password = message.get("password")

    if not username or not password:
        await _send_error(websocket, "Username and password are required")
        return None

    return username, password


async def _send_error(websocket: WebSocket, message: str) -> None:
    try:
        await websocket.send_json({"type": "error", "message": message})
    except Exception:
        pass
