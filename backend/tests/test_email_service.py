from app.services import email_service


class FakeResponse:
    status_code = 200
    text = "{}"


def test_send_verification_email_via_resend(monkeypatch):
    requests = []

    def fake_post(url, *, headers, json, timeout):
        requests.append(
            {
                "url": url,
                "headers": headers,
                "json": json,
                "timeout": timeout,
            }
        )
        return FakeResponse()

    monkeypatch.setenv("EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("EMAIL_FROM", "ShiftPlanner <no-reply@shiftplanner.online>")
    monkeypatch.setenv("PUBLIC_API_BASE_URL", "https://shiftplanner.online/api")
    monkeypatch.setattr(email_service.httpx, "post", fake_post)

    email_service.send_verification_email(
        to_email="user@example.com",
        full_name="Test User",
        token="verify-token",
    )

    assert len(requests) == 1
    request = requests[0]
    assert request["url"] == "https://api.resend.com/emails"
    assert request["headers"]["Authorization"] == "Bearer re_test"
    assert request["json"]["from"] == "ShiftPlanner <no-reply@shiftplanner.online>"
    assert request["json"]["to"] == "user@example.com"
    assert request["json"]["subject"] == "Confirm your ShiftPlanner email"
    assert "https://shiftplanner.online/api/auth/verify-email?token=verify-token" in request["json"]["text"]


def test_send_password_reset_email_via_resend(monkeypatch):
    requests = []

    def fake_post(url, *, headers, json, timeout):
        requests.append(
            {
                "url": url,
                "headers": headers,
                "json": json,
                "timeout": timeout,
            }
        )
        return FakeResponse()

    monkeypatch.setenv("EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("EMAIL_FROM", "ShiftPlanner <no-reply@shiftplanner.online>")
    monkeypatch.setenv("PASSWORD_RESET_URL", "https://shiftplanner.online/reset-password")
    monkeypatch.setattr(email_service.httpx, "post", fake_post)

    email_service.send_password_reset_email(
        to_email="user@example.com",
        full_name="Test User",
        token="reset-token",
    )

    assert len(requests) == 1
    request = requests[0]
    assert request["url"] == "https://api.resend.com/emails"
    assert request["headers"]["Authorization"] == "Bearer re_test"
    assert request["json"]["from"] == "ShiftPlanner <no-reply@shiftplanner.online>"
    assert request["json"]["to"] == "user@example.com"
    assert request["json"]["subject"] == "Reset your ShiftPlanner password"
    assert "https://shiftplanner.online/reset-password?token=reset-token" in request["json"]["text"]
