import secrets
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.repositories import company_repository, employee_repository, user_repository
from app.schemas.auth import (
    CurrentUserBranchAssignmentRead,
    CurrentUserBranchRead,
    CurrentUserCompanyRead,
    CurrentUserPositionRead,
    EmailVerificationResponse,
    CurrentUserResponse,
    EmailVerificationResendRequest,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RegisterRequest,
    RegisterResponse,
    UserRead,
)
from app.services import email_service
from app.services.security import create_access_token, get_password_hash, verify_password

_active_tokens: set[str] = set()
logger = logging.getLogger(__name__)
EMAIL_VERIFICATION_TOKEN_BYTES = 32
EMAIL_VERIFICATION_EXPIRE_HOURS = 24


def login(db: Session, payload: LoginRequest) -> LoginResponse:
    user = user_repository.get_user_by_email(db, payload.email)

    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash) or not user.is_registration_complete:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified.",
        )

    access_token = create_access_token(subject=str(user.id), role=user.role)
    _active_tokens.add(access_token)

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
    )


def register(db: Session, payload: RegisterRequest) -> RegisterResponse:
    existing_user = user_repository.get_user_by_email(db, payload.email)
    verification_required = email_service.is_email_verification_required()

    if existing_user is not None:
        if (
            payload.role == "employee"
            and existing_user.role == "employee"
            and not existing_user.is_registration_complete
        ):
            user = user_repository.update_registration(
                db,
                user=existing_user,
                full_name=payload.full_name,
                password_hash=get_password_hash(payload.password),
                email_verified=not verification_required,
            )
            if verification_required:
                _send_or_raise_verification_email(db, user)
            else:
                db.commit()
                db.refresh(user)
            return _build_register_response(db, user)

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
        email_verified=not verification_required,
    )

    if verification_required:
        _prepare_verification_token(db, user)

    if verification_required:
        _deliver_verification_email(user)

    db.commit()
    db.refresh(user)

    return _build_register_response(db, user)


def verify_email(db: Session, token: str) -> EmailVerificationResponse:
    user = user_repository.get_user_by_email_verification_token(db, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email verification link.",
        )

    expires_at = user.email_verification_expires_at
    if expires_at is None or _as_aware_utc(expires_at) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification link has expired.",
        )

    user_repository.mark_email_verified(db, user)
    return EmailVerificationResponse(detail="Email verified successfully.")


def resend_verification_email(db: Session, payload: EmailVerificationResendRequest) -> EmailVerificationResponse:
    user = user_repository.get_user_by_email(db, payload.email)
    generic_response = EmailVerificationResponse(
        detail="If this email needs verification, a new confirmation email has been sent."
    )

    if user is None or user.email_verified or not user.is_registration_complete:
        return generic_response

    if not email_service.is_email_verification_required():
        user_repository.mark_email_verified(db, user)
        return generic_response

    _send_or_raise_verification_email(db, user)
    return generic_response


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


def get_current_user_profile(db: Session, current_user: UserRead) -> CurrentUserResponse:
    user = user_repository.get_user_by_id(db, current_user.id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )

    return _build_current_user_response(db, user)


def delete_current_employee_account(db: Session, current_user: UserRead, token: str) -> None:
    if current_user.role not in {"employee", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employee and manager accounts can be deleted through this endpoint.",
        )

    user = user_repository.get_user_by_id(db, current_user.id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )

    user_repository.delete_user(db, user)
    _active_tokens.discard(token)


def create_placeholder_employee_password() -> str:
    return get_password_hash(secrets.token_urlsafe(24))


def _build_user_read(db: Session, user) -> UserRead:
    employee = employee_repository.get_employee_by_user_id(db, user.id)
    company_id = None
    employee_status = None
    manager_status = None

    if user.role == "manager":
        membership = company_repository.get_manager_membership_by_user_id(db, user.id)
        if membership is not None:
            manager_status = membership.membership_status if membership.membership_status in {"pending", "active"} else None
            company_id = membership.company_id if membership.membership_status == "active" else None
        else:
            company = company_repository.get_company_by_manager_user_id(db, user.id)
            if company is not None:
                company_id = company.id
                manager_status = "active"
    elif employee is not None:
        employee_status = "active" if employee.is_active else "pending"
        company_id = employee.company_id if employee.is_active else None

    return UserRead(
        id=user.id,
        public_id=user.public_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        employee_id=employee.id if employee else None,
        company_id=company_id,
        employee_status=employee_status,
        manager_status=manager_status,
    )


def _build_register_response(db: Session, user) -> RegisterResponse:
    employee = employee_repository.get_employee_by_user_id(db, user.id)
    company_id = employee.company_id if employee and employee.is_active else None
    verification_required = not user.email_verified
    manager_status = None
    if user.role == "manager":
        membership = company_repository.get_manager_membership_by_user_id(db, user.id)
        manager_status = membership.membership_status if membership and membership.membership_status in {"pending", "active"} else None

    return RegisterResponse(
        id=user.id,
        public_id=user.public_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        employee_id=employee.id if employee else None,
        company_id=company_id,
        employee_status=("active" if employee.is_active else "pending") if employee else None,
        manager_status=manager_status,
        email_verification_required=verification_required,
        detail=(
            "Registration successful. Check your email to confirm your account."
            if verification_required
            else None
        ),
    )


def _build_current_user_response(db: Session, user) -> CurrentUserResponse:
    employee = None
    company = None
    company_id = None
    branch = None
    branches: list[CurrentUserBranchAssignmentRead] = []
    position = None
    employee_status = None
    manager_status = None

    if user.role == "manager":
        membership = company_repository.get_manager_membership_by_user_id(db, user.id)
        company_model = None

        if membership is not None:
            manager_status = membership.membership_status if membership.membership_status in {"pending", "active"} else None
            if membership.membership_status == "active":
                company_model = company_repository.get_company_by_id(db, membership.company_id)
        else:
            company_model = company_repository.get_company_by_manager_user_id(db, user.id)
            if company_model is not None:
                manager_status = "active"

        if company_model is not None:
            company_id = company_model.id
            company = CurrentUserCompanyRead(
                id=company_model.id,
                name=company_model.name,
                invite_code=company_model.invite_code or "",
            )

    if user.role == "employee":
        employee = employee_repository.get_employee_by_user_id(db, user.id)

        if employee is not None:
            employee_status = "active" if employee.is_active else "pending"

            if employee.is_active:
                company_id = employee.company_id

                if employee.company is not None:
                    company = CurrentUserCompanyRead(
                        id=employee.company.id,
                        name=employee.company.name,
                        invite_code=employee.company.invite_code or "",
                    )

                if employee.branch is not None:
                    branch = CurrentUserBranchRead(
                        id=employee.branch.id,
                        name=employee.branch.name,
                    )

                branches = [
                    CurrentUserBranchAssignmentRead(
                        id=link.branch.id,
                        name=link.branch.name,
                        is_primary=link.is_primary,
                    )
                    for link in sorted(employee.branch_links, key=lambda item: (not item.is_primary, item.branch_id))
                    if link.branch is not None
                ]

                if employee.position is not None:
                    position = CurrentUserPositionRead(
                        id=employee.position.id,
                        name=employee.position.name,
                    )

    return CurrentUserResponse(
        id=user.id,
        public_id=user.public_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        employee_id=employee.id if employee else None,
        company_id=company_id,
        employee_status=employee_status,
        manager_status=manager_status,
        branch_id=employee.branch_id if employee and employee.is_active else None,
        position_id=employee.position_id if employee and employee.is_active else None,
        company=company,
        branch=branch,
        branches=branches,
        position=position,
    )


def create_payload_from_token(token: str) -> dict:
    from app.services.security import decode_access_token

    return decode_access_token(token)


def _generate_email_verification_token() -> str:
    return secrets.token_urlsafe(EMAIL_VERIFICATION_TOKEN_BYTES)


def _verification_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRE_HOURS)


def _prepare_verification_token(db: Session, user) -> str:
    token = _generate_email_verification_token()
    user_repository.set_email_verification_token(
        db,
        user=user,
        token=token,
        expires_at=_verification_expires_at(),
    )
    return token


def _send_or_raise_verification_email(db: Session, user) -> None:
    _prepare_verification_token(db, user)
    _deliver_verification_email(user)
    db.commit()
    db.refresh(user)


def _deliver_verification_email(user) -> None:
    try:
        email_service.send_verification_email(
            to_email=user.email,
            full_name=user.full_name,
            token=user.email_verification_token,
        )
    except Exception as exc:
        logger.exception("Could not send verification email to %s", user.email)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send verification email.",
        ) from exc


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


