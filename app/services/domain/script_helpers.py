"""Discover and validate script files stored in SCRIPTS_DIR, and pick
the right interpreter to run one with. Actually running a script is
handled by ProcessSession (backend/services/process_session.py).
"""

from __future__ import annotations

from pathlib import Path
import shlex

from app.config import SCRIPTS_DIR
from app.services.domain.exceptions import InvalidScriptError
from app.services.domain.schema import ScriptQueryParams


def list_scripts() -> list[str]:
    """Names of runnable files sitting directly inside SCRIPTS_DIR."""

    if not SCRIPTS_DIR.exists():
        return []

    return sorted(
        p.stem
        for p in SCRIPTS_DIR.iterdir()
        if p.is_file() and not p.name.startswith(".")
    )


def list_scoped_scripts(name) -> list[str]:
    """Names of runnable files sitting directly inside SCRIPTS_DIR."""
    pc_dir = (SCRIPTS_DIR / name).resolve()

    if not pc_dir.exists():
        return []

    return sorted(
        p.stem for p in pc_dir.iterdir() if p.is_file() and not p.name.startswith(".")
    )


def _resolve_script_path(params: ScriptQueryParams) -> Path:
    """Resolve `name` to a file inside SCRIPTS_DIR, rejecting traversal
    (e.g. "../../etc/passwd") or anything that escapes SCRIPTS_DIR."""
    scripts_dir = SCRIPTS_DIR.resolve()
    folder_path = (scripts_dir / params.folder).resolve()

    if scripts_dir not in folder_path.parents and folder_path != scripts_dir:
        raise InvalidScriptError("Invalid script folder")

    # params.script is used as a glob pattern below. If it contains path
    # separators or glob metacharacters ("*", "?", "[", "..") a caller could
    # escape folder_path or match unintended files. Reject anything that
    # isn't a plain filename stem.
    if any(c in params.script for c in ("/", "\\", "*", "?", "[", "..")):
        raise InvalidScriptError(f"Invalid script name '{params.script}'")

    matches = list(folder_path.glob(f"{params.script}.*"))
    if len(matches) != 1 or not matches[0].is_file():
        raise InvalidScriptError(f"Script '{params.script}' was not found")

    return matches[0]


def build_command(params: ScriptQueryParams) -> tuple[Path, list[str]]:
    """Pick an interpreter based on file extension. Falls back to
    executing the file directly, which needs a shebang + execute bit."""
    path = _resolve_script_path(params)

    suffix = path.suffix.lower()

    if suffix in (".bat", ".cmd"):
        command = ["cmd", "/c", str(path)]
    elif suffix == ".py":
        command = ["python3", str(path)]
    elif suffix in (".sh", ".bash"):
        command = ["bash", str(path)]
    elif suffix == ".ps1":
        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(path),
        ]
    else:
        command = [str(path)]

    if params.args:
        if isinstance(params.args, str):
            # A single string of args needs proper tokenizing, not appending
            # as one giant argv element (which would pass it to the
            # interpreter/script as a single mangled argument).
            command.extend(shlex.split(params.args))
        else:
            command.extend(params.args)

    return path, command
