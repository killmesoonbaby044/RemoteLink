"""Request/response models for the MAC lookup."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.services.network.schemas import HostTaskResult

# Which table a MAC entry was found in: "M" - show mac address-table,
# "S" - show port-security address. An entry in both has both.
MAC_TABLE = "M"
PORT_SECURITY_TABLE = "S"


class MacEntry(BaseModel):
    vlan: str
    mac: str
    type: str  # e.g. STATIC, DYNAMIC, SecureSticky, SecureConfigured
    interface: str
    sources: list[str] = Field(default_factory=list)


class ErrDisabledEntry(BaseModel):
    interface: str
    description: str
    reason: str  # e.g. psecure-violation, bpduguard, link-flap


class LookupTargetRequest(BaseModel):
    group: list[str]  # a host name or a group name from the inventory
    kind: Literal["root", "group", "host"] | None = None  # what `group` names, if known
    username: str
    password: str


class MacLookupRequest(LookupTargetRequest):
    mac_suffix: str  # last few hex chars of the MAC you're hunting for


class MacLookupResponse(BaseModel):
    results: list[HostTaskResult]
