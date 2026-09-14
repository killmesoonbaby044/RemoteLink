"""Executes scripted SSH work against switches: a single non-interactive
command session, and a group-wide runner built on top of it.

Deliberately separate from SSHSession (app/services/sessions/ssh_session.py):
that class permanently bridges one asyncssh process with one browser
WebSocket for an interactive terminal. This module opens a connection,
feeds it a short scripted command sequence, waits for it to finish, and
returns - no WebSocket involved, so it works equally well from an HTTP
endpoint, a scheduled job, or a CLI script.

Credentials are passed in per call and only ever held in memory for the
duration of one connection - nothing here writes them anywhere.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable

import asyncssh

from app.services.switch.inventory.inventory import InventoryError, inventory_store
from app.services.switch.mac_lookup import build_mac_filter, find_by_suffix
from app.services.switch.schemas import (
    CommandResult,
    Host,
    HostTaskResult,
    MacLookupRequest,
    MacLookupResponse,
)

# Parses one host's raw command output (given the host name, for
# attribution) into a list of task-specific Pydantic entries.
ParseFn = Callable[[str, str], list[Any]]


def _build_command(base: str, suffix: str) -> str:
    """`base` is the show command without the pipe, e.g.
    "show mac address-table static" or "show port-security address"."""

    return f"{base} | include {build_mac_filter(suffix)}"


async def _run_commands(
    host: Host,
    username: str,
    password: str,
    commands: list[str],
    timeout: float = 15.0,
) -> CommandResult:
    """Opens one SSH connection and runs `commands` in a single shell
    session (so `terminal length 0` / `enable` state carries over
    between them), then returns everything written to stdout.

    Any connection, auth, or timeout failure is captured in the result
    instead of raised, so callers running this across many hosts don't
    need a try/except around every call.
    """

    try:
        async with asyncssh.connect(
            host=host.address,
            port=host.port,
            username=username,
            password=password,
            known_hosts=None,
        ) as conn:
            async with conn.create_process(
                term_type="vt100", encoding="utf-8"
            ) as process:
                process.stdin.write("terminal length 0\n")
                for command in commands:
                    process.stdin.write(f"{command}\n")
                process.stdin.write("exit\n")
                process.stdin.write_eof()

                output = await asyncio.wait_for(process.stdout.read(), timeout=timeout)
                return CommandResult(host=host.name, ok=True, output=output)

    except (asyncssh.Error, OSError, asyncio.TimeoutError) as exc:
        return CommandResult(host=host.name, ok=False, error=str(exc))


async def _run_task_on_group(
    group_name: list[str],
    username: str,
    password: str,
    commands: list[str],
    parse: ParseFn,
    max_concurrent: int = 10,
) -> list[HostTaskResult]:
    """Resolves `group_name` or "root_point" via the inventory, then runs `commands` on
    every host concurrently (capped by `max_concurrent`), parsing each
    host's output independently."""

    hosts = await inventory_store.resolve_for_lookup(group_name)
    semaphore = asyncio.Semaphore(max_concurrent)

    async def run_one(host: Host) -> HostTaskResult:
        async with semaphore:
            result = await _run_commands(host, username, password, commands)

        if not result.ok:
            return HostTaskResult(
                host=host.name,
                address=host.address,
                ok=False,
                matches=[],
                error=result.error,
            )

        return HostTaskResult(
            host=host.name,
            address=host.address,
            ok=True,
            matches=parse(host.name, result.output),
        )

    return list(await asyncio.gather(*(run_one(h) for h in hosts)))


async def run_lookup(req: MacLookupRequest, base_command: str) -> MacLookupResponse:
    try:
        results = await _run_task_on_group(
            group_name=req.group,
            username=req.username,
            password=req.password,
            commands=[_build_command(base_command, req.mac_suffix)],
            parse=lambda host, output: find_by_suffix(host, output, req.mac_suffix),
        )
    except InventoryError as exc:
        return MacLookupResponse(
            results=[HostTaskResult(host=",".join(req.group), ok=False, error=str(exc))]
        )

    return MacLookupResponse(results=results)
