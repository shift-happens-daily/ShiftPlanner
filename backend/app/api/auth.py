from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_current_user, oauth2_scheme
from app.api.responses import UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.schemas.auth import (
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
def login(payload: LoginRequest) -> LoginResponse:
    return auth_service.login(payload)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    responses={**VALIDATION_ERROR_RESPONSE, 400: {"description": "A user with this email already exists."}},
)
def register(payload: RegisterRequest) -> RegisterResponse:
    return auth_service.register(payload)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    responses={**UNAUTHORIZED_RESPONSE},
)
def logout(token: str = Depends(oauth2_scheme), _: dict = Depends(get_current_user)) -> LogoutResponse:
    return auth_service.logout(token)
