from fastapi import APIRouter, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, oauth2_scheme
from app.api.responses import FORBIDDEN_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.database import get_db
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services import auth_service

router = APIRouter()


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={**UNAUTHORIZED_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return auth_service.login(db, payload)


@router.post(
    "/token",
    response_model=LoginResponse,
    responses={**UNAUTHORIZED_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> LoginResponse:
    payload = LoginRequest(
        email=form_data.username,
        password=form_data.password,
    )
    return auth_service.login(db, payload)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    responses={**VALIDATION_ERROR_RESPONSE, 400: {"description": "A user with this email already exists."}},
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    return auth_service.register(db, payload)


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    responses={**UNAUTHORIZED_RESPONSE},
)
def get_me(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    return auth_service.get_current_user_profile(db, current_user)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE},
)
def delete_me(
    token: str = Depends(oauth2_scheme),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    auth_service.delete_current_employee_account(db, current_user, token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    responses={**UNAUTHORIZED_RESPONSE},
)
def logout(token: str = Depends(oauth2_scheme), _: dict = Depends(get_current_user)) -> LogoutResponse:
    return auth_service.logout(token)
