"""API routes for the switch inventory: hosts, groups, and root points.

Root points sit above groups - e.g. one root point per building,
holding the groups/hosts that belong to it. They can never be nested
inside a group or another root point, so they can't take part in a
cycle; see inventory.py for why.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth.auth_manager import validate_user
from app.services.switch.inventory.switch_inventory_service import (
    switch_inventory_service,
)
from app.services.switch.schemas import Group, Host, RootPoint

router = APIRouter(
    prefix="/switch/inventory",
    tags=["Switch Inventory"],
    dependencies=[Depends(validate_user)],
)


# -- hosts -------------------------------------------------------------------


@router.post("/hosts", response_model=Host, status_code=201)
async def create_host(host: Host) -> Host:
    await switch_inventory_service.add_host(host)
    return host


@router.get("/hosts", response_model=list[Host])
async def list_hosts() -> list[Host]:
    return await switch_inventory_service.list_hosts()


@router.get("/hosts/{name}", response_model=Host)
async def get_host(name: str) -> Host:
    return await switch_inventory_service.get_host(name)


@router.patch("/hosts/{name}", response_model=Host)
async def update_host(name: str, host: Host) -> Host:
    return await switch_inventory_service.update_host(name, host)


@router.delete("/hosts/{name}", status_code=204)
async def delete_host(name: str) -> None:
    await switch_inventory_service.delete_host(name)


# -- groups --------------------------------------------------------------------


@router.post("/groups", response_model=Group, status_code=201)
async def create_group(group: Group) -> Group:
    await switch_inventory_service.add_group(group)
    return group


@router.get("/groups", response_model=list[Group])
async def list_groups() -> list[Group]:
    return await switch_inventory_service.list_groups()


@router.get("/groups/{name}", response_model=Group)
async def get_group(name: str) -> Group:
    return await switch_inventory_service.get_group(name)


@router.patch("/groups/{name}", response_model=Group)
async def update_group(name: str, group: Group) -> Group:
    return await switch_inventory_service.update_group(name, group)


@router.delete("/groups/{name}", status_code=204)
async def delete_group(name: str) -> None:
    await switch_inventory_service.delete_group(name)


@router.get("/groups/{name}/resolve", response_model=list[Host])
async def resolve_group(name: str) -> list[Host]:
    return await switch_inventory_service.resolve_group(name)


@router.post("/groups/{name}/members/{member_name}", response_model=Group)
async def add_group_member(name: str, member_name: str) -> Group:
    return await switch_inventory_service.add_group_member(name, member_name)


@router.delete("/groups/{name}/members/{member_name}", response_model=Group)
async def remove_group_member(name: str, member_name: str) -> Group:
    return await switch_inventory_service.remove_group_member(name, member_name)


# -- root points -----------------------------------------------------------------


@router.post("/root-points", response_model=RootPoint, status_code=201)
async def create_root_point(root: RootPoint) -> RootPoint:
    await switch_inventory_service.add_root_point(root)
    return root


@router.get("/root-points", response_model=list[RootPoint])
async def list_root_points() -> list[RootPoint]:
    return await switch_inventory_service.list_root_points()


@router.get("/root-points/{name}", response_model=RootPoint)
async def get_root_point(name: str) -> RootPoint:
    return await switch_inventory_service.get_root_point(name)


@router.patch("/root-points/{name}", response_model=RootPoint)
async def update_root_point(name: str, root: RootPoint) -> RootPoint:
    return await switch_inventory_service.update_root_point(name, root)


@router.delete("/root-points/{name}", status_code=204)
async def delete_root_point(name: str) -> None:
    await switch_inventory_service.delete_root_point(name)


@router.get("/root-points/{name}/resolve", response_model=list[Host])
async def resolve_root_point(name: str) -> list[Host]:
    return await switch_inventory_service.resolve_root_point(name)


@router.post("/root-points/{name}/members/{member_name}", response_model=RootPoint)
async def add_root_point_member(name: str, member_name: str) -> RootPoint:
    return await switch_inventory_service.add_root_point_member(name, member_name)


@router.delete("/root-points/{name}/members/{member_name}", response_model=RootPoint)
async def remove_root_point_member(name: str, member_name: str) -> RootPoint:
    return await switch_inventory_service.remove_root_point_member(name, member_name)
