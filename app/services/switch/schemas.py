"""Pydantic models shared across the switch package (inventory,
switch_runtime, switch_scripts) - kept here so those modules only
depend on this one and never on each other."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class Host(BaseModel):
    name: str = Field(min_length=1)
    address: str = Field(min_length=1)
    port: int = 22
    description: str = "cisco_ios"


class Group(BaseModel):
    name: str = Field(min_length=1)
    members: list[str] = Field(default_factory=list)  # host names and/or group names


class RootPoint(BaseModel):
    name: str = Field(min_length=1)
    members: list[str] = Field(default_factory=list)


class CommandResult(BaseModel):
    host: str
    ok: bool
    output: str = ""
    error: str = ""


class HostTaskResult(BaseModel):
    host: str
    address: str
    ok: bool
    matches: list[Any] = Field(default_factory=list)
    error: str = ""


class MacEntry(BaseModel):
    vlan: str
    mac: str
    type: str  # e.g. STATIC, DYNAMIC, SecureSticky, SecureConfigured
    interface: str


class MacLookupRequest(BaseModel):
    group: list[str]  # a host name or a group name from the inventory
    username: str
    password: str
    mac_suffix: str  # last few hex chars of the MAC you're hunting for


class MacLookupResponse(BaseModel):
    results: list[HostTaskResult]
