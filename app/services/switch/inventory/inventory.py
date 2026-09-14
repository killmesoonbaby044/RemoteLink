"""Domain logic for the switch inventory: hosts, nested groups, root
points, cycle detection, and referencing checks.

Persistence is a single JSON blob stored in SQLite (see
inventory_repository.py), with three top-level maps - hosts, groups, and
root_points. A group's `members` list can contain host names or other
group names, so groups can nest arbitrarily deep; `resolve_group`
flattens that recursively, and `add_group` rejects a cycle up front
rather than letting it surface later whenever something happens to
resolve that group.

This app runs as a few replicas against the same inventory file, so
every operation re-reads the current state and does its
read-validate-write cycle inside one SQLite transaction (see
`_transaction` below) rather than trusting an in-memory cache - that's
what keeps two replicas from silently clobbering each other's writes.

A root point sits one level above groups (e.g. one root point per
building, containing the groups/hosts that belong to that building).
Root points are always top-level: their `members` list may only name
hosts or groups, never another root point, and - since `add_group`
only ever accepts host/group names as members - nothing can ever name
a root point as a member either. So a root point can never take part
in a cycle and needs no cycle check of its own.

Only connection identity (name/ip/port) lives here. Login credentials
are never stored - they're supplied by the caller on every task request
(see app/api/routes/switch_tasks.py).

Add to app/config.py:
    INVENTORY_FILE = DATA_DIR / "inventory.db"

If you're migrating an existing inventory.json, one-time step: load it
with the old InventoryRepository, then call the new repository's
begin()/save()/commit() once to seed the SQLite file with the same data.
"""

from __future__ import annotations

import asyncio
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from app.config import INVENTORY_DB
from app.services.switch.inventory.inventory_repo import InventoryRepository
from app.services.switch.schemas import Group, Host, RootPoint


class InventoryError(Exception):
    """Base class for all inventory domain errors."""


class NotFoundError(InventoryError):
    """An unknown host, group, or root point name was requested."""


class ValidationError(InventoryError):
    """The request itself is bad: unknown member, would-be cycle, etc."""


class ConflictError(InventoryError):
    """The request is well-formed but conflicts with current state,
    e.g. deleting something that's still referenced elsewhere."""


class InventoryStore:
    """View over the inventory, backed by an InventoryRepository.

    One instance (see `inventory_store` below) is enough per process,
    but several processes/replicas can run against the same underlying
    file. Every read or write goes through `_transaction`, which:

    1. Acquires this process's `asyncio.Lock`, so coroutines within the
       same process can't interleave.
    2. Opens a SQLite write transaction (`BEGIN IMMEDIATE`) for the
       whole call, so a concurrent replica trying to do the same is
       blocked until this one commits or rolls back.
    3. Loads fresh state from the repository every time - no
       load-once caching - so every replica always acts on the latest
       committed data instead of a stale in-memory copy.

    `self._hosts` / `_groups` / `_root_points` are only valid for the
    duration of one `_transaction()` block; they're throwaway locals
    reloaded each call, not long-lived state.
    """

    def __init__(self, path: Path = INVENTORY_DB):
        self._repo = InventoryRepository(path)
        self._lock = asyncio.Lock()
        self._hosts: dict[str, Host] = {}
        self._groups: dict[str, Group] = {}
        self._root_points: dict[str, RootPoint] = {}
        self._conn: sqlite3.Connection | None = None

    @asynccontextmanager
    async def _transaction(self) -> AsyncIterator[None]:
        async with self._lock:
            # begin() can block waiting on another replica's open
            # transaction, so hop off the event loop for that part.
            conn = await asyncio.to_thread(self._repo.begin)
            self._conn = conn
            try:
                self._hosts, self._groups, self._root_points = self._repo.load(conn)
                yield
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
                self._conn = None

    def _save(self) -> None:
        self._repo.save(self._conn, self._hosts, self._groups, self._root_points)

    def _referenced_by(self, name: str) -> list[str]:
        """Which groups or root points list `name` as a member - used to
        block deleting a host or group that's still in use elsewhere."""
        refs = [g.name for g in self._groups.values() if name in g.members]
        refs += [r.name for r in self._root_points.values() if name in r.members]
        return refs

    # -- hosts -------------------------------------------------------------

    async def add_host(self, host: Host) -> None:
        async with self._transaction():
            if host.name in self._hosts:
                raise ConflictError(f"Host {host.name!r} already exist")
            self._hosts[host.name] = host
            self._save()

    async def list_hosts(self) -> list[Host]:
        async with self._transaction():
            return list(self._hosts.values())

    async def get_host(self, name: str) -> Host:
        async with self._transaction():
            if name not in self._hosts:
                raise NotFoundError(f"Unknown host '{name}'")
            return self._hosts[name]

    async def delete_host(self, name: str) -> None:
        async with self._transaction():
            if name not in self._hosts:
                raise NotFoundError(f"Unknown host '{name}'")
            referencing = self._referenced_by(name)
            if referencing:
                raise ConflictError(
                    f"'{name}' is still a member of: {', '.join(referencing)}"
                )
            del self._hosts[name]
            self._save()

    async def update_host(self, name: str, host: Host) -> Host:
        async with self._transaction():
            if name not in self._hosts:
                raise NotFoundError(f"Unknown host '{name}'")
            if host.name != name:
                raise ValidationError(
                    "Renaming a host isn't supported - delete it and add it"
                    " again under the new name."
                )
            self._hosts[name] = host
            self._save()
            return host

    # -- groups --------------------------------------------------------------

    async def add_group(self, group: Group) -> None:
        async with self._transaction():
            if group.name in self._groups:
                raise ConflictError(f"Group {group.name!r} already exist")
            for member in group.members:
                known = member in self._hosts or member in self._groups
                if not known and member != group.name:
                    raise ValidationError(
                        f"Unknown member '{member}' for group '{group.name}'"
                    )

            # Validate at write-time: simulate the group being added
            # (without committing it yet) and check for a cycle,
            # including the direct self-reference case, before saving.
            trial_groups = {**self._groups, group.name: group}
            self._check_for_cycle(group.name, trial_groups, visiting=set())

            self._groups[group.name] = group
            self._save()

    async def list_groups(self) -> list[Group]:
        async with self._transaction():
            return list(self._groups.values())

    async def get_group(self, name: str) -> Group:
        async with self._transaction():
            if name not in self._groups:
                raise NotFoundError(f"Unknown group '{name}'")
            return self._groups[name]

    async def delete_group(self, name: str) -> None:
        async with self._transaction():
            if name not in self._groups:
                raise NotFoundError(f"Unknown group '{name}'")
            referencing = self._referenced_by(name)
            if referencing:
                raise ConflictError(
                    f"'{name}' is still a member of: {', '.join(referencing)}"
                )
            del self._groups[name]
            self._save()

    async def update_group(self, name: str, group: Group) -> Group:
        async with self._transaction():
            if name not in self._groups:
                raise NotFoundError(f"Unknown group '{name}'")
            if group.name != name:
                raise ValidationError(
                    "Renaming a group isn't supported - delete it and add it"
                    " again under the new name."
                )
            for member in group.members:
                known = member in self._hosts or member in self._groups
                if not known and member != group.name:
                    raise ValidationError(
                        f"Unknown member '{member}' for group '{group.name}'"
                    )

            trial_groups = {**self._groups, group.name: group}
            self._check_for_cycle(group.name, trial_groups, visiting=set())

            self._groups[name] = group
            self._save()
            return group

    async def add_group_member(self, name: str, member: str) -> Group:
        async with self._transaction():
            if name not in self._groups:
                raise NotFoundError(f"Unknown group '{name}'")
            group = self._groups[name]
            if member in group.members:
                return group

            known = member in self._hosts or member in self._groups
            if not known:
                raise ValidationError(f"Unknown member '{member}' for group '{name}'")

            updated = Group(name=group.name, members=[*group.members, member])
            trial_groups = {**self._groups, name: updated}
            self._check_for_cycle(name, trial_groups, visiting=set())

            self._groups[name] = updated
            self._save()
            return updated

    async def remove_group_member(self, name: str, member: str) -> Group:
        async with self._transaction():
            if name not in self._groups:
                raise NotFoundError(f"Unknown group '{name}'")
            group = self._groups[name]
            if member not in group.members:
                return group

            updated = Group(
                name=group.name, members=[m for m in group.members if m != member]
            )
            self._groups[name] = updated
            self._save()
            return updated

    # -- root points -----------------------------------------------------------
    #
    # A root point's members may only be host or group names - never
    # another root point. Nothing else can ever name a root point as a
    # member (groups only accept host/group names, see add_group above),
    # so a root point can never sit inside a cycle and there's no
    # equivalent of `_check_for_cycle` to run here.

    async def add_root_point(self, root: RootPoint) -> None:
        async with self._transaction():
            if root.name in self._root_points:
                raise ConflictError(f"Root_point {root.name!r}  already exist")
            for member in root.members:
                known = member in self._hosts or member in self._groups
                if not known:
                    raise ValidationError(
                        f"Unknown member '{member}' for root point '{root.name}'"
                    )
            self._root_points[root.name] = root
            self._save()

    async def list_root_points(self) -> list[RootPoint]:
        async with self._transaction():
            return list(self._root_points.values())

    async def get_root_point(self, name: str) -> RootPoint:
        async with self._transaction():
            if name not in self._root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            return self._root_points[name]

    async def delete_root_point(self, name: str) -> None:
        async with self._transaction():
            if name not in self._root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            # Nothing can reference a root point, so there's no
            # "still referenced" check needed before removing it.
            del self._root_points[name]
            self._save()

    async def update_root_point(self, name: str, root: RootPoint) -> RootPoint:
        async with self._transaction():
            if name not in self._root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            if root.name != name:
                raise ValidationError(
                    "Renaming a root point isn't supported - delete it and"
                    " add it again under the new name."
                )
            for member in root.members:
                known = member in self._hosts or member in self._groups
                if not known:
                    raise ValidationError(
                        f"Unknown member '{member}' for root point '{root.name}'"
                    )
            self._root_points[name] = root
            self._save()
            return root

    async def add_root_point_member(self, name: str, member: str) -> RootPoint:
        async with self._transaction():
            if name not in self._root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            root = self._root_points[name]
            if member in root.members:
                return root

            known = member in self._hosts or member in self._groups
            if not known:
                raise ValidationError(
                    f"Unknown member '{member}' for root point '{name}'"
                )

            updated = RootPoint(name=root.name, members=[*root.members, member])
            self._root_points[name] = updated
            self._save()
            return updated

    async def remove_root_point_member(self, name: str, member: str) -> RootPoint:
        async with self._transaction():
            if name not in self._root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            root = self._root_points[name]
            if member not in root.members:
                return root

            updated = RootPoint(
                name=root.name, members=[m for m in root.members if m != member]
            )
            self._root_points[name] = updated
            self._save()
            return updated

    # -- resolution --------------------------------------------------------

    async def resolve_group(self, name: str) -> list[Host]:
        """Flatten a group (or a bare host) name into its list of Hosts,
        recursing into nested groups and de-duplicating."""

        async with self._transaction():
            if name in self._hosts:
                return [self._hosts[name]]

            if name not in self._groups:
                raise NotFoundError(f"Unknown host or group '{name}'")

            found: dict[str, Host] = {}
            self._resolve_into(name, found, visiting=set())
            return list(found.values())

    async def resolve_root_point(self, name: str) -> list[Host]:
        """Flatten every group/host under a root point into a de-duplicated
        list of Hosts - one call to get every host in a building."""

        async with self._transaction():
            if name not in self._root_points:
                raise NotFoundError(f"Unknown root point '{name}'")

            found: dict[str, Host] = {}
            for member in self._root_points[name].members:
                self._resolve_into(member, found, visiting=set())
            return list(found.values())

    async def resolve_for_lookup(self, names: list[str]) -> list[Host]:
        """Flatten every root/group into a de-duplicated
        list of Hosts - one call to get every requested root/group."""
        found: dict[str, Host] = {}

        async with self._transaction():
            for name in names:
                if name in self._root_points:
                    type_obj = self._root_points
                elif name in self._groups:
                    type_obj = self._groups
                elif name in self._hosts:
                    self._resolve_into(name, found, visiting=set())
                    continue

                else:
                    raise NotFoundError(f"Unknown root point or group '{name}'")

                for member in type_obj[name].members:
                    self._resolve_into(member, found, visiting=set())

            return list(found.values())

    def _resolve_into(
        self, name: str, out: dict[str, Host], visiting: set[str]
    ) -> None:
        if name in self._hosts:
            out[name] = self._hosts[name]
            return

        if name not in self._groups:
            raise NotFoundError(f"Unknown host or group '{name}'")

        if name in visiting:
            raise InventoryError(f"Group cycle detected at '{name}'")

        visiting.add(name)
        for member in self._groups[name].members:
            self._resolve_into(member, out, visiting)
        visiting.discard(name)

    def _check_for_cycle(
        self, name: str, groups: dict[str, Group], visiting: set[str]
    ) -> None:
        """Walks group -> group edges only (hosts are always leaves, so
        they can't be part of a cycle) against a not-yet-committed
        `groups` mapping, so add_group can reject a bad write before it
        ever reaches disk."""

        if name not in groups:
            return  # a host, or an already-validated member

        if name in visiting:
            raise ValidationError(f"Group cycle detected at '{name}'")

        visiting.add(name)
        for member in groups[name].members:
            self._check_for_cycle(member, groups, visiting)
        visiting.discard(name)


# Shared singleton - import this rather than constructing InventoryStore yourself.
inventory_store = InventoryStore()
