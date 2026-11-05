"""Request/response models for the interface-config page, plus the input
checks that keep anything typed on the page from becoming a second IOS
command."""

from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.services.switch.schemas import SwitchRequest

# Gi1/0/9, Fa0/3, Te1/1/1, Po1, GigabitEthernet1/0/9.100 - letters, then
# digits separated by "/" with an optional ".subif". Nothing that could
# smuggle a second command onto the line.
INTERFACE_RE = re.compile(r"^[A-Za-z][A-Za-z-]*\d+(?:/\d+)*(?:\.\d+)?$")

# 10 / 10,20 / 10-20,30 - the syntax "switchport trunk allowed vlan add" takes.
VLAN_LIST_RE = re.compile(r"^\d{1,4}(?:-\d{1,4})?(?:,\d{1,4}(?:-\d{1,4})?)*$")

# Upper bound for VLAN ids accepted from the page. Standard IOS stops at
# 4094 - anything above that is passed through and the switch's own
# "% ..." error is shown to the user.
VLAN_MAX = 9999

PortSecurity = Literal["sticky", "on", "off"]
InterfaceAction = Literal["enable", "disable", "restart", "clear-sticky", "reset-port-security"]


def check_cli_text(value: str) -> str:
    """Rejects anything that would change what IOS does with the line
    beyond its literal text: a newline (second command), "?" (IOS
    context help fires on it mid-line) or other control characters."""

    if any(ch in value for ch in "\r\n?") or any(ord(ch) < 32 for ch in value):
        raise ValueError("must not contain newlines, '?' or control characters")
    return value


def check_optional_number(value: Optional[str], low: int, high: int) -> Optional[str]:
    """None = leave unchanged, "" = remove the setting, digits = set it."""

    if value is None:
        return None
    value = value.strip()
    if value and (not value.isdigit() or not low <= int(value) <= high):
        raise ValueError(f"must be a number from {low} to {high}")
    return value


class InterfaceStatus(BaseModel):
    port: str
    description: str = ""
    status: str = ""
    vlan: str = ""  # access VLAN number, "trunk", "routed", ...


class InterfacesResponse(BaseModel):
    host: str
    interfaces: list[InterfaceStatus]


class Vlan(BaseModel):
    id: str
    name: str = ""
    status: str = ""  # active, act/lshut, suspended, ...


class VlansResponse(BaseModel):
    host: str
    vlans: list[Vlan]


class InterfaceRequest(SwitchRequest):
    interface: str

    @field_validator("interface")
    @classmethod
    def _check_interface(cls, value: str) -> str:
        if not INTERFACE_RE.match(value):
            raise ValueError(f"not a valid interface name: {value!r}")
        return value


class InterfaceConfig(BaseModel):
    interface: str
    lines: list[str]  # "show run int" body, one stripped line per entry
    is_trunk: bool
    # From "show interfaces X switchport": "trunk", "static access",
    # "down", "routed"; "" when it couldn't be read.
    operational_mode: str = ""

    # Parsed from `lines`, used to pre-fill the form.
    description: str = ""
    access_vlan: str = ""
    # a number, or "dot1p" / "untagged" / "none" as IOS writes them
    voice_vlan: str = ""
    mode_access: bool = False
    port_security: PortSecurity = "off"
    port_security_max: str = ""
    shutdown: bool = False


class InterfaceApplyRequest(InterfaceRequest):
    """Desired values for the fields the page shows. None = unchanged.
    For text/number fields "" means "remove the setting". A field equal
    to what the switch already has generates no command."""

    dry_run: bool = False  # build and return the commands, send nothing

    # access port only
    remove_lines: list[str] = Field(default_factory=list)
    extra_lines: list[str] = Field(default_factory=list)  # typed in by hand
    access_vlan: Optional[str] = None
    voice_vlan: Optional[str] = None
    port_security: Optional[PortSecurity] = None
    port_security_max: Optional[str] = None

    # trunk port only
    trunk_add_vlans: Optional[str] = None
    trunk_remove_vlans: Optional[str] = None

    # both
    description: Optional[str] = Field(default=None, max_length=240)

    @field_validator("remove_lines", "extra_lines")
    @classmethod
    def _check_lines(cls, value: list[str]) -> list[str]:
        lines = [check_cli_text(line).strip() for line in value]
        return [line for line in lines if line]

    @field_validator("description")
    @classmethod
    def _check_description(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else check_cli_text(value.strip())

    @field_validator("access_vlan", "voice_vlan")
    @classmethod
    def _check_access_vlan(cls, value: Optional[str]) -> Optional[str]:
        return check_optional_number(value, 1, VLAN_MAX)

    @field_validator("port_security_max")
    @classmethod
    def _check_max(cls, value: Optional[str]) -> Optional[str]:
        return check_optional_number(value, 1, 4096)

    @field_validator("trunk_add_vlans", "trunk_remove_vlans")
    @classmethod
    def _check_vlan_list(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").replace(" ", "")
        if not value:
            return None
        if not VLAN_LIST_RE.match(value):
            raise ValueError("expected a VLAN list like 10 or 10,20-30")
        if any(not 1 <= int(v) <= VLAN_MAX for v in re.split(r"[,-]", value)):
            raise ValueError(f"VLAN ids must be 1-{VLAN_MAX}")
        return value


class InterfaceRevertRequest(InterfaceRequest):
    before_lines: list[str]  # the "show run int" body to go back to

    @field_validator("before_lines")
    @classmethod
    def _check_lines(cls, value: list[str]) -> list[str]:
        return [check_cli_text(line) for line in value]


class InterfaceActionRequest(InterfaceRequest):
    action: InterfaceAction


class InterfaceChangeResponse(BaseModel):
    commands: list[str]  # exactly what was (or, for dry_run, would be) sent
    before: InterfaceConfig
    after: Optional[InterfaceConfig] = None  # None for dry_run
    errors: list[str] = Field(default_factory=list)  # IOS "% ..." lines
    output: str = ""  # raw session transcript


class WriteMemoryResponse(BaseModel):
    ok: bool
    output: str
