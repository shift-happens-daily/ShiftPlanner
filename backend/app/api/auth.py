from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, oauth2_scheme
from app.api.responses import BAD_REQUEST_RESPONSE, FORBIDDEN_RESPONSE, UNAUTHORIZED_RESPONSE, VALIDATION_ERROR_RESPONSE
from app.database import get_db
from app.schemas.auth import (
    CurrentUserResponse,
    EmailVerificationResendRequest,
    EmailVerificationResponse,
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
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return auth_service.login(db, payload)


@router.post(
    "/token",
    response_model=LoginResponse,
    responses={**UNAUTHORIZED_RESPONSE, **FORBIDDEN_RESPONSE, **VALIDATION_ERROR_RESPONSE},
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
    "/verify-email",
    response_class=HTMLResponse,
    responses={**BAD_REQUEST_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def verify_email(token: str = Query(..., min_length=1), db: Session = Depends(get_db)) -> HTMLResponse:
    auth_service.verify_email(db, token)
    return HTMLResponse(
        """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Email confirmed</title>
          </head>
          <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4faff;color:#002642;font-family:Arial,sans-serif;">
            <main style="max-width:420px;padding:28px;text-align:center;">
              <h1 style="margin:0 0 12px;font-size:28px;">Email confirmed</h1>
              <p style="margin:0;font-size:16px;line-height:1.5;">You can now return to ShiftPlanner and log in.</p>
            </main>
          </body>
        </html>
        """
    )


@router.post(
    "/resend-verification",
    response_model=EmailVerificationResponse,
    responses={**VALIDATION_ERROR_RESPONSE},
)
def resend_verification_email(
    payload: EmailVerificationResendRequest,
    db: Session = Depends(get_db),
) -> EmailVerificationResponse:
    return auth_service.resend_verification_email(db, payload)


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
