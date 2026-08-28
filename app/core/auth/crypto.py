import hashlib
import secrets

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hashing(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_refresh_token():
    return secrets.token_urlsafe(32)
