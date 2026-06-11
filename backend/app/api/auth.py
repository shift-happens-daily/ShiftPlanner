from fastapi import APIRouter, status

from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services import auth_service

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest | None = None) -> LoginResponse:
    return auth_service.login(payload)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest | None = None) -> RegisterResponse:
    return auth_service.register(payload)
