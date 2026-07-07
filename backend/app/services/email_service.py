import os
import smtplib
import socket
import ssl
from email.message import EmailMessage
from html import escape
from urllib.parse import quote


DEFAULT_FROM_EMAIL = "shiftplanner@mail.ru"
DEFAULT_SMTP_HOST = "smtp.mail.ru"
DEFAULT_SMTP_PORT = 465


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
    return _env_flag("EMAIL_VERIFICATION_REQUIRED", False) or bool(os.getenv("SMTP_PASSWORD"))


def is_email_delivery_configured() -> bool:
    return bool(os.getenv("SMTP_PASSWORD"))


def build_verification_url(token: str) -> str:
    base_url = os.getenv("PUBLIC_API_BASE_URL", "http://localhost:8000").strip().rstrip("/")
    return f"{base_url}/auth/verify-email?token={quote(token)}"


def send_verification_email(*, to_email: str, full_name: str, token: str) -> None:
    password = os.getenv("SMTP_PASSWORD")
    if not password:
        raise RuntimeError("SMTP_PASSWORD is not configured.")

    from_email = os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_FROM") or DEFAULT_FROM_EMAIL
    from_name = os.getenv("SMTP_FROM_NAME", "ShiftPlanner")
    username = os.getenv("SMTP_USERNAME", from_email)
    if "@" not in username and "@" in from_email:
        username = from_email
    host = os.getenv("SMTP_HOST", DEFAULT_SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", str(DEFAULT_SMTP_PORT)))
    use_ssl = _env_flag("SMTP_USE_SSL", True)
    force_ipv4 = _env_flag("SMTP_FORCE_IPV4", True)

    verification_url = build_verification_url(token)
    safe_name = escape(full_name or "there")
    safe_url = escape(verification_url)

    message = EmailMessage()
    message["Subject"] = "Confirm your ShiftPlanner email"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                f"Hello, {full_name or 'there'}!",
                "",
                "Confirm your email address for ShiftPlanner:",
                verification_url,
                "",
                "If you did not create a ShiftPlanner account, ignore this email.",
            ]
        )
    )
    message.add_alternative(
        f"""
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
        """,
        subtype="html",
    )

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
