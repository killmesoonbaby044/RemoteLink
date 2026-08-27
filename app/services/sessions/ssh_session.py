"""Encapsulates one interactive SSH session over asyncssh and bridges
its stdio with a browser WebSocket (used by the /ws/ssh endpoint)."""

from __future__ import annotations

import asyncssh
from fastapi import WebSocket

from app.config import SSH_PORT
from app.services.sessions.io_relay import relay


class SSHSession:
    """Connects to a host over SSH and relays IO with a WebSocket."""

    def __init__(self, websocket: WebSocket, host: str, username: str, password: str):
        self.websocket = websocket
        self.host = host
        self.username = username
        self.password = password
        self.conn: asyncssh.SSHClientConnection | None = None
        self.process: asyncssh.SSHClientProcess | None = None

    async def run(self) -> None:
        """Connect, then relay IO both ways until either side closes."""

        await self._connect()
        await relay(self._read_ssh_output(), self._read_browser_input())

    async def close(self) -> None:
        if self.process:
            self.process.stdin.close()

        if self.conn:
            self.conn.close()
            await self.conn.wait_closed()

    async def _connect(self) -> None:
        await self._send_status(f"Connecting to {self.host}...")

        self.conn = await asyncssh.connect(
            host=self.host,
            port=SSH_PORT,
            username=self.username,
            password=self.password,
            known_hosts=None,
        )

        self.process = await self.conn.create_process(
            term_type="xterm",
            encoding=None,
        )

        await self._send_status(f"Connected to {self.host}")

    async def _read_ssh_output(self) -> None:
        while True:
            data = await self.process.stdout.read(4096)

            if not data:
                break

            await self.websocket.send_bytes(data)

    async def _read_browser_input(self) -> None:
        while True:
            data = await self.websocket.receive_text()
            self.process.stdin.write(data.encode("utf-8"))

    async def _send_status(self, message: str) -> None:
        await self.websocket.send_json({"type": "status", "message": message})
