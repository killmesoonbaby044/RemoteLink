from __future__ import annotations


class InventoryError(Exception):
    """Base class for all inventory domain errors."""


class NotFoundError(InventoryError):
    """An unknown host, group, or root point name was requested."""


class ValidationError(InventoryError):
    """The request itself is bad: unknown member, would-be cycle, etc."""


class ConflictError(InventoryError):
    """The request is well-formed but conflicts with current state,
    e.g. deleting something that's still referenced elsewhere."""
