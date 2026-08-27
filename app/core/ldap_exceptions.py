class LdapBindError(Exception):
    """Raised by LdapClient when ldap3 rejects the bind (bad credentials at transport level)."""


class LdapConnectionError(Exception):
    """Raised by LdapClient when the server is unreachable."""
