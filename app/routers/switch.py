from fastapi import APIRouter, Depends

from app.core.auth.auth_manager import validate_user
from app.services.switch.schemas import MacLookupRequest, MacLookupResponse
from app.services.switch.switch_runtime import run_lookup

router = APIRouter(dependencies=[Depends(validate_user)])


@router.post("/tasks/mac-lookup", response_model=MacLookupResponse)
async def mac_lookup(req: MacLookupRequest) -> MacLookupResponse:
    """Static (access-port) lookup - the normal case, no trunk false positives."""
    return await run_lookup(req, "show mac address-table static")


@router.post("/tasks/mac-lookup-trunk", response_model=MacLookupResponse)
async def mac_lookup_trunk(req: MacLookupRequest) -> MacLookupResponse:
    """Dynamic lookup - deliberately includes trunk-learned entries,
    so the same MAC may legitimately show up across several switches."""
    return await run_lookup(req, "show mac address-table dynamic")


@router.post("/tasks/port-security-lookup", response_model=MacLookupResponse)
async def port_security_lookup(req: MacLookupRequest) -> MacLookupResponse:
    """Secure-MAC (port-security) table lookup. No trunk false positives
    here either - a secure MAC is only ever bound to the port it was
    learned/configured on."""
    return await run_lookup(req, "show port-security address")
