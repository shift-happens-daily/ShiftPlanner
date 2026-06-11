from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse


def login(_: LoginRequest | None = None) -> LoginResponse:
    return LoginResponse(
        access_token="mock-token",
        token_type="bearer",
        role="manager",
    )


def register(payload: RegisterRequest | None = None) -> RegisterResponse:
    return RegisterResponse(
        id=1,
        full_name=payload.full_name if payload else "Mock User",
        email=payload.email if payload else "mock@example.com",
        role=payload.role if payload else "manager",
    )
