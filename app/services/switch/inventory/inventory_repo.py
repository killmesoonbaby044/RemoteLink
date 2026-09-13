"""Plain JSON-file persistence for the switch inventory.

No domain rules live here - no cycle checks, no "is this still
referenced" logic. This module only knows how to turn the on-disk JSON
into Host/Group/RootPoint objects and back; InventoryStore (inventory.py)
owns everything about what makes the data valid.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.services.switch.schemas import Group, Host, RootPoint


class InventoryRepository:
    def __init__(self, path: Path):
        self.path = path

    def load(self) -> tuple[dict[str, Host], dict[str, Group], dict[str, RootPoint]]:
        if not self.path.exists():
            return {}, {}, {}

        raw = json.loads(self.path.read_text())
        hosts = {
            name: Host(name=name, **fields)
            for name, fields in raw.get("hosts", {}).items()
        }
        groups = {
            name: Group(name=name, members=fields["members"])
            for name, fields in raw.get("groups", {}).items()
        }
        # .get(..., {}) so inventory files written before root points
        # existed still load fine, with an empty root_points map.
        root_points = {
            name: RootPoint(name=name, members=fields["members"])
            for name, fields in raw.get("root_points", {}).items()
        }
        return hosts, groups, root_points

    def save(
        self,
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
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2))
        tmp.replace(self.path)  # atomic on POSIX, avoids a half-written file
