from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Employee, User


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


def create_user(
    db: Session,
    *,
    full_name: str,
    email: str,
    password_hash: str,
    role: str,
    is_registration_complete: bool = True,
) -> User:
    user = User(
        full_name=full_name,
        email=email,
        password_hash=password_hash,
        role=role,
        is_registration_complete=is_registration_complete,
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
) -> User:
    user.full_name = full_name
    user.password_hash = password_hash
    user.is_registration_complete = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_employee_for_user(db: Session, user_id: int) -> Employee | None:
    return db.scalars(select(Employee).where(Employee.user_id == user_id)).first()
