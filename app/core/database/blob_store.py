from __future__ import annotations
import asyncio, sqlite3
from contextlib import asynccontextmanager
from typing import AsyncIterator
from app.core.database.blob_repository import BlobRepository


class BlobStore:
    def __init__(self, repo: BlobRepository):
        self._repo = repo
        self._lock = asyncio.Lock()
        self._conn: sqlite3.Connection | None = None

    @asynccontextmanager
    async def _transaction(self) -> AsyncIterator[None]:
        async with self._lock:
            conn = await asyncio.to_thread(self._repo.begin)
            self._conn = conn
            try:
                yield
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
                self._conn = None

    async def get(self) -> dict:
        async with self._transaction():
            return self._repo.load(self._conn)

    async def replace(self, data: dict) -> dict:
        async with self._transaction():
            self._repo.save(self._conn, data)
            return data


domain_store = BlobStore(BlobRepository(table="domain_blob"))
