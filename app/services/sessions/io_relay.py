"""Shared by SSHSession and ProcessSession: run two IO coroutines side
by side (reading from a remote/local process, reading from the
browser) and stop as soon as either one finishes -- e.g. the process
exits, or the browser disconnects -- instead of hanging on the other.
"""

from __future__ import annotations

import asyncio
from typing import Coroutine


async def relay(*coros: Coroutine) -> None:
    tasks = [asyncio.ensure_future(c) for c in coros]

    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

    for task in pending:
        task.cancel()

    if pending:
        await asyncio.gather(*pending, return_exceptions=True)

    for task in done:
        task.result()  # re-raise if one of them errored
