"""Discover and validate script files stored in SCRIPTS_DIR, and pick
the right interpreter to run one with. Actually running a script is
handled by ProcessSession (backend/services/process_session.py).
"""

from __future__ import annotations

import shlex
from pathlib import Path

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


# Characters cmd.exe treats as command-line syntax (chaining, redirection,
# escaping, variable expansion), even when they sit inside an argv element
# Python itself never asked cmd.exe to parse as one string. python3/bash/
# powershell -File don't re-interpret their argv this way, so this check
# only applies to the .bat/.cmd branch below.
_CMD_METACHARS = set('&|<>^%"')


def _validate_cmd_args(args: list[str]) -> None:
    """Reject args that would let a caller inject a second command into
    a .bat/.cmd invocation (see build_command's .bat/.cmd branch)."""
    for arg in args:
        found = _CMD_METACHARS & set(arg)
        if found:
            raise InvalidScriptError(
                f"Argument '{arg}' contains characters not allowed "
                f"for .bat/.cmd scripts: {sorted(found)}"
            )


def _resolve_args(params: ScriptQueryParams) -> list[str]:
    """Normalize params.args (str or list[str]) into a list[str],
    tokenizing a plain string the same way as before."""
    if isinstance(params.args, str):
        return shlex.split(params.args)

    return list(params.args)


def build_command(params: ScriptQueryParams) -> tuple[Path, list[str]]:
    """Pick an interpreter based on file extension. Falls back to
    executing the file directly, which needs a shebang + execute bit."""
    path_file = _resolve_script_path(params)

    suffix = path_file.suffix.lower()

    if suffix == ".cmd":
        command = ["cmd", "/c", str(path_file)]

    elif suffix == ".ps1":
        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(path_file),
        ]
    else:
        raise InvalidScriptError(f"Invalid script extension '{suffix}'")
    # if suffix in (".bat", ".cmd"):
    # command = ["cmd", "/c", str(path_file)]
    # elif suffix == ".py":
    #     command = ["python3", str(path_file)]
    # elif suffix in (".sh", ".bash"):
    #     command = ["bash", str(path_file)]

    if params.args:
        resolved_args = _resolve_args(params)

        if suffix in (".bat", ".cmd"):
            _validate_cmd_args(resolved_args)

        command.extend(resolved_args)

    return path_file, command
