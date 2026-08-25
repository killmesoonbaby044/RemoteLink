"""Runs a local script inside a pseudo-terminal (PTY) and bridges it
with a browser WebSocket -- the same interactive model as SSHSession,
just for a local subprocess instead of a remote SSH connection.

A PTY (not a plain pipe) is used because scripts here are interactive:
one prompts for a search term, reads what you type, and branches into
another script based on it; another opens its own nested SSH
connection, which needs a real controlling terminal (for a password
prompt or host-key check). Plain pipes make most CLI tools drop into
non-interactive/buffered mode, which breaks all of that.

Cross-platform: developed on macOS, deployed on Windows. Both sides
get a real PTY, just from two different libraries that happen to
share almost the same API:
  - POSIX (macOS/Linux): `ptyprocess`  (pip install ptyprocess)
  - Windows:              `pywinpty`    (pip install pywinpty)

Both expose PtyProcess.spawn(argv, cwd=, dimensions=(rows, cols)) plus
.read() / .write() / .isalive() / .terminate() / .wait(), so this
class doesn't need an if/else per platform -- just the import, and one
spot where POSIX wants bytes and Windows wants str.
"""

from __future__ import annotations

import asyncio
import logging
import re
import sys
from pathlib import Path

from fastapi import WebSocket

from app.services.io_relay import relay
from app.services.script_runner import build_command, resolve_script_path

IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    from winpty import PtyProcess  # pywinpty -- wraps ConPTY
else:
    from ptyprocess import PtyProcess  # wraps pty.fork()

# Matches the Terminal({ rows, cols }) xterm.js is created with in app.js,
# so line-wrapping and cursor-addressed output line up correctly.
_ROWS, _COLS = 30, 120
_RUNNING_LINE = re.compile(r'^Running:\s+"([^"]+)"\s*(.*)$')


class ProcessSession:
    """Bridges a local script's PTY stdio with a browser WebSocket."""

    def __init__(self, websocket: WebSocket, name: str):
        self.websocket = websocket
        self.name = name
        self.pty: PtyProcess | None = None

    async def run(self) -> None:
        path = resolve_script_path(self.name)
        command = build_command(path)

        await self._send_status(f"Starting {self.name}...")

        loop = asyncio.get_running_loop()

        # spawn() does the fork/exec (or CreateProcess on Windows) --
        # off the event loop just in case it's slow to come up.
        self.pty = await loop.run_in_executor(
            None,
            lambda: PtyProcess.spawn(
                command, cwd=str(path.parent), dimensions=(_ROWS, _COLS)
            ),
        )

        await relay(self._read_process_output(), self._read_browser_input())

        returncode = await loop.run_in_executor(None, self.pty.wait)
        await self._send_status(f"'{self.name}' exited with code {returncode}")

    async def close(self) -> None:
        if not self.pty:
            return

        try:
            if self.pty.isalive():
                self.pty.terminate(force=True)
        except Exception:
            pass

        try:
            self.pty.close()
        except Exception:
            pass

    async def _read_process_output(self) -> None:
        loop = asyncio.get_running_loop()

        while True:
            data = await loop.run_in_executor(None, self._blocking_read)

            if data is None:
                break

            # --- START INTERCEPTION LOGIC ---
            text_data = data.decode("utf-8", errors="replace")

            # Check for the specific running status pattern using _RUNNING_LINE
            match = _RUNNING_LINE.search(text_data)
            if match:
                script_path = match.group(1)
                pc_name = match.group(2).strip()
                # Send a JSON payload that the frontend JS listens for
                logging.log(20, f"{script_path} {pc_name}")
                await self.websocket.send_json(
                    {
                        "type": "script_status_update",
                        "path": script_path,
                        "name": pc_name,
                    }
                )

            await self.websocket.send_bytes(data)

    def _blocking_read(self) -> bytes | None:
        try:
            data = self.pty.read(4096)
        except (EOFError, OSError):
            # Raised once the child exits and the pty side is gone.
            return None

        if not data:
            return None

        # POSIX (ptyprocess) hands back bytes already; Windows
        # (pywinpty) hands back str -- normalize to bytes either way,
        # since that's what websocket.send_bytes() expects.
        return data.encode("utf-8", errors="replace") if isinstance(data, str) else data

    async def _read_browser_input(self) -> None:
        while True:
            data = await self.websocket.receive_text()

            try:
                self.pty.write(data if IS_WINDOWS else data.encode("utf-8"))
            except (EOFError, OSError):
                break

    async def _send_status(self, message: str) -> None:
        await self.websocket.send_json({"type": "status", "message": message})
