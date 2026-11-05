"""Show-command builders and output parsers for switch lookup tasks.

Covers three sources with one parser, since they all share the same
`Vlan / Mac Address / Type / Ports` shape (the access lookup runs the
static MAC table and the port-security table together, in one session):

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

from app.services.switch.mac_lookup.schemas import (
    MAC_TABLE,
    PORT_SECURITY_TABLE,
    ErrDisabledEntry,
    MacEntry,
)

# Vlan   Mac Address       Type          Ports        (anything after is ignored,
# 374    f832.e46e.3271    STATIC        Fa0/3          e.g. port-security's "Remaining Age")
# Many IOS versions indent these rows, so leading spaces are allowed.
MAC_LINE = re.compile(
    r"^[ \t]*(?P<vlan>\d+)\s+(?P<mac>[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+"
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


def _source_of(entry_type: str) -> str:
    """Both tables land in one combined output, so the Type column is
    what tells them apart: port-security types are always Secure*
    (SecureSticky, SecureConfigured, SecureDynamic), the MAC table's
    never are (STATIC, DYNAMIC)."""

    return PORT_SECURITY_TABLE if entry_type.lower().startswith("secure") else MAC_TABLE


def find_by_suffix(host: str, command_output: str, suffix: str) -> list[MacEntry]:
    """Parses the matches and merges an entry found in both tables into
    one row: sticky/configured secure MACs also show up in the MAC table
    as STATIC on the same port. The port-security row wins (SecureSticky
    says more than STATIC), and `sources` keeps both tables."""

    hex_suffix = suffix.lower().replace(".", "")

    merged: dict[tuple[str, str, str], MacEntry] = {}
    for m in MAC_LINE.finditer(command_output):
        mac_digits = m.group("mac").lower().replace(".", "")
        if hex_suffix not in mac_digits:
            continue

        entry_type = m.group("type")
        source = _source_of(entry_type)
        key = (m.group("vlan"), m.group("mac").lower(), m.group("interface").lower())

        existing = merged.get(key)
        if existing is None:
            merged[key] = MacEntry(
                vlan=m.group("vlan"),
                mac=m.group("mac"),
                type=entry_type,
                interface=m.group("interface"),
                sources=[source],
            )
            continue

        if source not in existing.sources:
            existing.sources.append(source)
            existing.sources.sort()  # always "M" before "S"
        if source == PORT_SECURITY_TABLE:
            existing.type = entry_type

    return list(merged.values())


# show interfaces status err-disabled:
# Port      Name               Status       Reason               Err-disabled Vlans
# Gi1/0/5   PC desk 12         err-disabled psecure-violation
# The description may be empty or contain spaces, so it's whatever sits
# between the port and the status column. Case-sensitive on purpose: the
# header's "Err-disabled Vlans" must not match as a row. The port must
# look like one (letters then a digit, no prompt characters) so an echoed
# "sw1#show interfaces status err-disabled" line isn't taken as a row.
ERR_DISABLED_LINE = re.compile(
    r"^(?P<interface>[A-Za-z][^\s#>]*\d[^\s#>]*)[ \t]+(?P<description>.*?)[ \t]*\berr-disabled\b(?:[ \t]+(?P<reason>\S+))?",
    re.MULTILINE,
)


def find_err_disabled(host: str, command_output: str) -> list[ErrDisabledEntry]:
    return [
        ErrDisabledEntry(
            interface=m.group("interface"),
            description=m.group("description"),
            reason=m.group("reason") or "",
        )
        for m in ERR_DISABLED_LINE.finditer(command_output)
        if m.group("interface") != "Port"
    ]
