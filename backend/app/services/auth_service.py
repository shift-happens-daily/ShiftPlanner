from fastapi import HTTPException, status
from jose import JWTError

from app.repositories import mock_db
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse, UserRead
from app.services.security import create_access_token, get_password_hash, verify_password


def login(payload: LoginRequest) -> LoginResponse:
    user = mock_db.get_user_by_email(payload.email)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(subject=str(user["id"]), role=user["role"])
    mock_db.add_active_token(access_token)
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        role=user["role"],
    )


def register(payload: RegisterRequest) -> RegisterResponse:
    if mock_db.get_user_by_email(payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    linked_employee_id = None
    if payload.role == "employee":
        linked_employee = mock_db.get_employee_by_email(payload.email)
        if linked_employee is not None:
            linked_employee_id = linked_employee["id"]

    user = mock_db.create_user(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        employee_id=linked_employee_id,
    )
    return _build_user_read(user)


def logout(token: str) -> LogoutResponse:
    if not mock_db.token_is_active(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not active.",
        )
    mock_db.remove_active_token(token)
    return LogoutResponse(detail="Logged out successfully.")


def get_current_user(token: str) -> UserRead:
    if not mock_db.token_is_active(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )

    try:
        payload = mock_db.decode_token(token)
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

    user = mock_db.get_user_by_id(int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )
    return _build_user_read(user)


def _build_user_read(user: dict) -> UserRead:
    return UserRead(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
        employee_id=user.get("employee_id"),
    )
