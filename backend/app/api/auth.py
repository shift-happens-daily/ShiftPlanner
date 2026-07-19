from html import escape

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
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
    ChangePasswordRequest,
    PasswordChangeResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
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
    try:
        auth_service.verify_email(db, token)
    except HTTPException as exc:
        return _auth_message_page(
            title="Email link is not valid",
            message=(
                "This confirmation link is expired, already used, or replaced by a newer email. "
                "Return to ShiftPlanner and request a new confirmation email or register again."
            ),
            status_code=exc.status_code,
        )

    return _auth_message_page(
        title="Email confirmed",
        message="You can now return to ShiftPlanner and log in.",
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


@router.post(
    "/password-reset/request",
    response_model=EmailVerificationResponse,
    responses={**VALIDATION_ERROR_RESPONSE},
)
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> EmailVerificationResponse:
    return auth_service.request_password_reset(db, payload)


@router.post(
    "/password-reset/confirm",
    response_model=PasswordChangeResponse,
    responses={**BAD_REQUEST_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
) -> PasswordChangeResponse:
    return auth_service.confirm_password_reset(db, payload)


@router.get(
    "/password-reset",
    response_class=HTMLResponse,
    responses={**VALIDATION_ERROR_RESPONSE},
)
def password_reset_page(token: str = Query(..., min_length=1)) -> HTMLResponse:
    safe_token = escape(token, quote=True)
    return HTMLResponse(
        f"""
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Reset password</title>
          </head>
          <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4faff;color:#002642;font-family:Arial,sans-serif;">
            <main style="width:min(420px, calc(100vw - 32px));padding:28px;">
              <h1 style="margin:0 0 16px;font-size:28px;text-align:center;">Reset password</h1>
              <form id="reset-form" style="display:grid;gap:12px;">
                <input id="password" type="password" minlength="8" required placeholder="New password" autocomplete="new-password" style="font:inherit;padding:12px;border:1px solid #b9c7d3;border-radius:8px;">
                <input id="confirm-password" type="password" minlength="8" required placeholder="Confirm new password" autocomplete="new-password" style="font:inherit;padding:12px;border:1px solid #b9c7d3;border-radius:8px;">
                <button type="submit" style="font:inherit;padding:12px 18px;border:0;border-radius:8px;background:#002642;color:#fff;cursor:pointer;">Change password</button>
              </form>
              <p id="message" style="margin:14px 0 0;font-size:15px;line-height:1.5;text-align:center;"></p>
            </main>
            <script>
              const token = "{safe_token}";
              const form = document.getElementById("reset-form");
              const message = document.getElementById("message");
              form.addEventListener("submit", async (event) => {{
                event.preventDefault();
                const password = document.getElementById("password").value;
                const confirmPassword = document.getElementById("confirm-password").value;
                if (password !== confirmPassword) {{
                  message.textContent = "Passwords do not match.";
                  return;
                }}
                const endpoint = window.location.pathname.replace(/\\/password-reset$/, "/password-reset/confirm");
                const response = await fetch(endpoint, {{
                  method: "POST",
                  headers: {{"Content-Type": "application/json"}},
                  body: JSON.stringify({{token, new_password: password}})
                }});
                if (response.ok) {{
                  form.reset();
                  message.textContent = "Password changed successfully. You can return to ShiftPlanner and log in.";
                  return;
                }}
                const payload = await response.json().catch(() => null);
                message.textContent = payload?.detail || "Could not change password.";
              }});
            </script>
          </body>
        </html>
        """
    )


@router.post(
    "/change-password",
    response_model=PasswordChangeResponse,
    responses={**UNAUTHORIZED_RESPONSE, **VALIDATION_ERROR_RESPONSE},
)
def change_password(
    payload: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PasswordChangeResponse:
    return auth_service.change_password(db, current_user, payload)


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


def _auth_message_page(*, title: str, message: str, status_code: int = status.HTTP_200_OK) -> HTMLResponse:
    safe_title = escape(title)
    safe_message = escape(message)
    return HTMLResponse(
        f"""
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>{safe_title}</title>
          </head>
          <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4faff;color:#002642;font-family:Arial,sans-serif;">
            <main style="max-width:420px;padding:28px;text-align:center;">
              <h1 style="margin:0 0 12px;font-size:28px;">{safe_title}</h1>
              <p style="margin:0;font-size:16px;line-height:1.5;">{safe_message}</p>
            </main>
          </body>
        </html>
        """,
        status_code=status_code,
    )
