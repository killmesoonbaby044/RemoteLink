"""Show-command builders and output parsers for switch lookup tasks.

Covers three sources with one parser, since they all share the same
`Vlan / Mac Address / Type / Ports` shape:

  show mac address-table static   - access-port bindings (no trunk
      false positives: a MAC learned only via a trunk shows up as
      DYNAMIC, so filtering on "static" already excludes it)
  show mac address-table dynamic  - the deliberate opposite: includes
      trunk-learned entries, so the same MAC may legitimately appear
      on several switches
  show port-security address      - the secure-MAC table; also has no
      trunk-flooding concern, since a secure MAC is only ever bound to
      the port it was learned/configured on

Filtering happens on the switch, not here: `build_mac_filter` turns the
suffix into the literal substring (dots included where a group boundary
falls inside it) to hand to IOS's own `| include`, so only matching
lines cross the SSH session at all.
"""

from __future__ import annotations

import re

from app.services.switch.schemas import MacEntry

# Vlan   Mac Address       Type          Ports        (anything after is ignored,
# 374    f832.e46e.3271    STATIC        Fa0/3          e.g. port-security's "Remaining Age")
MAC_LINE = re.compile(
    r"^(?P<vlan>\d+)\s+(?P<mac>[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+"
    r"(?P<type>\S+)\s+(?P<interface>\S+)",
    re.IGNORECASE | re.MULTILINE,
)


def build_mac_filter(suffix: str) -> str:
    """Turn a hex suffix into the literal substring IOS's `| include`
    should grep for, inserting the dots Cisco's xxxx.xxxx.xxxx format
    requires whenever the suffix spans a group boundary.

    e.g. "3271" (4 chars, fits in one group) -> "3271"
         "6e3271" (6 chars, crosses one boundary) -> "6e.3271"
    """

    hex_chars = suffix.lower().replace(".", "")

    if len(hex_chars) <= 4:
        return hex_chars

    if len(hex_chars) <= 8:
        split = len(hex_chars) - 4
        return f"{hex_chars[:split]}.{hex_chars[split:]}"

    first_split = len(hex_chars) - 8
    return f"{hex_chars[:first_split]}.{hex_chars[first_split:first_split + 4]}.{hex_chars[first_split + 4:]}"


def find_by_suffix(host: str, command_output: str, suffix: str) -> list[MacEntry]:
    hex_suffix = suffix.lower().replace(".", "")

    entries: list[MacEntry] = []
    for m in MAC_LINE.finditer(command_output):
        mac_digits = m.group("mac").lower().replace(".", "")
        if not mac_digits.endswith(hex_suffix):
            continue

        entries.append(
            MacEntry(
                host=host,
                vlan=m.group("vlan"),
                mac=m.group("mac"),
                type=m.group("type"),
                interface=m.group("interface"),
            )
        )

    return entries
