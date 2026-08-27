"""Discover and validate script files stored in SCRIPTS_DIR, and pick
the right interpreter to run one with. Actually running a script is
handled by ProcessSession (backend/services/process_session.py).
"""

from __future__ import annotations

from pathlib import Path

from app.config import SCRIPTS_DIR


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


def list_pc_scripts() -> list[str]:
    """Names of runnable files sitting directly inside SCRIPTS_DIR."""
    pc_dir = (SCRIPTS_DIR / "pc").resolve()

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
    else:
        command = [str(path)]

    if arg:
        command.append(arg)

    return command
