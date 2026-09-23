class InvalidScriptError(Exception):
    """Raised when a requested script name is missing, unsafe, or invalid."""


class FileCheckError(Exception):
    """Raised when a file is missing, unsafe, or invalid."""
