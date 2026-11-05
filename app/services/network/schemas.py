"""Pydantic models shared across the switch package (inventory, the SSH
runtime, and every task folder). Feature-specific models live next to
their feature (mac_lookup/schemas.py, interface/schemas.py) and build on
these."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class SSHScriptQueryParams(BaseModel):
    host: Optional[str] = None


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


class SwitchRequest(BaseModel):
    host: str = Field(min_length=1)  # host name from the inventory
    username: str
    password: str
