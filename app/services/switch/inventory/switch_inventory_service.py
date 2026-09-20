"""Domain logic for the switch inventory: hosts, nested groups, root
points, cycle detection, and referencing checks.

Persistence and blob parsing live in InventoryRepository - this class
owns every domain rule and drives the repo's transaction directly, so
resolution methods (which recurse in-memory over the loaded maps) stay
inside the same transaction as everything else instead of opening one
transaction per lookup.
"""

from __future__ import annotations

from app.services.switch.inventory.inventory_errors import (
    ConflictError,
    NotFoundError,
    ValidationError,
    InventoryError,
)
from app.services.switch.inventory.inventory_repo import InventoryRepository
from app.services.switch.schemas import Group, Host, RootPoint


class SwitchInventoryService:
    def __init__(self, table: str = "inventory_blob"):
        self._repo = InventoryRepository(table=table)

    # -- hosts -------------------------------------------------------------

    async def add_host(self, host: Host) -> None:
        async with self._repo.transaction():
            if host.name in self._repo.hosts:
                raise ConflictError(f"Host {host.name!r} already exist")
            self._repo.hosts[host.name] = host
            self._repo.save()

    async def list_hosts(self) -> list[Host]:
        async with self._repo.transaction():
            return list(self._repo.hosts.values())

    async def get_host(self, name: str) -> Host:
        async with self._repo.transaction():
            if name not in self._repo.hosts:
                raise NotFoundError(f"Unknown host '{name}'")
            return self._repo.hosts[name]

    async def delete_host(self, name: str) -> None:
        async with self._repo.transaction():
            if name not in self._repo.hosts:
                raise NotFoundError(f"Unknown host '{name}'")
            referencing = self._repo.referenced_by(name)
            if referencing:
                raise ConflictError(
                    f"'{name}' is still a member of: {', '.join(referencing)}"
                )
            del self._repo.hosts[name]
            self._repo.save()

    async def update_host(self, name: str, host: Host) -> Host:
        async with self._repo.transaction():
            if name not in self._repo.hosts:
                raise NotFoundError(f"Unknown host '{name}'")
            if host.name != name:
                raise ValidationError(
                    "Renaming a host isn't supported - delete it and add it"
                    " again under the new name."
                )
            self._repo.hosts[name] = host
            self._repo.save()
            return host

    # -- groups --------------------------------------------------------------

    async def add_group(self, group: Group) -> None:
        async with self._repo.transaction():
            if group.name in self._repo.groups:
                raise ConflictError(f"Group {group.name!r} already exist")
            for member in group.members:
                known = member in self._repo.hosts or member in self._repo.groups
                if not known and member != group.name:
                    raise ValidationError(
                        f"Unknown member '{member}' for group '{group.name}'"
                    )

            trial_groups = {**self._repo.groups, group.name: group}
            self._check_for_cycle(group.name, trial_groups, visiting=set())

            self._repo.groups[group.name] = group
            self._repo.save()

    async def list_groups(self) -> list[Group]:
        async with self._repo.transaction():
            return list(self._repo.groups.values())

    async def get_group(self, name: str) -> Group:
        async with self._repo.transaction():
            if name not in self._repo.groups:
                raise NotFoundError(f"Unknown group '{name}'")
            return self._repo.groups[name]

    async def delete_group(self, name: str) -> None:
        async with self._repo.transaction():
            if name not in self._repo.groups:
                raise NotFoundError(f"Unknown group '{name}'")
            referencing = self._repo.referenced_by(name)
            if referencing:
                raise ConflictError(
                    f"'{name}' is still a member of: {', '.join(referencing)}"
                )
            del self._repo.groups[name]
            self._repo.save()

    async def update_group(self, name: str, group: Group) -> Group:
        async with self._repo.transaction():
            if name not in self._repo.groups:
                raise NotFoundError(f"Unknown group '{name}'")
            if group.name != name:
                raise ValidationError(
                    "Renaming a group isn't supported - delete it and add it"
                    " again under the new name."
                )
            for member in group.members:
                known = member in self._repo.hosts or member in self._repo.groups
                if not known and member != group.name:
                    raise ValidationError(
                        f"Unknown member '{member}' for group '{group.name}'"
                    )

            trial_groups = {**self._repo.groups, group.name: group}
            self._check_for_cycle(group.name, trial_groups, visiting=set())

            self._repo.groups[name] = group
            self._repo.save()
            return group

    async def add_group_member(self, name: str, member: str) -> Group:
        async with self._repo.transaction():
            if name not in self._repo.groups:
                raise NotFoundError(f"Unknown group '{name}'")
            group = self._repo.groups[name]
            if member in group.members:
                return group

            known = member in self._repo.hosts or member in self._repo.groups
            if not known:
                raise ValidationError(f"Unknown member '{member}' for group '{name}'")

            updated = Group(name=group.name, members=[*group.members, member])
            trial_groups = {**self._repo.groups, name: updated}
            self._check_for_cycle(name, trial_groups, visiting=set())

            self._repo.groups[name] = updated
            self._repo.save()
            return updated

    async def remove_group_member(self, name: str, member: str) -> Group:
        async with self._repo.transaction():
            if name not in self._repo.groups:
                raise NotFoundError(f"Unknown group '{name}'")
            group = self._repo.groups[name]
            if member not in group.members:
                return group

            updated = Group(
                name=group.name, members=[m for m in group.members if m != member]
            )
            self._repo.groups[name] = updated
            self._repo.save()
            return updated

    # -- root points -----------------------------------------------------------
    #
    # A root point's members may only be host or group names - never
    # another root point. Nothing else can ever name a root point as a
    # member (groups only accept host/group names, see add_group above),
    # so a root point can never sit inside a cycle and there's no
    # equivalent of `_check_for_cycle` to run here.

    async def add_root_point(self, root: RootPoint) -> None:
        async with self._repo.transaction():
            if root.name in self._repo.root_points:
                raise ConflictError(f"Root_point {root.name!r}  already exist")
            for member in root.members:
                known = member in self._repo.hosts or member in self._repo.groups
                if not known:
                    raise ValidationError(
                        f"Unknown member '{member}' for root point '{root.name}'"
                    )
            self._repo.root_points[root.name] = root
            self._repo.save()

    async def list_root_points(self) -> list[RootPoint]:
        async with self._repo.transaction():
            return list(self._repo.root_points.values())

    async def get_root_point(self, name: str) -> RootPoint:
        async with self._repo.transaction():
            if name not in self._repo.root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            return self._repo.root_points[name]

    async def delete_root_point(self, name: str) -> None:
        async with self._repo.transaction():
            if name not in self._repo.root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            del self._repo.root_points[name]
            self._repo.save()

    async def update_root_point(self, name: str, root: RootPoint) -> RootPoint:
        async with self._repo.transaction():
            if name not in self._repo.root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            if root.name != name:
                raise ValidationError(
                    "Renaming a root point isn't supported - delete it and"
                    " add it again under the new name."
                )
            for member in root.members:
                known = member in self._repo.hosts or member in self._repo.groups
                if not known:
                    raise ValidationError(
                        f"Unknown member '{member}' for root point '{root.name}'"
                    )
            self._repo.root_points[name] = root
            self._repo.save()
            return root

    async def add_root_point_member(self, name: str, member: str) -> RootPoint:
        async with self._repo.transaction():
            if name not in self._repo.root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            root = self._repo.root_points[name]
            if member in root.members:
                return root

            known = member in self._repo.hosts or member in self._repo.groups
            if not known:
                raise ValidationError(
                    f"Unknown member '{member}' for root point '{name}'"
                )

            updated = RootPoint(name=root.name, members=[*root.members, member])
            self._repo.root_points[name] = updated
            self._repo.save()
            return updated

    async def remove_root_point_member(self, name: str, member: str) -> RootPoint:
        async with self._repo.transaction():
            if name not in self._repo.root_points:
                raise NotFoundError(f"Unknown root point '{name}'")
            root = self._repo.root_points[name]
            if member not in root.members:
                return root

            updated = RootPoint(
                name=root.name, members=[m for m in root.members if m != member]
            )
            self._repo.root_points[name] = updated
            self._repo.save()
            return updated

    # -- resolution --------------------------------------------------------

    async def resolve_group(self, name: str) -> list[Host]:
        """Flatten a group (or a bare host) name into its list of Hosts,
        recursing into nested groups and de-duplicating."""

        async with self._repo.transaction():
            if name in self._repo.hosts:
                return [self._repo.hosts[name]]

            if name not in self._repo.groups:
                raise NotFoundError(f"Unknown host or group '{name}'")

            found: dict[str, Host] = {}
            self._resolve_into(name, found, visiting=set())
            return list(found.values())

    async def resolve_root_point(self, name: str) -> list[Host]:
        """Flatten every group/host under a root point into a de-duplicated
        list of Hosts - one call to get every host in a building."""

        async with self._repo.transaction():
            if name not in self._repo.root_points:
                raise NotFoundError(f"Unknown root point '{name}'")

            found: dict[str, Host] = {}
            for member in self._repo.root_points[name].members:
                self._resolve_into(member, found, visiting=set())
            return list(found.values())

    async def resolve_for_lookup(self, names: list[str]) -> list[Host]:
        """Flatten every root/group into a de-duplicated
        list of Hosts - one call to get every requested root/group."""
        found: dict[str, Host] = {}

        async with self._repo.transaction():
            for name in names:
                if name in self._repo.root_points:
                    type_obj = self._repo.root_points
                elif name in self._repo.groups:
                    type_obj = self._repo.groups
                elif name in self._repo.hosts:
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
        if name in self._repo.hosts:
            out[name] = self._repo.hosts[name]
            return

        if name not in self._repo.groups:
            raise NotFoundError(f"Unknown host or group '{name}'")

        if name in visiting:
            raise InventoryError(
                f"Group cycle detected at '{name}'"
            )  # noqa: F821 - see note below

        visiting.add(name)
        for member in self._repo.groups[name].members:
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


# Shared singleton - import this rather than constructing SwitchInventoryService yourself.
switch_inventory_service = SwitchInventoryService()
