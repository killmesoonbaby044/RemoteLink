"""MAC lookup across an inventory group or root point: builds the
filtered show command (parsing.py), runs it on every host
(runtime.run_on_group) and collects the matches."""

from __future__ import annotations

from app.services.switch.inventory.inventory_errors import InventoryError
from app.services.switch.mac_lookup.parsing import (
    build_mac_filter,
    find_by_suffix,
    find_err_disabled,
)
from app.services.switch.mac_lookup.schemas import (
    LookupTargetRequest,
    MacLookupRequest,
    MacLookupResponse,
)
from app.services.switch.runtime import run_on_group
from app.services.switch.schemas import HostTaskResult


def _build_command(base: str, suffix: str) -> str:
    """`base` is the show command without the pipe, e.g.
    "show mac address-table static" or "show port-security address"."""

    return f"{base} | include {build_mac_filter(suffix)}"


async def run_lookup(req: MacLookupRequest, base_commands: list[str]) -> MacLookupResponse:
    """Every command in `base_commands` runs in the same SSH session per
    host; find_by_suffix parses their combined output."""

    try:
        results = await run_on_group(
            group_name=req.group,
            username=req.username,
            password=req.password,
            commands=[_build_command(base, req.mac_suffix) for base in base_commands],
            parse=lambda host, output: find_by_suffix(host, output, req.mac_suffix),
        )
    except InventoryError as exc:
        return MacLookupResponse(
            results=[
                HostTaskResult(host=",".join(req.group), address="", ok=False, error=str(exc))
            ]
        )

    return MacLookupResponse(results=results)


async def run_err_disabled_lookup(req: LookupTargetRequest) -> MacLookupResponse:
    """Every port in err-disabled state across the group - no MAC needed."""

    try:
        results = await run_on_group(
            group_name=req.group,
            username=req.username,
            password=req.password,
            commands=["show interfaces status err-disabled"],
            parse=find_err_disabled,
        )
    except InventoryError as exc:
        return MacLookupResponse(
            results=[
                HostTaskResult(host=",".join(req.group), address="", ok=False, error=str(exc))
            ]
        )

    return MacLookupResponse(results=results)
