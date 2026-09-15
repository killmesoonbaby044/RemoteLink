"""Generic SQLite-backed JSON blob store, shared by every module that
needs 'read-modify-write, safe across replicas' persistence.

One class does it all: table setup + WAL mode (once, in __init__), raw
load/save of a single JSON blob, and the transaction wrapper
(asyncio.Lock + BEGIN IMMEDIATE + commit/rollback) that makes
read-validate-write atomic across replicas - no separate 'repository'
class needed.

Use directly for raw-dict storage (see DomainStore). Subclass and
override the transaction if you need typed models on top (see
InventoryStore) - override _transaction to load/parse before yielding,
and call self._save_raw(self._conn, ...) from your own _save().
"""

from __future__ import annotations

import asyncio
import json
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from app.config import APP_DB


class BlobStore:
    def __init__(self, path: Path = APP_DB, table: str = "blob"):
        self.path = path
        self.table = table
        self._lock = asyncio.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(
                f"CREATE TABLE IF NOT EXISTS {self.table} "
                "(id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)"
            )
            conn.execute(
                f"INSERT OR IGNORE INTO {self.table} (id, data) VALUES (1, ?)",
                (json.dumps({}),),
            )
            conn.commit()
        finally:
            conn.close()

    def _begin(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        conn.execute("BEGIN IMMEDIATE")
        return conn

    def _load_raw(self, conn: sqlite3.Connection) -> dict:
        row = conn.execute(f"SELECT data FROM {self.table} WHERE id = 1").fetchone()
        return json.loads(row[0]) if row else {}

    def _save_raw(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            f"UPDATE {self.table} SET data = ? WHERE id = 1", (json.dumps(data),)
        )

    @asynccontextmanager
    async def _transaction(self) -> AsyncIterator[sqlite3.Connection]:
        async with self._lock:
            conn = await asyncio.to_thread(self._begin)
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    # -- public API for modules that just want the raw dict (e.g. domain) --

    async def get(self) -> dict:
        async with self._transaction() as conn:
            return self._load_raw(conn)

    async def replace(self, data: dict) -> dict:
        async with self._transaction() as conn:
            self._save_raw(conn, data)
            return data


domain_store = BlobStore(table="domain_blob")
