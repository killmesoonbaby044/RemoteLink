"""Interface-config tasks on a single switch: list interfaces, read one
interface's running config, apply / revert a change, one-click port
actions, write memory.

How to read the answer comes from parsing.py and what to send from
commands.py (both pure); connecting is runtime.py.
"""

from __future__ import annotations

from app.services.network.errors import InterfaceChangeRejected
from app.services.network.interface.commands import (
    build_action_commands,
    build_apply_commands,
    build_revert_commands,
)
from app.services.network.interface.parsing import (
    find_errors,
    parse_interfaces,
    parse_running_interface,
    parse_vlans,
)
from app.services.network.interface.schemas import (
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
from app.services.network.runtime import run_on_host
from app.services.network.schemas import SwitchRequest


def _read_config_commands(interface: str) -> list[str]:
    """Both are needed to tell a trunk: the config for what's set, the
    switchport status for what the port is actually doing (DTP)."""

    return [
        f"show interfaces {interface} switchport",
        f"show running-config interface {interface}",
    ]


async def list_interfaces(req: SwitchRequest) -> InterfacesResponse:
    output = await run_on_host(
        req, ["show interfaces status", "show interfaces description"]
    )
    return InterfacesResponse(host=req.host, interfaces=parse_interfaces(output))


async def list_vlans(req: SwitchRequest) -> VlansResponse:
    output = await run_on_host(req, ["show vlan brief"])
    return VlansResponse(host=req.host, vlans=parse_vlans(output))


async def get_interface_config(req: InterfaceRequest) -> InterfaceConfig:
    output = await run_on_host(req, _read_config_commands(req.interface))
    return parse_running_interface(output, req.interface)


async def _apply(
    req: InterfaceRequest, before: InterfaceConfig, commands: list[str]
) -> InterfaceChangeResponse:
    """Sends the config block and the verifying "show run int" in one
    session, so the returned `after` is exactly what the switch holds
    once the change is in."""

    output = await run_on_host(req, [*commands, *_read_config_commands(req.interface)])
    return InterfaceChangeResponse(
        commands=commands,
        before=before,
        after=parse_running_interface(output, req.interface),
        errors=find_errors(output),
        output=output,
    )


async def apply_interface_change(req: InterfaceApplyRequest) -> InterfaceChangeResponse:
    """Re-reads the running config first (both for dry runs and real
    runs), so trunk/access rules and "remove this line" are checked
    against the switch's current state, not whatever the page loaded
    earlier."""

    before = await get_interface_config(req)
    commands = build_apply_commands(before, req)

    if req.dry_run:
        return InterfaceChangeResponse(commands=commands, before=before)

    return await _apply(req, before, commands)


async def revert_interface_change(
    req: InterfaceRevertRequest,
) -> InterfaceChangeResponse:
    current = await get_interface_config(req)
    commands = build_revert_commands(req.interface, current.lines, req.before_lines)

    if not commands:
        raise InterfaceChangeRejected(
            f"{req.interface} already matches the original config - nothing to revert."
        )

    return await _apply(req, current, commands)


async def run_interface_action(req: InterfaceActionRequest) -> InterfaceChangeResponse:
    before = await get_interface_config(req)
    commands = build_action_commands(before, req.interface, req.action)
    return await _apply(req, before, commands)


async def write_memory(req: SwitchRequest) -> WriteMemoryResponse:
    output = await run_on_host(req, ["write memory"], timeout=90.0)
    return WriteMemoryResponse(ok="[OK]" in output, output=output)
