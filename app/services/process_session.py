"""Runs a local script inside a pseudo-terminal (PTY) and bridges it
with a browser WebSocket -- the same interactive model as SSHSession,
just for a local subprocess instead of a remote SSH connection.

A PTY (not a plain pipe) is used because scripts here are interactive:
one prompts for a search term, reads what you type, and branches into
another script based on it; another opens its own nested SSH
connection, which needs a real controlling terminal (for a password
prompt or host-key check). Plain pipes make most CLI tools drop into
non-interactive/buffered mode, which breaks all of that.
"""

from __future__ import annotations

import asyncio
import fcntl
import os
import pty
import signal
import struct
import subprocess
import termios
from pathlib import Path

from fastapi import WebSocket

from app.services.io_relay import relay
from app.services.script_runner import build_command, resolve_script_path

# Matches the Terminal({ rows, cols }) xterm.js is created with in app.js,
# so line-wrapping and cursor-addressed output line up correctly.
_ROWS, _COLS = 30, 120


class ProcessSession:
    """Bridges a local script's PTY stdio with a browser WebSocket."""

    def __init__(self, websocket: WebSocket, name: str):
        self.websocket = websocket
        self.name = name
        self.process: subprocess.Popen | None = None
        self.master_fd: int | None = None

    async def run(self) -> None:
        path = resolve_script_path(self.name)
        command = build_command(path)

        await self._send_status(f"Starting {self.name}...")

        self._spawn(command, path.parent)

        await relay(self._read_process_output(), self._read_browser_input())

        returncode = await asyncio.get_running_loop().run_in_executor(
            None, self.process.wait
        )
        await self._send_status(f"'{self.name}' exited with code {returncode}")

    async def close(self) -> None:
        if self.process and self.process.poll() is None:
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass

    def _spawn(self, command: list[str], cwd: Path) -> None:
        master_fd, slave_fd = pty.openpty()
        _set_winsize(slave_fd, _ROWS, _COLS)

        self.process = subprocess.Popen(
            command,
            cwd=cwd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            start_new_session=True,  # slave becomes the child's controlling tty
        )

        os.close(slave_fd)  # parent only needs the master end from here on
        self.master_fd = master_fd

    async def _read_process_output(self) -> None:
        loop = asyncio.get_running_loop()

        while True:
            data = await loop.run_in_executor(None, self._blocking_read)

            if not data:
                break

            await self.websocket.send_bytes(data)

    def _blocking_read(self) -> bytes:
        try:
            return os.read(self.master_fd, 4096)
        except OSError:
            # Raised once the child exits and the slave side is gone.
            return b""

    async def _read_browser_input(self) -> None:
        while True:
            data = await self.websocket.receive_text()

            try:
                os.write(self.master_fd, data.encode("utf-8"))
            except OSError:
                break

    async def _send_status(self, message: str) -> None:
        await self.websocket.send_json({"type": "status", "message": message})


def _set_winsize(fd: int, rows: int, cols: int) -> None:
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
