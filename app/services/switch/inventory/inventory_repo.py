"""Persistence for the switch inventory: turns the raw JSON blob (from
BlobStore) into Host/Group/RootPoint maps and back.

Composes BlobStore's generic transaction/blob machinery and adds the
inventory-specific parsing on top. SwitchInventoryService owns every
domain rule (cycle checks, "still referenced" checks, etc.) and drives
this repo's `_transaction()` / `_save()` / `_referenced_by()` directly -
this class only knows the shape of the data, not the rules around it.
"""

from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from typing import AsyncIterator

from app.core.database.blob_store import BlobStore
from app.services.switch.schemas import Group, Host, RootPoint


class InventoryRepository(BlobStore):
    def __init__(self, table: str = "inventory_blob"):
        super().__init__(table=table)
        self.hosts: dict[str, Host] = {}
        self.groups: dict[str, Group] = {}
        self.root_points: dict[str, RootPoint] = {}
        self.conn: sqlite3.Connection | None = None

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[None]:
        async with super()._transaction() as conn:
            self.conn = conn
            raw = self._load_raw(conn)
            self.hosts = {n: Host(name=n, **f) for n, f in raw.get("hosts", {}).items()}
            self.groups = {
                n: Group(name=n, members=f["members"])
                for n, f in raw.get("groups", {}).items()
            }
            self.root_points = {
                n: RootPoint(name=n, members=f["members"])
                for n, f in raw.get("root_points", {}).items()
            }
            try:
                yield
            finally:
                self.conn = None

    def save(self) -> None:
        data = {
            "hosts": {
                h.name: h.model_dump(exclude={"name"}) for h in self.hosts.values()
            },
            "groups": {
                g.name: g.model_dump(exclude={"name"}) for g in self.groups.values()
            },
            "root_points": {
                r.name: r.model_dump(exclude={"name"})
                for r in self.root_points.values()
            },
        }
        self._save_raw(self.conn, data)

    def referenced_by(self, name: str) -> list[str]:
        """Which groups or root points list `name` as a member - used to
        block deleting a host or group that's still in use elsewhere."""
        refs = [g.name for g in self.groups.values() if name in g.members]
        refs += [r.name for r in self.root_points.values() if name in r.members]
        return refs
