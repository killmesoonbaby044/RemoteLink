"""Parsers for the interface-config page.

Pure functions only - no SSH here (that's runtime.py). Everything takes
raw IOS session output or already-parsed lines and returns plain data,
so it can be tested without a switch.

Covers:

  show interfaces status       - port / status / vlan per interface
  show interfaces description  - full description (status truncates it)
  show running-config interface X
                               - the interface body, one line per entry
  show interfaces X switchport - the operational mode (trunk / access)
  show vlan brief              - the VLANs defined on the switch
"""

from __future__ import annotations

import re

from app.services.switch.errors import InterfaceChangeRejected
from app.services.switch.interface.schemas import (
    InterfaceConfig,
    InterfaceStatus,
    PortSecurity,
    Vlan,
)

# "SW1#show interfaces status" / "SW1(config-if)#end" - a prompt line.
PROMPT_RE = re.compile(r"^\S+#")

# A row in the status/description tables starts with a short interface
# name followed by whitespace: "Gi1/0/9   ...". Requiring the whitespace
# keeps prompt lines like "SW1#..." from matching.
PORT_ROW_RE = re.compile(r"^(?P<port>[A-Za-z]{2,}[\d/.:]+)\s")

RUN_INTERFACE_RE = re.compile(r"^interface (?P<name>\S+)\s*$")

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")

# "Operational Mode: trunk" / "Operational Mode: static access" /
# "Operational Mode: trunk (member of bundle Po1)".
OPERATIONAL_MODE_RE = re.compile(r"^Operational Mode:\s*(?P<mode>.*?)\s*$")
SWITCHPORT_DISABLED = "Switchport: Disabled"

# "374  USERS   active   Gi1/0/1, Gi1/0/2" - a VLAN row in "show vlan
# brief" (port-list continuation lines start with spaces, so they don't).
VLAN_ROW_RE = re.compile(r"^(?P<id>\d{1,4})\s")

# The VLANs every IOS switch has out of the box - VLAN 1 and the Token
# Ring / FDDI leftovers - aren't offered in the pickers (VLAN 1 can still
# be typed by hand).
DEFAULT_VLANS = {"1", "1002", "1003", "1004", "1005"}

TRUNK_ALLOWED_PREFIX = "switchport trunk allowed vlan"
MODE_ACCESS = "switchport mode access"
PORT_SECURITY = "switchport port-security"
PORT_SECURITY_STICKY = "switchport port-security mac-address sticky"


def _clean_lines(output: str) -> list[str]:
    output = ANSI_RE.sub("", output).replace("\r", "")
    return output.split("\n")


def _table_rows(
    lines: list[str], header_words: tuple[str, ...]
) -> tuple[str, list[str]]:
    """Finds the header line containing every word in `header_words` and
    returns it with the port rows that follow, up to the next prompt."""

    for start, line in enumerate(lines):
        if all(word in line for word in header_words):
            rows = []
            for row in lines[start + 1 :]:
                if PROMPT_RE.match(row):
                    break
                if PORT_ROW_RE.match(row):
                    rows.append(row)
            return line, rows
    return "", []


def parse_interfaces(output: str) -> list[InterfaceStatus]:
    """Parses one transcript holding both `show interfaces status` and
    `show interfaces description`.

    Status rows are fixed-width, but descriptions can contain spaces, so
    the Name column is sliced by the header's column positions and the
    rest (status, vlan, ...) split on whitespace. The description table
    is preferred for the description since status truncates it."""

    lines = _clean_lines(output)

    status_header, status_rows = _table_rows(lines, ("Port", "Name", "Status", "Vlan"))
    desc_header, desc_rows = _table_rows(
        lines, ("Interface", "Protocol", "Description")
    )

    descriptions: dict[str, str] = {}
    if desc_header:
        desc_col = desc_header.index("Description")
        for row in desc_rows:
            port = PORT_ROW_RE.match(row).group("port")
            descriptions[port] = row[desc_col:].strip()

    interfaces: list[InterfaceStatus] = []
    if not status_header:
        return interfaces

    name_col = status_header.index("Name")
    status_col = status_header.index("Status")
    for row in status_rows:
        port = PORT_ROW_RE.match(row).group("port")
        rest = row[status_col:].split()
        interfaces.append(
            InterfaceStatus(
                port=port,
                description=descriptions.get(port) or row[name_col:status_col].strip(),
                status=rest[0] if rest else "",
                vlan=rest[1] if len(rest) > 1 else "",
            )
        )
    return interfaces


def parse_vlans(output: str) -> list[Vlan]:
    """`show vlan brief`: the Name column is sliced by the header's
    column positions (same as the status table), since a name can be
    long enough to touch the Status column."""

    lines = _clean_lines(output)

    header = next(
        (line for line in lines if all(w in line for w in ("VLAN", "Name", "Status"))),
        "",
    )
    if not header:
        return []
    name_col = header.index("Name")
    status_col = header.index("Status")

    vlans: list[Vlan] = []
    for row in lines[lines.index(header) + 1 :]:
        if PROMPT_RE.match(row):
            break
        match = VLAN_ROW_RE.match(row)
        if not match or match.group("id") in DEFAULT_VLANS:
            continue
        rest = row[status_col:].split()
        vlans.append(
            Vlan(
                id=match.group("id"),
                name=row[name_col:status_col].strip(),
                status=rest[0] if rest else "",
            )
        )
    return vlans


def parse_running_interface(output: str, interface: str) -> InterfaceConfig:
    """Pulls the body of the LAST "interface X" block out of a transcript
    (an apply session echoes config-mode commands first, then the
    verifying "show run int" at the end - the last block is the one that
    reflects the result)."""

    lines = _clean_lines(output)

    start = None
    for index, line in enumerate(lines):
        if RUN_INTERFACE_RE.match(line):
            start = index
    if start is None:
        raise InterfaceChangeRejected(
            f"Could not read the running config of {interface} - check the interface name."
        )

    name = RUN_INTERFACE_RE.match(lines[start]).group("name")
    body = []
    for line in lines[start + 1 :]:
        if not line.startswith(" "):
            break
        body.append(line.strip())

    return build_interface_config(name, body, parse_operational_mode(lines))


def parse_operational_mode(lines: list[str]) -> str | None:
    """The "Operational Mode" from `show interfaces X switchport`:
    "trunk", "static access", "down", ... "routed" for a port with
    switchport disabled, None when the output isn't there (or isn't in
    a format we know)."""

    for line in lines:
        if line.strip() == SWITCHPORT_DISABLED:
            return "routed"
        match = OPERATIONAL_MODE_RE.match(line.strip())
        if match:
            return match.group("mode")
    return None


def _is_trunk(lines: list[str], operational_mode: str | None) -> bool:
    """A port is a trunk if it's configured as one OR is trunking right
    now: a port left in DTP "dynamic auto/desirable" (no "switchport
    mode" line at all) still trunks when the neighbour asks for it.
    Unknown operational mode counts as trunk, so the access-only
    controls stay locked when we can't tell."""

    if "switchport mode trunk" in lines:
        return True
    if operational_mode is None:
        return True
    return operational_mode.startswith("trunk")


def _value_after(lines: list[str], prefix: str) -> str:
    """The rest of the first line that is exactly `prefix` + one value,
    e.g. "switchport access vlan 20" -> "20"."""

    for line in lines:
        if (
            line.startswith(prefix + " ")
            and len(line.split()) == len(prefix.split()) + 1
        ):
            return line.split()[-1]
    return ""


def build_interface_config(
    name: str, lines: list[str], operational_mode: str | None
) -> InterfaceConfig:
    port_security: PortSecurity = "off"
    if PORT_SECURITY in lines:
        port_security = "sticky" if PORT_SECURITY_STICKY in lines else "on"

    return InterfaceConfig(
        interface=name,
        lines=lines,
        is_trunk=_is_trunk(lines, operational_mode),
        operational_mode=operational_mode or "",
        description=next(
            (
                line[len("description ") :]
                for line in lines
                if line.startswith("description ")
            ),
            "",
        ),
        access_vlan=_value_after(lines, "switchport access vlan"),
        voice_vlan=_value_after(lines, "switchport voice vlan"),
        mode_access=MODE_ACCESS in lines,
        port_security=port_security,
        port_security_max=_value_after(lines, "switchport port-security maximum"),
        shutdown="shutdown" in lines,
    )


def find_errors(output: str) -> list[str]:
    """IOS reports a rejected command as a line starting with "% "
    (syslog messages are "%FAC-SEV-MNEMONIC:", no space, so they don't
    match)."""

    return [line.strip() for line in _clean_lines(output) if line.startswith("% ")]
