"""SQLite-backed persistence for the switch inventory.

Same responsibility as before: turn stored data into Host/Group/RootPoint
objects and back. InventoryStore still owns every domain rule (cycle
checks, "still referenced" checks, etc.) - this module only knows how to
read and write.

Storage shape: the whole inventory is kept as a single JSON blob in one
row (`inventory_blob`), so nothing about the on-disk *shape* of the data
changed - only how it's read and written did. What changed vs. the old
plain-JSON-file version:

- Every read-modify-write cycle now happens inside one SQLite
  transaction opened with `BEGIN IMMEDIATE`, which grabs SQLite's write
  lock immediately. If another replica already has a transaction open,
  this call blocks until it commits/rolls back, instead of both
  processes reading the same old state and racing to write - that race
  is what caused silent lost updates with the old load-once-then-write
  file scheme.
- WAL mode (`PRAGMA journal_mode=WAL`) is enabled once, at startup, so
  plain reads aren't blocked while a write transaction is in progress
  elsewhere.
- There's no more "load once, cache forever" - InventoryStore now calls
  `load()` fresh inside every transaction, so every replica always sees
  the latest committed data.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Iterator

from app.services.switch.schemas import Group, Host, RootPoint

_SCHEMA = """
CREATE TABLE IF NOT EXISTS inventory_blob (
    id   INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
)
"""

_EMPTY = json.dumps({"hosts": {}, "groups": {}, "root_points": {}})


class InventoryRepository:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # One-time setup: turn on WAL and make sure the table + the single
        # seed row exist, so every later transaction can assume row id=1
        # is there.
        conn = sqlite3.connect(self.path)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(_SCHEMA)
            conn.execute(
                "INSERT OR IGNORE INTO inventory_blob (id, data) VALUES (1, ?)",
                (_EMPTY,),
            )
            conn.commit()
        finally:
            conn.close()

    def begin(self) -> sqlite3.Connection:
        """Open a connection and start a write transaction. `BEGIN
        IMMEDIATE` acquires SQLite's write lock right away instead of
        waiting until the first write statement, so the whole
        load -> validate -> save sequence the caller does next is
        protected as one atomic unit against every other replica.

        This is a blocking call (it can wait on another replica's open
        transaction) - callers on an event loop should run it via
        asyncio.to_thread rather than calling it directly.

        The caller is responsible for conn.commit() / conn.rollback()
        and conn.close() once it's done - see InventoryStore._transaction.
        """
        conn = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        conn.execute("BEGIN IMMEDIATE")
        return conn

    def load(
        self, conn: sqlite3.Connection
    ) -> tuple[dict[str, Host], dict[str, Group], dict[str, RootPoint]]:
        row = conn.execute("SELECT data FROM inventory_blob WHERE id = 1").fetchone()
        raw = json.loads(row[0]) if row else {}

        hosts = {
            name: Host(name=name, **fields)
            for name, fields in raw.get("hosts", {}).items()
        }
        groups = {
            name: Group(name=name, members=fields["members"])
            for name, fields in raw.get("groups", {}).items()
        }
        # .get(..., {}) so inventories written before root points existed
        # still load fine, with an empty root_points map.
        root_points = {
            name: RootPoint(name=name, members=fields["members"])
            for name, fields in raw.get("root_points", {}).items()
        }
        return hosts, groups, root_points

    def save(
        self,
        conn: sqlite3.Connection,
        hosts: dict[str, Host],
        groups: dict[str, Group],
        root_points: dict[str, RootPoint],
    ) -> None:
        data = {
            "hosts": {h.name: h.model_dump(exclude={"name"}) for h in hosts.values()},
            "groups": {g.name: g.model_dump(exclude={"name"}) for g in groups.values()},
            "root_points": {
                r.name: r.model_dump(exclude={"name"}) for r in root_points.values()
            },
        }
        conn.execute(
            "UPDATE inventory_blob SET data = ? WHERE id = 1",
            (json.dumps(data),),
        )
