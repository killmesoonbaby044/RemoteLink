from __future__ import annotations
import json
import sqlite3
from pathlib import Path

from app.config import INVENTORY_DB


class BlobRepository:
    def __init__(self, path: Path = INVENTORY_DB, table: str = "blob"):
        self.path, self.table = path, table
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

    def begin(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        conn.execute("BEGIN IMMEDIATE")
        return conn

    def load(self, conn: sqlite3.Connection) -> dict:
        row = conn.execute(f"SELECT data FROM {self.table} WHERE id = 1").fetchone()
        return json.loads(row[0]) if row else {}

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            f"UPDATE {self.table} SET data = ? WHERE id = 1", (json.dumps(data),)
        )
