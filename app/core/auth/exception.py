from app.core.exceptions import AppError


class AuthenticationError(AppError):
    """Base for all 401 cases."""


class InvalidTokenError(AuthenticationError):
    """JWT malformed, invalid signature, or expired refresh."""


class UserDisabledError(AuthenticationError):
    """User exists but status=False."""


class InvalidCredentialsError(AuthenticationError):
    """Wrong username, password, or account inactive — intentionally vague."""
