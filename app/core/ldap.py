from contextlib import contextmanager
from typing import Iterator

from ldap3 import Connection, ServerPool
from ldap3.core.exceptions import LDAPBindError, LDAPSocketOpenError, LDAPException
from loguru import logger

from app.core.ldap_exceptions import LdapBindError, LdapConnectionError


class LdapClient:
    def __init__(self, pool: ServerPool, service_user: str, service_password: str):
        self.pool = pool
        self._service_user = service_user
        self._service_password = service_password

    @contextmanager
    def connection(self, user_dn: str, password: str) -> Iterator[Connection]:
        conn = None
        try:
            conn = Connection(
                self.pool,
                user=user_dn,
                password=password,
                auto_bind="NO_TLS",
                receive_timeout=3,
                raise_exceptions=True,
                authentication="SIMPLE",
                read_only=True,
                check_names=True,
                lazy=False,
            )
            yield conn
        except LDAPBindError as e:
            raise LdapBindError() from e
        except (LDAPSocketOpenError, LDAPException) as e:
            logger.error(f"LDAP service unavailable: {e}")
            raise LdapConnectionError() from e
        finally:
            if conn is not None and conn.bound:
                conn.unbind()

    @contextmanager
    def service_connection(self) -> Iterator[Connection]:
        with self.connection(self._service_user, self._service_password) as conn:
            yield conn
