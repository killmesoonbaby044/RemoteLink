"""Runs a stored script to completion and returns its captured output.

Non-interactive counterpart to ProcessSession: no PTY, no WebSocket,
no live browser I/O. Use this when a script just needs to run once and
report a result (e.g. a search script that prints SEARCH_RESULTS: ...
and exits) rather than prompt the user mid-run.
"""

from __future__ import annotations

import asyncio
import re
import subprocess
from dataclasses import dataclass, field

from app.services.sessions.script_helpers import build_command, resolve_script_path

_SEARCH_RESULTS_LINE = re.compile(r"^SEARCH_RESULTS:\s*(.*)$", re.MULTILINE)

DEFAULT_TIMEOUT_SECONDS = 30


@dataclass
class ScriptResult:
    returncode: int | None
    stderr: str
    timed_out: bool = False
    records: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "returncode": self.returncode,
            "stderr": self.stderr,
            "timed_out": self.timed_out,
            "records": self.records,
        }


async def run_script(
    name: str,
    arg: str | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> ScriptResult:
    """Resolve `name` inside SCRIPTS_DIR, run it to completion, and
    return its captured stdout/stderr plus anything parsed out of it.

    Raises InvalidScriptError (from script_runner) if `name` doesn't
    resolve to a real file inside SCRIPTS_DIR.
    """

    path = resolve_script_path(name)
    command = build_command(path, arg)

    loop = asyncio.get_running_loop()
    timed_out = False

    try:
        completed = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                command,
                cwd=str(path.parent),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
            ),
        )
        stdout, stderr, returncode = (
            completed.stdout,
            completed.stderr,
            completed.returncode,
        )
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        stdout = exc.stdout or ""
        stderr = (exc.stderr or "") + "\n[process timed out and was killed]"
        returncode = None

    result = ScriptResult(
        returncode=returncode,
        stderr=stderr,
        timed_out=timed_out,
    )
    if "root\\search" in str(path):
        search_match = _SEARCH_RESULTS_LINE.search(stdout)
        if search_match:
            result.records = [
                c.strip() for c in search_match.group(1).strip().split("|") if c.strip()
            ]

    return result
