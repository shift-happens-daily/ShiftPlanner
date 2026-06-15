import os
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_secret_key() -> str:
    return os.getenv("JWT_SECRET_KEY", "change-me-in-production")


def get_algorithm() -> str:
    return os.getenv("JWT_ALGORITHM", "HS256")


def get_access_token_expire_minutes() -> int:
    return int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def create_access_token(subject: str, role: str) -> str:
    expires_delta = timedelta(minutes=get_access_token_expire_minutes())
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, get_secret_key(), algorithm=get_algorithm())


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, get_secret_key(), algorithms=[get_algorithm()])
