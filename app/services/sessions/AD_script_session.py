"""Runs a stored script to completion and returns its captured output.

Non-interactive counterpart to ProcessSession: no PTY, no WebSocket,
no live browser I/O. Use this when a script just needs to run once and
report a result (e.g. print JSON and exit) rather than prompt the user
mid-run.

This module is intentionally domain-agnostic: it knows how to run a
script and capture stdout/stderr/returncode, and nothing about what any
given script's output means. Interpreting stdout (JSON parsing, shaping
into a dict/list, deciding what counts as an error) is each call site's
job - see ad_schema.py and ad_search.py for the two current ones.
"""

from __future__ import annotations

import asyncio
import subprocess
from dataclasses import dataclass

from app.services.domain.schema import ScriptQueryParams
from app.services.domain.script_helpers import build_command

DEFAULT_TIMEOUT_SECONDS = 30


@dataclass
class ScriptResult:
    returncode: int | None
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False

    def to_dict(self) -> dict:
        return {
            "returncode": self.returncode,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "timed_out": self.timed_out,
        }


async def run_script(
    params: ScriptQueryParams,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> ScriptResult:
    """Resolve `name` inside SCRIPTS_DIR, run it to completion, and
    return its captured stdout/stderr/returncode.

    Raises InvalidScriptError (from script_helpers) if `name` doesn't
    resolve to a real file inside SCRIPTS_DIR.
    """

    path, command = build_command(params)

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

    return ScriptResult(
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
        timed_out=timed_out,
    )
