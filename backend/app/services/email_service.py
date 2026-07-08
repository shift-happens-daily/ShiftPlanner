import os
import smtplib
import socket
import ssl
import logging
from email.message import EmailMessage
from html import escape
from urllib.parse import quote

import httpx


DEFAULT_FROM_EMAIL = "shiftplanner@mail.ru"
DEFAULT_FROM_NAME = "ShiftPlanner"
DEFAULT_SMTP_HOST = "smtp.mail.ru"
DEFAULT_SMTP_PORT = 465
DEFAULT_RESEND_API_URL = "https://api.resend.com/emails"
logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _create_ipv4_connection(host: str, port: int, timeout: int) -> socket.socket:
    errors = []
    for family, socktype, proto, _, address in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
        sock = socket.socket(family, socktype, proto)
        sock.settimeout(timeout)
        try:
            sock.connect(address)
            return sock
        except OSError as exc:
            errors.append(exc)
            sock.close()

    if errors:
        raise errors[-1]
    raise OSError(f"No IPv4 address found for {host}:{port}")


class IPv4SMTPSSL(smtplib.SMTP_SSL):
    def _get_socket(self, host: str, port: int, timeout: int) -> socket.socket:
        raw_socket = _create_ipv4_connection(host, port, timeout)
        return self.context.wrap_socket(raw_socket, server_hostname=host)


class IPv4SMTP(smtplib.SMTP):
    def _get_socket(self, host: str, port: int, timeout: int) -> socket.socket:
        return _create_ipv4_connection(host, port, timeout)


def is_email_verification_required() -> bool:
    return _env_flag("EMAIL_VERIFICATION_REQUIRED", False)


def is_email_delivery_configured() -> bool:
    return bool(os.getenv("SMTP_PASSWORD") or os.getenv("RESEND_API_KEY") or os.getenv("EMAIL_API_KEY"))


def build_verification_url(token: str) -> str:
    base_url = os.getenv("PUBLIC_API_BASE_URL", "http://localhost:8000").strip().rstrip("/")
    return f"{base_url}/auth/verify-email?token={quote(token)}"


def build_password_reset_url(token: str) -> str:
    explicit_url = os.getenv("PASSWORD_RESET_URL", "").strip()
    if explicit_url:
        if "{token}" in explicit_url:
            return explicit_url.replace("{token}", quote(token))
        separator = "&" if "?" in explicit_url else "?"
        return f"{explicit_url}{separator}token={quote(token)}"

    frontend_url = os.getenv("PUBLIC_FRONTEND_BASE_URL", "").strip().rstrip("/")
    if frontend_url:
        return f"{frontend_url}/reset-password?token={quote(token)}"

    base_url = os.getenv("PUBLIC_API_BASE_URL", "http://localhost:8000").strip().rstrip("/")
    return f"{base_url}/auth/password-reset?token={quote(token)}"


def send_verification_email(*, to_email: str, full_name: str, token: str) -> None:
    provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    if provider == "resend" or os.getenv("RESEND_API_KEY"):
        try:
            _send_verification_email_via_resend(to_email=to_email, full_name=full_name, token=token)
        except Exception:
            if not os.getenv("SMTP_PASSWORD"):
                raise
            logger.exception("Resend verification email failed; falling back to SMTP.")
            _send_verification_email_via_smtp(to_email=to_email, full_name=full_name, token=token)
        return

    _send_verification_email_via_smtp(to_email=to_email, full_name=full_name, token=token)


def send_password_reset_email(*, to_email: str, full_name: str, token: str) -> None:
    provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    if provider == "resend" or os.getenv("RESEND_API_KEY"):
        try:
            _send_password_reset_email_via_resend(to_email=to_email, full_name=full_name, token=token)
        except Exception:
            if not os.getenv("SMTP_PASSWORD"):
                raise
            logger.exception("Resend password reset email failed; falling back to SMTP.")
            _send_password_reset_email_via_smtp(to_email=to_email, full_name=full_name, token=token)
        return

    _send_password_reset_email_via_smtp(to_email=to_email, full_name=full_name, token=token)


def _build_sender() -> str:
    explicit_sender = os.getenv("EMAIL_FROM")
    if explicit_sender:
        return explicit_sender

    from_email = os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_FROM") or DEFAULT_FROM_EMAIL
    from_name = os.getenv("SMTP_FROM_NAME", DEFAULT_FROM_NAME)
    return f"{from_name} <{from_email}>"


def _build_verification_email_content(*, full_name: str, token: str) -> tuple[str, str, str]:
    verification_url = build_verification_url(token)
    safe_name = escape(full_name or "there")
    safe_url = escape(verification_url)

    subject = "Confirm your ShiftPlanner email"
    text_body = "\n".join(
        [
            f"Hello, {full_name or 'there'}!",
            "",
            "Confirm your email address for ShiftPlanner:",
            verification_url,
            "",
            "If you did not create a ShiftPlanner account, ignore this email.",
        ]
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #002642;">
        <p>Hello, {safe_name}!</p>
        <p>Confirm your email address for ShiftPlanner.</p>
        <p>
          <a href="{safe_url}" style="display:inline-block;padding:12px 18px;background:#002642;color:#ffffff;text-decoration:none;border-radius:8px;">
            Confirm email
          </a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p><a href="{safe_url}">{safe_url}</a></p>
        <p>If you did not create a ShiftPlanner account, ignore this email.</p>
      </body>
    </html>
    """
    return subject, text_body, html_body


def _build_password_reset_email_content(*, full_name: str, token: str) -> tuple[str, str, str]:
    reset_url = build_password_reset_url(token)
    safe_name = escape(full_name or "there")
    safe_url = escape(reset_url)

    subject = "Reset your ShiftPlanner password"
    text_body = "\n".join(
        [
            f"Hello, {full_name or 'there'}!",
            "",
            "Use this link to reset your ShiftPlanner password:",
            reset_url,
            "",
            "If you did not request a password reset, ignore this email.",
        ]
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #002642;">
        <p>Hello, {safe_name}!</p>
        <p>Use this link to reset your ShiftPlanner password.</p>
        <p>
          <a href="{safe_url}" style="display:inline-block;padding:12px 18px;background:#002642;color:#ffffff;text-decoration:none;border-radius:8px;">
            Reset password
          </a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p><a href="{safe_url}">{safe_url}</a></p>
        <p>If you did not request a password reset, ignore this email.</p>
      </body>
    </html>
    """
    return subject, text_body, html_body


def _send_verification_email_via_resend(*, to_email: str, full_name: str, token: str) -> None:
    api_key = os.getenv("RESEND_API_KEY") or os.getenv("EMAIL_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    subject, text_body, html_body = _build_verification_email_content(full_name=full_name, token=token)
    response = _post_resend_email(
        api_key=api_key,
        payload=_build_email_payload(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        ),
    )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Resend API rejected email with status {response.status_code}: {response.text[:500]}"
        )


def _send_password_reset_email_via_resend(*, to_email: str, full_name: str, token: str) -> None:
    api_key = os.getenv("RESEND_API_KEY") or os.getenv("EMAIL_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    subject, text_body, html_body = _build_password_reset_email_content(full_name=full_name, token=token)
    response = _post_resend_email(
        api_key=api_key,
        payload=_build_email_payload(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        ),
    )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Resend API rejected email with status {response.status_code}: {response.text[:500]}"
        )


def _build_email_payload(*, to_email: str, subject: str, text_body: str, html_body: str) -> dict[str, str]:
    return {
        "from": _build_sender(),
        "to": to_email,
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }


def _post_resend_email(*, api_key: str, payload: dict[str, str]) -> httpx.Response:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "ShiftPlanner/1.0",
    }
    request_kwargs = {
        "headers": headers,
        "json": payload,
        "timeout": 20,
    }
    api_url = os.getenv("RESEND_API_URL", DEFAULT_RESEND_API_URL)
    if _env_flag("EMAIL_FORCE_IPV4", True):
        transport = httpx.HTTPTransport(local_address="0.0.0.0", retries=1)
        with httpx.Client(transport=transport) as client:
            return client.post(api_url, **request_kwargs)
    return httpx.post(api_url, **request_kwargs)


def _send_verification_email_via_smtp(*, to_email: str, full_name: str, token: str) -> None:
    _send_email_via_smtp(
        to_email=to_email,
        subject_body_builder=lambda: _build_verification_email_content(full_name=full_name, token=token),
    )


def _send_password_reset_email_via_smtp(*, to_email: str, full_name: str, token: str) -> None:
    _send_email_via_smtp(
        to_email=to_email,
        subject_body_builder=lambda: _build_password_reset_email_content(full_name=full_name, token=token),
    )


def _send_email_via_smtp(*, to_email: str, subject_body_builder) -> None:
    password = os.getenv("SMTP_PASSWORD")
    if not password:
        raise RuntimeError("SMTP_PASSWORD is not configured.")

    from_email = os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_FROM") or DEFAULT_FROM_EMAIL
    from_name = os.getenv("SMTP_FROM_NAME", DEFAULT_FROM_NAME)
    username = os.getenv("SMTP_USERNAME", from_email)
    if "@" not in username and "@" in from_email:
        username = from_email
    host = os.getenv("SMTP_HOST", DEFAULT_SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", str(DEFAULT_SMTP_PORT)))
    use_ssl = _env_flag("SMTP_USE_SSL", True)
    force_ipv4 = _env_flag("SMTP_FORCE_IPV4", True)

    subject, text_body, html_body = subject_body_builder()

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    if use_ssl:
        context = ssl.create_default_context()
        smtp_class = IPv4SMTPSSL if force_ipv4 else smtplib.SMTP_SSL
        with smtp_class(host, port, context=context, timeout=20) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)
        return

    smtp_class = IPv4SMTP if force_ipv4 else smtplib.SMTP
    with smtp_class(host, port, timeout=20) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(username, password)
        smtp.send_message(message)
