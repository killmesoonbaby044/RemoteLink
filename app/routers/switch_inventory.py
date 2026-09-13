"""API routes for the switch inventory: hosts, groups, and root points.

Root points sit above groups - e.g. one root point per building,
holding the groups/hosts that belong to it. They can never be nested
inside a group or another root point, so they can't take part in a
cycle; see inventory.py for why.
"""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter, HTTPException, Depends

from app.core.auth.auth_manager import validate_user
from app.services.switch.inventory.inventory import (
    ConflictError,
    InventoryError,
    NotFoundError,
    inventory_store,
)
from app.services.switch.schemas import Group, Host, RootPoint

router = APIRouter(
    prefix="/inventory", tags=["inventory"], dependencies=[Depends(validate_user)]
)


def _raise_http(exc: InventoryError) -> NoReturn:
    if isinstance(exc, NotFoundError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ConflictError):
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    raise HTTPException(
        status_code=400, detail=str(exc)
    ) from exc  # ValidationError etc.


# -- hosts -------------------------------------------------------------------


@router.post("/hosts", response_model=Host, status_code=201)
async def create_host(host: Host) -> Host:
    try:
        await inventory_store.add_host(host)
    except InventoryError as exc:
        _raise_http(exc)
    return host


@router.get("/hosts", response_model=list[Host])
async def list_hosts() -> list[Host]:
    return await inventory_store.list_hosts()


@router.get("/hosts/{name}", response_model=Host)
async def get_host(name: str) -> Host:
    try:
        return await inventory_store.get_host(name)
    except InventoryError as exc:
        _raise_http(exc)


@router.patch("/hosts/{name}", response_model=Host)
async def update_host(name: str, host: Host) -> Host:
    try:
        return await inventory_store.update_host(name, host)
    except InventoryError as exc:
        _raise_http(exc)


@router.delete("/hosts/{name}", status_code=204)
async def delete_host(name: str) -> None:
    try:
        await inventory_store.delete_host(name)
    except InventoryError as exc:
        _raise_http(exc)


# -- groups --------------------------------------------------------------------


@router.post("/groups", response_model=Group, status_code=201)
async def create_group(group: Group) -> Group:
    try:
        await inventory_store.add_group(group)
    except InventoryError as exc:
        _raise_http(exc)
    return group


@router.get("/groups", response_model=list[Group])
async def list_groups() -> list[Group]:
    return await inventory_store.list_groups()


@router.get("/groups/{name}", response_model=Group)
async def get_group(name: str) -> Group:
    try:
        return await inventory_store.get_group(name)
    except InventoryError as exc:
        _raise_http(exc)


@router.patch("/groups/{name}", response_model=Group)
async def update_group(name: str, group: Group) -> Group:
    try:
        return await inventory_store.update_group(name, group)
    except InventoryError as exc:
        _raise_http(exc)


@router.delete("/groups/{name}", status_code=204)
async def delete_group(name: str) -> None:
    try:
        await inventory_store.delete_group(name)
    except InventoryError as exc:
        _raise_http(exc)


@router.get("/groups/{name}/resolve", response_model=list[Host])
async def resolve_group(name: str) -> list[Host]:
    try:
        return await inventory_store.resolve_group(name)
    except InventoryError as exc:
        _raise_http(exc)


@router.post("/groups/{name}/members/{member_name}", response_model=Group)
async def add_group_member(name: str, member_name: str) -> Group:
    try:
        return await inventory_store.add_group_member(name, member_name)
    except InventoryError as exc:
        _raise_http(exc)


@router.delete("/groups/{name}/members/{member_name}", response_model=Group)
async def remove_group_member(name: str, member_name: str) -> Group:
    try:
        return await inventory_store.remove_group_member(name, member_name)
    except InventoryError as exc:
        _raise_http(exc)


# -- root points -----------------------------------------------------------------


@router.post("/root-points", response_model=RootPoint, status_code=201)
async def create_root_point(root: RootPoint) -> RootPoint:
    try:
        await inventory_store.add_root_point(root)
    except InventoryError as exc:
        _raise_http(exc)
    return root


@router.get("/root-points", response_model=list[RootPoint])
async def list_root_points() -> list[RootPoint]:
    return await inventory_store.list_root_points()


@router.get("/root-points/{name}", response_model=RootPoint)
async def get_root_point(name: str) -> RootPoint:
    try:
        return await inventory_store.get_root_point(name)
    except InventoryError as exc:
        _raise_http(exc)


@router.patch("/root-points/{name}", response_model=RootPoint)
async def update_root_point(name: str, root: RootPoint) -> RootPoint:
    try:
        return await inventory_store.update_root_point(name, root)
    except InventoryError as exc:
        _raise_http(exc)


@router.delete("/root-points/{name}", status_code=204)
async def delete_root_point(name: str) -> None:
    try:
        await inventory_store.delete_root_point(name)
    except InventoryError as exc:
        _raise_http(exc)


@router.get("/root-points/{name}/resolve", response_model=list[Host])
async def resolve_root_point(name: str) -> list[Host]:
    try:
        return await inventory_store.resolve_root_point(name)
    except InventoryError as exc:
        _raise_http(exc)


@router.post("/root-points/{name}/members/{member_name}", response_model=RootPoint)
async def add_root_point_member(name: str, member_name: str) -> RootPoint:
    try:
        return await inventory_store.add_root_point_member(name, member_name)
    except InventoryError as exc:
        _raise_http(exc)


@router.delete("/root-points/{name}/members/{member_name}", response_model=RootPoint)
async def remove_root_point_member(name: str, member_name: str) -> RootPoint:
    try:
        return await inventory_store.remove_root_point_member(name, member_name)
    except InventoryError as exc:
        _raise_http(exc)
