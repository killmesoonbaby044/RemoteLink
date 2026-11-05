from fastapi import APIRouter, Depends

from app.core.auth.auth_manager import validate_user
from app.services.switch.interface.schemas import (
    InterfaceActionRequest,
    InterfaceApplyRequest,
    InterfaceChangeResponse,
    InterfaceConfig,
    InterfaceRequest,
    InterfaceRevertRequest,
    InterfacesResponse,
    VlansResponse,
    WriteMemoryResponse,
)
from app.services.switch.interface.tasks import (
    apply_interface_change,
    get_interface_config,
    list_interfaces,
    list_vlans,
    revert_interface_change,
    run_interface_action,
    write_memory,
)
from app.services.switch.mac_lookup.schemas import (
    LookupTargetRequest,
    MacLookupRequest,
    MacLookupResponse,
)
from app.services.switch.mac_lookup.tasks import run_err_disabled_lookup, run_lookup
from app.services.switch.schemas import SwitchRequest

router = APIRouter(
    prefix="/network",
    tags=["Switch Tasks"],
    dependencies=[Depends(validate_user)],
)


@router.post("/tasks/mac-lookup", response_model=MacLookupResponse)
async def mac_lookup(req: MacLookupRequest) -> MacLookupResponse:
    """Access-port lookup: the static MAC table and the port-security
    table together, one row per (vlan, mac, port) with `sources` saying
    which table(s) it was in. Neither has trunk false positives - a MAC
    learned only via a trunk is DYNAMIC, and a secure MAC is only ever
    bound to the port it was learned/configured on."""
    return await run_lookup(
        req, ["show mac address-table static", "show port-security address"]
    )


@router.post("/tasks/mac-lookup-trunk", response_model=MacLookupResponse)
async def mac_lookup_trunk(req: MacLookupRequest) -> MacLookupResponse:
    """Dynamic lookup - deliberately includes trunk-learned entries,
    so the same MAC may legitimately show up across several switches."""
    return await run_lookup(req, ["show mac address-table dynamic"])


@router.post("/tasks/err-disabled-lookup", response_model=MacLookupResponse)
async def err_disabled_lookup(req: LookupTargetRequest) -> MacLookupResponse:
    """Ports in err-disabled state (psecure-violation, bpduguard, ...)."""
    return await run_err_disabled_lookup(req)


# -- interface config ---------------------------------------------------------
#
# Errors (switch unreachable -> 502, change not allowed -> 409) are mapped
# by switch_task_error_handler in app/core/exception_handlers.py.


@router.post("/tasks/interfaces", response_model=InterfacesResponse)
async def interfaces(req: SwitchRequest) -> InterfacesResponse:
    return await list_interfaces(req)


@router.post("/tasks/vlans", response_model=VlansResponse)
async def vlans(req: SwitchRequest) -> VlansResponse:
    """VLANs defined on the switch, for the VLAN pickers."""
    return await list_vlans(req)


@router.post("/tasks/interface-config", response_model=InterfaceConfig)
async def interface_config(req: InterfaceRequest) -> InterfaceConfig:
    return await get_interface_config(req)


@router.post("/tasks/interface-apply", response_model=InterfaceChangeResponse)
async def interface_apply(req: InterfaceApplyRequest) -> InterfaceChangeResponse:
    """dry_run=true only builds the commands (after re-reading the
    running config); otherwise sends them and returns the new config."""
    return await apply_interface_change(req)


@router.post("/tasks/interface-revert", response_model=InterfaceChangeResponse)
async def interface_revert(req: InterfaceRevertRequest) -> InterfaceChangeResponse:
    return await revert_interface_change(req)


@router.post("/tasks/interface-action", response_model=InterfaceChangeResponse)
async def interface_action(req: InterfaceActionRequest) -> InterfaceChangeResponse:
    """Enable / disable / restart, clear sticky MACs, reset port-security.
    Access ports only; runs immediately (the page confirms first)."""
    return await run_interface_action(req)


@router.post("/tasks/write-memory", response_model=WriteMemoryResponse)
async def write_mem(req: SwitchRequest) -> WriteMemoryResponse:
    return await write_memory(req)
