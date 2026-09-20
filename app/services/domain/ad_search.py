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

from app.services.domain.schema import ScriptQueryParams
from app.services.sessions.AD_script_session import run_script

DEFAULT_TIMEOUT_SECONDS = 30


async def run_search(
    args: ScriptQueryParams,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> list:

    result = await run_script(args, timeout=timeout)
    if result.timed_out or result.returncode != 0:
        return []

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    # Defensive: the scripts always wrap output in @(...) so this should
    # already be a list, but don't blow up if a script ever returns a
    # single bare object instead.
    return data if isinstance(data, list) else [data]
