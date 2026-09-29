"""Thin wrapper around the two AD search scripts (pcs, users).

Both root\\search_pcs.ps1 and root\\search_users.ps1 now print a single
JSON array on stdout - there's nothing script-specific left to parse, so
one function covers both. Callers just say which script and query to run.

This is deliberately best-effort/non-raising: it backs live search /
autocomplete, so a timeout or AD hiccup should degrade to an empty
result rather than surface as a 500. If you need to know *why* a search
came back empty, check logs / result.stderr from run_script directly.
"""

import json

from loguru import logger

from app.services.domain.schema import ScriptQueryParams
from app.services.sessions.AD_script_session import run_script, ScriptResult

DEFAULT_TIMEOUT_SECONDS = 30


_TRANSIENT_ERROR = "a local error has occurred"


def _has_transient_error(items: list) -> bool:
    for item in items:
        error = item.get("error") if isinstance(item, dict) else None
        if isinstance(error, str) and _TRANSIENT_ERROR in error.lower():
            return True
    return False


async def run_search(
    script_params: ScriptQueryParams,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> list | dict:

    for attempt in range(2):  # first run + one retry on the known transient AD error
        result: ScriptResult = await run_script(script_params, timeout=timeout)
        if result.timed_out or result.returncode != 0:
            logger.warning(result)
            return []
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            logger.warning(result)
            return []

        items = data if isinstance(data, list) else [data]

        if attempt == 1 or not _has_transient_error(items):
            return items

    return []  # unreachable, satisfies linters
