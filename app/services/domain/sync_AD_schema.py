import asyncio
import json
import subprocess
from pathlib import Path

from app.config import SCRIPTS_DOMAIN_SCHEMA
from app.services.sessions.script_helpers import resolve_script_path, build_command

TIMEOUT = 60


def normalize_name(raw_name: str, parent_dn: str | None) -> str:
    """
    Business logic for item 8, done here (not in PowerShell) because it's pure
    string parsing of the DN and easier to iterate/unit-test without AD access.

    Priority order matters - own name is checked first, then the parent's name,
    since "is this OU a child of 'Users'" only makes sense once we know this OU
    itself isn't literally named 'Users'.

    1. if name == 'Users':
           name = parent OU's name
    2. elif parent OU's name == 'Users' (this OU is a child of 'Users'):
           name = '{grandparent OU's name}-{name}'
    3. elif parent OU's name is anything else:
           name = '{parent OU's name}-{name}'
    """

    def ou_name(dn: str | None) -> str | None:
        if not dn:
            return None
        first_part = dn.split(",", 1)[0]
        if "=" in first_part:
            return first_part.split("=", 1)[1]
        return None

    parent_name = ou_name(parent_dn)
    grandparent_dn = (
        parent_dn.split(",", 1)[1] if parent_dn and "," in parent_dn else None
    )
    grandparent_name = ou_name(grandparent_dn)

    if raw_name == "Users":
        return parent_name or raw_name
    elif parent_name == "Users":
        return f"{grandparent_name}-{raw_name}" if grandparent_name else raw_name
    elif parent_name is not None:
        return f"{parent_name}-{raw_name}"
    return raw_name


async def run_script(timeout: int = TIMEOUT) -> dict:
    name = "domain\\get_schema.ps1"
    path = resolve_script_path(name)
    command = build_command(path)
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

    if timed_out:
        raise RuntimeError(f"Script timed out.\nstderr:\n{stderr}")
    if returncode != 0:
        raise RuntimeError(f"Script exited with code {returncode}.\nstderr:\n{stderr}")

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Could not parse script output as JSON: {exc}\nRaw stdout:\n{stdout}"
        )

    return data


def sort_key(item: dict) -> tuple[str, str]:
    """
    Safe sort key: works whether Name is a plain string ('Marketing') or a
    composite string ('Marketing-Contractors'). Case-insensitive via casefold(),
    defensive against missing/None values, and uses DN as a tiebreaker so the
    order is deterministic even when two OUs normalize to the same Name.
    """
    name = item.get("Name") or ""
    dn = item.get("DN") or ""
    return (name.casefold(), dn.casefold())


# --- CRUTCH: hardcoded names to drop from the final output. ---
# Matches against the *normalized* Name (case-insensitive), not the raw AD cn.
# Temporary workaround - remove once the underlying .ps1 issue is fixed properly.
EXCLUDED_NAMES = {
    # "SomeName",
    # "Marketing-Contractors",
}
_EXCLUDED_NAMES_CF = {n.casefold() for n in EXCLUDED_NAMES}


def normalize_group(group: list[dict]) -> list[dict]:
    return [
        {"Name": normalize_name(item["Name"], item.get("ParentDN")), "DN": item["DN"]}
        for item in group
    ]


def filter_excluded(group: list[dict]) -> list[dict]:
    """CRUTCH: drops items whose normalized Name is in EXCLUDED_NAMES."""
    return [item for item in group if item["Name"].casefold() not in _EXCLUDED_NAMES_CF]


def sort_group(group: list[dict]) -> list[dict]:
    return sorted(group, key=sort_key)


def apply_naming(group: list[dict]) -> list[dict]:
    group = normalize_group(group)
    group = filter_excluded(group)
    group = sort_group(group)
    return group


async def job():
    raw = await run_script()
    result = {key: apply_naming(value) for key, value in raw.items()}
    return result
