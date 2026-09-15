"""Discover and validate script files stored in SCRIPTS_DIR, and pick
the right interpreter to run one with. Actually running a script is
handled by ProcessSession (backend/services/process_session.py).
"""

from __future__ import annotations

from pathlib import Path

from app.config import SCRIPTS_DIR
from app.services.domain.schema import ScriptQueryParams


class InvalidScriptError(Exception):
    """Raised when a requested script name is missing, unsafe, or invalid."""


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


def resolve_script_path(name: str) -> Path:
    """Resolve `name` to a file inside SCRIPTS_DIR, rejecting traversal
    (e.g. "../../etc/passwd") or anything that escapes SCRIPTS_DIR."""

    candidate = (SCRIPTS_DIR / name).resolve()
    scripts_dir = SCRIPTS_DIR.resolve()

    if scripts_dir not in candidate.parents:
        raise InvalidScriptError(f"'{name}' is not a valid script")

    if not candidate.is_file():
        raise InvalidScriptError(f"Script '{name}' was not found")

    return candidate


def resolve_script_path_new(args: ScriptQueryParams) -> Path:

    scripts_dir = SCRIPTS_DIR.resolve()

    folder_path = (scripts_dir / args.folder).resolve()

    if scripts_dir not in folder_path.parents and folder_path != scripts_dir:

        raise InvalidScriptError(f"Invalid script folder")

    matches = list(folder_path.glob(f"{args.script}.*"))

    if len(matches) != 1 or not matches[0].is_file():

        raise InvalidScriptError(f"Script '{args.script}' was not found")

    return matches[0]


def build_command(path: Path, arg: str | None = None) -> list[str]:
    """Pick an interpreter based on file extension. Falls back to
    executing the file directly, which needs a shebang + execute bit."""

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

    if arg:
        command.append(arg)

    return command
