import secrets
import string
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Employee, User

PUBLIC_ID_LENGTH = 16
PUBLIC_ID_GENERATION_ATTEMPTS = 20
PUBLIC_ID_ALPHABET = string.ascii_uppercase + string.digits


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalars(
        select(User)
        .options(joinedload(User.employee))
        .where(User.email.ilike(email))
    ).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.scalars(
        select(User)
        .options(joinedload(User.employee))
        .where(User.id == user_id)
    ).first()


def get_user_by_public_id(db: Session, public_id: str) -> User | None:
    return db.scalars(
        select(User)
        .options(joinedload(User.employee))
        .where(func.upper(User.public_id) == public_id.upper())
    ).first()


def get_user_by_email_verification_token(db: Session, token: str) -> User | None:
    return db.scalars(
        select(User)
        .options(joinedload(User.employee))
        .where(User.email_verification_token == token)
    ).first()


def create_user(
    db: Session,
    *,
    full_name: str,
    email: str,
    password_hash: str,
    role: str,
    is_registration_complete: bool = True,
    email_verified: bool = True,
) -> User:
    user = User(
        public_id=_generate_unique_public_id(db),
        full_name=full_name,
        email=email,
        password_hash=password_hash,
        role=role,
        is_registration_complete=is_registration_complete,
        email_verified=email_verified,
    )
    db.add(user)
    db.flush()
    return user


def update_registration(
    db: Session,
    *,
    user: User,
    full_name: str,
    password_hash: str,
    email_verified: bool = True,
) -> User:
    user.full_name = full_name
    user.password_hash = password_hash
    user.is_registration_complete = True
    user.email_verified = email_verified
    db.add(user)
    db.flush()
    return user


def set_email_verification_token(
    db: Session,
    *,
    user: User,
    token: str,
    expires_at: datetime,
) -> User:
    user.email_verification_token = token
    user.email_verification_expires_at = expires_at
    db.add(user)
    db.flush()
    return user


def mark_email_verified(db: Session, user: User) -> User:
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()


def get_employee_for_user(db: Session, user_id: int) -> Employee | None:
    return db.scalars(select(Employee).where(Employee.user_id == user_id)).first()


def _generate_public_id() -> str:
    return "".join(secrets.choice(PUBLIC_ID_ALPHABET) for _ in range(PUBLIC_ID_LENGTH))


def _generate_unique_public_id(db: Session) -> str:
    for _ in range(PUBLIC_ID_GENERATION_ATTEMPTS):
        public_id = _generate_public_id()
        existing_user_id = db.scalar(
            select(User.id)
            .where(User.public_id == public_id)
            .limit(1)
        )
        if existing_user_id is None:
            return public_id

    raise RuntimeError("Unable to generate a unique user public ID after 20 attempts.")
