import secrets

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, position_repository, user_repository
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse, UserRead
from app.services.security import create_access_token, get_password_hash, verify_password

_active_tokens: set[str] = set()


def login(db: Session, payload: LoginRequest) -> LoginResponse:
    user = user_repository.get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash) or not user.is_registration_complete:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(subject=str(user.id), role=user.role)
    _active_tokens.add(access_token)
    return LoginResponse(access_token=access_token, token_type="bearer", role=user.role)


def register(db: Session, payload: RegisterRequest) -> RegisterResponse:
    existing_user = user_repository.get_user_by_email(db, payload.email)
    if existing_user is not None:
        if payload.role == "employee" and existing_user.role == "employee" and not existing_user.is_registration_complete:
            user = user_repository.update_registration(
                db,
                user=existing_user,
                full_name=payload.full_name,
                password_hash=get_password_hash(payload.password),
            )
            return _build_user_read(db, user)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    user = user_repository.create_user(
        db,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        is_registration_complete=True,
    )

    if payload.role == "employee":
        default_company = company_repository.get_default_company(db)
        branch = company_repository.get_default_branch_for_company(db, default_company.id)
        employee = employee_repository.create_employee(
            db,
            user_id=user.id,
            company_id=default_company.id,
            branch_id=branch.id if branch else None,
            position_id=_get_default_position_id(db, default_company.id),
        )
        user = user_repository.get_user_by_id(db, user.id)
        return RegisterResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            employee_id=employee.id,
        )

    db.commit()
    db.refresh(user)
    return _build_user_read(db, user)


def logout(token: str) -> LogoutResponse:
    if token not in _active_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not active.",
        )
    _active_tokens.discard(token)
    return LogoutResponse(detail="Logged out successfully.")


def get_current_user(db: Session, token: str) -> UserRead:
    if token not in _active_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )

    try:
        payload = create_payload_from_token(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        ) from exc

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )

    user = user_repository.get_user_by_id(db, int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )
    return _build_user_read(db, user)


def create_placeholder_employee_password() -> str:
    return get_password_hash(secrets.token_urlsafe(24))


def _build_user_read(db: Session, user) -> RegisterResponse:
    employee = user_repository.get_employee_for_user(db, user.id)
    return RegisterResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        employee_id=employee.id if employee else None,
    )


def _get_default_position_id(db: Session, company_id: int) -> int:
    position = next((item for item in position_repository.list_positions(db) if item.company_id == company_id), None)
    if position is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No position exists for the default company. Create a position first.",
        )
    return position.id


def create_payload_from_token(token: str) -> dict:
    from app.services.security import decode_access_token

    return decode_access_token(token)
