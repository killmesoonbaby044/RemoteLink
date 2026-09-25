"""WebSocket endpoint that runs a stored script interactively over a
PTY and relays it with the browser -- the same model as /ws/ssh, so
prompts, typed input, and nested commands (e.g. a script that itself
opens an SSH connection) all work like a normal terminal.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, WebSocket
from fastapi.params import Query
from loguru import logger
from starlette.websockets import WebSocketDisconnect

from app.core.auth.auth_manager import authenticate_websocket
from app.services.domain.exceptions import InvalidScriptError
from app.services.domain.schema import ScriptQueryParams
from app.services.sessions.process_session import ProcessSession

router = APIRouter()


@router.websocket("/ws/script")
async def script_terminal(
    websocket: WebSocket,
    request_params: Annotated[ScriptQueryParams, Query()],
) -> None:
    await websocket.accept()
    await authenticate_websocket(websocket)

    session: ProcessSession | None = None

    try:
        session = ProcessSession(websocket, request_params)
        await session.run()

    except InvalidScriptError as exc:
        await _send_error(websocket, str(exc))

    except WebSocketDisconnect:
        pass

    except Exception as exc:
        logger.warning(f"Script error: {exc!r}")
        await _send_error(websocket, str(exc))

    finally:
        if session:
            await session.close()

        try:
            await websocket.close()
        except Exception:
            pass


async def _send_error(websocket: WebSocket, message: str) -> None:
    try:
        await websocket.send_json({"type": "error", "message": message})
    except Exception:
        pass
