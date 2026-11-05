from __future__ import annotations


class SwitchTaskError(Exception):
    """Base class for errors from scripted work on a switch. Mapped to an
    HTTP status in app/core/exception_handlers.py."""


class SwitchConnectionError(SwitchTaskError):
    """SSH to a single switch failed (connect, auth or timeout)."""


class InterfaceChangeRejected(SwitchTaskError):
    """The requested change isn't allowed for this interface's current
    state (e.g. access-port edits on a trunk, removing a line that isn't
    in the running config, nothing to change)."""
