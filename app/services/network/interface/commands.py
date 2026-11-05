"""Command builders for the interface-config page: the `configure
terminal` blocks for applying a change, reverting to a snapshot, and the
one-click port actions (enable / disable / restart, clearing
port-security).

Pure functions only - they take the parsed running config
(parsing.py) and the request, and return the exact lines to send.
"""

from __future__ import annotations

from app.services.network.errors import InterfaceChangeRejected
from app.services.network.interface.parsing import (
    MODE_ACCESS,
    PORT_SECURITY,
    PORT_SECURITY_STICKY,
    TRUNK_ALLOWED_PREFIX,
)
from app.services.network.interface.schemas import (
    InterfaceAction,
    InterfaceApplyRequest,
    InterfaceConfig,
    PortSecurity,
)

# Lines that define each port-security state, in the order IOS needs
# them enabled (port-security itself before the sticky option).
PORT_SECURITY_LINES: dict[str, list[str]] = {
    "off": [],
    "on": [PORT_SECURITY],
    "sticky": [PORT_SECURITY, PORT_SECURITY_STICKY],
}


def negate(line: str) -> str:
    """The command that removes `line` from the config: "no X" for a
    normal line, or X itself for a line that's already "no X"."""

    return line[3:] if line.startswith("no ") else f"no {line}"


def _wrap(interface: str, body: list[str]) -> list[str]:
    return ["configure terminal", f"interface {interface}", *body, "end"]


def _port_security_commands(current: PortSecurity, desired: PortSecurity) -> list[str]:
    """Only the lines that differ between two port-security states.
    Turning features off goes top-down (sticky option first), turning
    them on bottom-up (port-security first)."""

    have, want = PORT_SECURITY_LINES[current], PORT_SECURITY_LINES[desired]
    removals = [f"no {line}" for line in reversed(have) if line not in want]
    additions = [line for line in want if line not in have]
    return removals + additions


def _set_or_clear(command: str, desired: str | None, current: str) -> list[str]:
    """`command value` when changed to a value, `no command` when cleared,
    nothing when unchanged."""

    if desired is None or desired == current:
        return []
    return [f"{command} {desired}"] if desired else [f"no {command}"]


def build_apply_commands(
    current: InterfaceConfig, req: InterfaceApplyRequest
) -> list[str]:
    """Compares every field against the switch's current value, so an
    unchanged field never produces a command even if the page sent it."""

    access_fields = (
        req.remove_lines
        or req.extra_lines
        or req.access_vlan is not None
        or req.voice_vlan is not None
        or req.port_security is not None
        or req.port_security_max is not None
    )
    trunk_fields = req.trunk_add_vlans or req.trunk_remove_vlans

    body: list[str] = []

    if current.is_trunk:
        if access_fields:
            raise InterfaceChangeRejected(
                f"{req.interface} is a trunk - only the description and allowed VLANs can be changed."
            )
        body += _set_or_clear("description", req.description, current.description)
        if req.trunk_add_vlans:
            body.append(f"{TRUNK_ALLOWED_PREFIX} add {req.trunk_add_vlans}")
        if req.trunk_remove_vlans:
            body.append(f"{TRUNK_ALLOWED_PREFIX} remove {req.trunk_remove_vlans}")
    else:
        if trunk_fields:
            raise InterfaceChangeRejected(
                f"{req.interface} is not a trunk - allowed VLANs can't be changed."
            )

        missing = [line for line in req.remove_lines if line not in current.lines]
        if missing:
            raise InterfaceChangeRejected(
                "These lines are no longer in the running config: " + "; ".join(missing)
            )

        # Remove bottom-up: dependent lines (port-security options) come
        # after the ones they depend on (switchport mode access).
        to_remove = set(req.remove_lines)
        body.extend(
            negate(line) for line in reversed(current.lines) if line in to_remove
        )

        body += _set_or_clear("description", req.description, current.description)

        # A non-trunk port is always configured as access: any change to
        # one that lacks the line adds it, before the settings that need
        # it (port-security is refused on a port in DTP dynamic mode).
        # Not when the change is removing that very line.
        settings = _set_or_clear(
            "switchport access vlan", req.access_vlan, current.access_vlan
        )
        settings += _set_or_clear(
            "switchport voice vlan", req.voice_vlan, current.voice_vlan
        )
        settings += _set_or_clear(
            "switchport port-security maximum",
            req.port_security_max,
            current.port_security_max,
        )
        if req.port_security is not None:
            settings += _port_security_commands(
                current.port_security, req.port_security
            )
        settings += req.extra_lines

        if (
            (body or settings)
            and not current.mode_access
            and MODE_ACCESS not in to_remove
        ):
            body.append(MODE_ACCESS)
        body += settings

    # A removed row and a changed field can produce the same "no ..." line.
    body = list(dict.fromkeys(body))
    if not body:
        raise InterfaceChangeRejected("Nothing to change.")

    return _wrap(req.interface, body)


def build_action_commands(
    current: InterfaceConfig, interface: str, action: InterfaceAction
) -> list[str]:
    """One-click actions. Access ports only: bouncing or clearing a
    trunk (often the uplink the SSH session itself runs over) is never
    offered."""

    if current.is_trunk:
        raise InterfaceChangeRejected(
            f"{interface} is a trunk - port actions are only allowed on access ports."
        )

    bounce = _wrap(interface, ["shutdown", "no shutdown"])

    if action == "enable":
        if not current.shutdown:
            raise InterfaceChangeRejected(f"{interface} is already enabled.")
        return _wrap(interface, ["no shutdown"])
    if action == "disable":
        if current.shutdown:
            raise InterfaceChangeRejected(f"{interface} is already disabled.")
        return _wrap(interface, ["shutdown"])
    if action == "restart":
        return bounce
    if action == "clear-sticky":
        if current.port_security != "sticky":
            raise InterfaceChangeRejected(
                f"{interface} has no sticky port-security to clear."
            )
        return [f"clear port-security sticky interface {interface}"]
    if action == "reset-port-security":
        # Forget every secure MAC, then bounce the port to bring it back
        # from err-disabled (psecure-violation).
        return [f"clear port-security all interface {interface}", *bounce]

    raise InterfaceChangeRejected(f"Unknown action: {action}")


def build_revert_commands(
    interface: str, current: list[str], before: list[str]
) -> list[str]:
    """Commands that turn `current` back into `before`: negate lines that
    were added, re-add lines that were removed. Returns [] when they
    already match.

    Trunk allowed-VLAN lines are handled as one unit: the first one
    replaces the whole list and any following "add" lines extend it, so
    the original set is re-sent in order rather than diffed line by
    line."""

    def is_allowed(line: str) -> bool:
        return line.startswith(TRUNK_ALLOWED_PREFIX)

    before_set, current_set = set(before), set(current)

    removals = [
        negate(line)
        for line in reversed(current)
        if line not in before_set and not is_allowed(line)
    ]
    additions = [
        line for line in before if line not in current_set and not is_allowed(line)
    ]

    before_allowed = [line for line in before if is_allowed(line)]
    current_allowed = [line for line in current if is_allowed(line)]
    if before_allowed != current_allowed:
        if before_allowed:
            additions.extend(before_allowed)
        else:
            removals.append(f"no {TRUNK_ALLOWED_PREFIX}")

    body = removals + additions
    return _wrap(interface, body) if body else []
