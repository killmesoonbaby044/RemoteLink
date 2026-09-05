"""WebSocket endpoint that runs a stored script interactively over a
PTY and relays it with the browser -- the same model as /ws/ssh, so
prompts, typed input, and nested commands (e.g. a script that itself
opens an SSH connection) all work like a normal terminal.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.core.auth.auth_manager import authenticate_websocket
from app.services.sessions.process_session import ProcessSession
from app.services.scripts.script_runner import InvalidScriptError

router = APIRouter()


@router.websocket("/ws/script")
async def script_terminal(websocket: WebSocket) -> None:
    await websocket.accept()
    token = await authenticate_websocket(websocket)
    if token is None:
        return

    session: ProcessSession | None = None

    try:
        raw_name = websocket.query_params.get("name")
        if not raw_name:
            await _send_error(websocket, "Script name is required")
            return

        # history.html packs "<path>|<arg>" into a single `name` value so a
        # history entry can carry the parameter a nested script was
        # originally run with (e.g. "pc\\cmd|PCADMIN"). A plain top-level
        # name like "PC" has no "|" and arg comes back empty.
        script_path, _, arg = raw_name.partition("|")
        if "ps" in script_path:
            name = script_path + ".ps1"
        else:
            name = script_path + ".cmd"
        if arg is not None:
            match = re.search(r"\[(.*)]", arg)
            if match:
                arg = match.group(1)

        session = ProcessSession(websocket, name, arg or None)
        await session.run()

    except InvalidScriptError as exc:
        await _send_error(websocket, str(exc))

    except WebSocketDisconnect:
        pass

    except Exception as exc:
        print(f"Script error: {exc!r}")
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
