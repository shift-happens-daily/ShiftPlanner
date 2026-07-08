from io import BytesIO
from pathlib import Path
import sys
from datetime import date

import psycopg
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import DATABASE_URL
from app.main import app
from app.repositories import company_repository, user_repository
from app.services import auth_service

SCHEMA_SQL = (ROOT_DIR / "db" / "schema.sql").read_text(encoding="utf-8")
SEED_SQL = (ROOT_DIR / "db" / "seed.sql").read_text(encoding="utf-8")
PSYCOPG_DSN = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://", 1)
SEED_INVITE_CODE = "A7K9P2X4M8Q1L5R3"
SECOND_COMPANY_INVITE_CODE = "B8L0Q3Y5N9R2M6S4"
OTHER_REQUIREMENTS_INVITE_CODE = "C9M1R4Z6P0S3N7T5"


def _execute_script(cursor, script: str) -> None:
    cursor.execute(script, prepare=False)


def reset_database() -> None:
    with psycopg.connect(PSYCOPG_DSN, autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
            _execute_script(cursor, SCHEMA_SQL)
            _execute_script(cursor, SEED_SQL)
    auth_service._active_tokens.clear()


@pytest.fixture()
def client() -> TestClient:
    reset_database()
    with TestClient(app) as test_client:
        yield test_client


def login_json(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def login_form(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/auth/token", data={"username": email, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def build_requirements_workbook(rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["date", "position_id", "start_time", "end_time", "min_staff"])
    for row in rows:
        sheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def set_employee_assignment(
    cursor,
    employee_id: int,
    *,
    branch_id: int | None = None,
    branch_ids: list[int] | None = None,
    primary_branch_id: int | None = None,
    position_id: int | None = None,
) -> None:
    cursor.execute("DELETE FROM employee_branches WHERE employee_id = %s", (employee_id,))
    cursor.execute("DELETE FROM employee_positions WHERE employee_id = %s", (employee_id,))
    resolved_branch_ids = branch_ids if branch_ids is not None else ([] if branch_id is None else [branch_id])
    resolved_primary_branch_id = primary_branch_id if primary_branch_id is not None else branch_id
    if resolved_primary_branch_id is None and resolved_branch_ids:
        resolved_primary_branch_id = resolved_branch_ids[0]
    for resolved_branch_id in resolved_branch_ids:
        cursor.execute(
            "INSERT INTO employee_branches (employee_id, branch_id, is_primary) VALUES (%s, %s, %s)",
            (employee_id, resolved_branch_id, resolved_branch_id == resolved_primary_branch_id),
        )
    if position_id is not None:
        cursor.execute(
            "INSERT INTO employee_positions (employee_id, position_id, is_primary) VALUES (%s, %s, TRUE)",
            (employee_id, position_id),
        )


def seed_second_company_scope_data() -> None:
    manager_password_hash = "$2b$12$oo5ryRPAlz/TOfenPoE3JuFYJsdljzAhv.FLXcvx6vrvCPcCA1kTm"
    employee_password_hash = "$2b$12$uSYcqEdeSEBbX1C4vnns9.33t2QvChgi0eQ5RxJBGg8jCHGqu3w8a"

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES ('Second Manager', 'second-manager@example.com', %s, 'manager')
                RETURNING id
                """,
                (manager_password_hash,),
            )
            second_manager_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO companies (name, invite_code)
                VALUES ('Other Company', %s)
                RETURNING id
                """,
                (SECOND_COMPANY_INVITE_CODE,),
            )
            second_company_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO company_managers (company_id, user_id, manager_role)
                VALUES (%s, %s, 'owner')
                """,
                (second_company_id, second_manager_id),
            )
            cursor.execute(
                """
                INSERT INTO branches (company_id, name, address)
                VALUES (%s, 'Other Branch', 'Elsewhere')
                RETURNING id
                """,
                (second_company_id,),
            )
            second_branch_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO positions (company_id, name)
                VALUES (%s, 'Other Position')
                RETURNING id
                """,
                (second_company_id,),
            )
            second_position_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES ('Other Employee', 'other-employee@example.com', %s, 'employee')
                RETURNING id
                """,
                (employee_password_hash,),
            )
            second_employee_user_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO employees (user_id, company_id, max_hours_per_week)
                VALUES (%s, %s, 40)
                RETURNING id
                """,
                (second_employee_user_id, second_company_id),
            )
            second_employee_id = cursor.fetchone()[0]
            set_employee_assignment(
                cursor,
                second_employee_id,
                branch_id=second_branch_id,
                position_id=second_position_id,
            )


def test_auth_token_and_profile_endpoints(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_form(client, "ivan@example.com", "employee123")

    manager_profile = client.get("/auth/me", headers=manager_headers)
    assert manager_profile.status_code == 200, manager_profile.text
    manager_json = manager_profile.json()
    assert manager_json["role"] == "manager"
    assert manager_json["employee_id"] is None
    assert manager_json["company"]["invite_code"] == SEED_INVITE_CODE

    employee_profile = client.get("/auth/me", headers=employee_headers)
    assert employee_profile.status_code == 200, employee_profile.text
    employee_json = employee_profile.json()
    assert employee_json["role"] == "employee"
    assert employee_json["employee_id"] == 1
    assert employee_json["company"]["invite_code"] == SEED_INVITE_CODE
    assert employee_json["branch"] == {"id": 1, "name": "Main Branch"}
    assert employee_json["position"] == {"id": 1, "name": "Barista"}

    unauthorized = client.get("/auth/me")
    assert unauthorized.status_code == 401


def test_register_requires_email_verification_when_enabled(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    sent_messages: list[dict[str, str]] = []

    def fake_send_verification_email(*, to_email: str, full_name: str, token: str) -> None:
        sent_messages.append({"to_email": to_email, "full_name": full_name, "token": token})

    monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
    monkeypatch.setattr(auth_service.email_service, "send_verification_email", fake_send_verification_email)

    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Verify Me",
            "email": "verify-me@example.com",
            "password": "manager123",
            "role": "manager",
        },
    )

    assert registered.status_code == 201, registered.text
    assert registered.json()["email_verification_required"] is True
    assert sent_messages == [
        {
            "to_email": "verify-me@example.com",
            "full_name": "Verify Me",
            "token": sent_messages[0]["token"],
        }
    ]

    blocked_login = client.post(
        "/auth/login",
        json={"email": "verify-me@example.com", "password": "manager123"},
    )
    assert blocked_login.status_code == 403
    assert blocked_login.json()["detail"] == "Email is not verified."

    verified = client.get(f"/auth/verify-email?token={sent_messages[0]['token']}")
    assert verified.status_code == 200, verified.text

    login = client.post(
        "/auth/login",
        json={"email": "verify-me@example.com", "password": "manager123"},
    )
    assert login.status_code == 200, login.text

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT email_verified, email_verification_token, email_verification_expires_at
                FROM users
                WHERE email = 'verify-me@example.com'
                """
            )
            assert cursor.fetchone() == (True, None, None)


def test_register_email_delivery_failure_does_not_persist_user(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_send_verification_email(*, to_email: str, full_name: str, token: str) -> None:
        raise OSError("SMTP is unavailable")

    monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
    monkeypatch.setattr(auth_service.email_service, "send_verification_email", fail_send_verification_email)

    registered = client.post(
        "/auth/register",
        json={
            "full_name": "SMTP Failure",
            "email": "smtp-failure@example.com",
            "password": "manager123",
            "role": "manager",
        },
    )

    assert registered.status_code == 503
    assert registered.json()["detail"] == "Could not send verification email."

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'smtp-failure@example.com'")
            assert cursor.fetchone()[0] == 0


def test_user_can_delete_own_account(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    deleted = client.delete("/auth/me", headers=employee_headers)
    assert deleted.status_code == 204, deleted.text
    assert client.get("/auth/me", headers=employee_headers).status_code == 401

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'ivan@example.com'")
            assert cursor.fetchone()[0] == 0
            cursor.execute("SELECT COUNT(*) FROM employees WHERE id = 1")
            assert cursor.fetchone()[0] == 0


def test_manager_can_delete_own_account_without_deleting_company(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    deleted = client.delete("/auth/me", headers=manager_headers)
    assert deleted.status_code == 204, deleted.text

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM companies WHERE id = 1")
            assert cursor.fetchone()[0] == 1
            cursor.execute("SELECT COUNT(*) FROM company_managers WHERE company_id = 1 AND user_id = 1")
            assert cursor.fetchone()[0] == 0


def test_employee_branch_endpoints_and_response_shapes(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO branches (company_id, name, address) VALUES (1, 'Second Branch', 'North') RETURNING id"
            )
            second_branch_id = cursor.fetchone()[0]

    initial = client.get("/employees/1/branches", headers=manager_headers)
    assert initial.status_code == 200, initial.text
    assert initial.json() == [{"id": 1, "name": "Main Branch", "is_primary": True}]

    employee_self = client.get("/employees/1/branches", headers=employee_headers)
    assert employee_self.status_code == 200, employee_self.text

    replaced = client.put(
        "/employees/1/branches",
        headers=manager_headers,
        json={"branch_ids": [1, second_branch_id], "primary_branch_id": second_branch_id},
    )
    assert replaced.status_code == 200, replaced.text
    assert replaced.json() == [
        {"id": second_branch_id, "name": "Second Branch", "is_primary": True},
        {"id": 1, "name": "Main Branch", "is_primary": False},
    ]

    listed = client.get("/employees/", headers=manager_headers)
    assert listed.status_code == 200, listed.text
    employee = listed.json()[0]
    assert employee["branch_id"] == second_branch_id
    assert employee["branch"] == {"id": second_branch_id, "name": "Second Branch"}
    assert employee["branches"] == replaced.json()

    detail = client.get("/employees/1", headers=manager_headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["branch_id"] == second_branch_id
    assert detail.json()["branches"] == replaced.json()

    profile = client.get("/auth/me", headers=employee_headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["branch_id"] == second_branch_id
    assert profile.json()["branch"] == {"id": second_branch_id, "name": "Second Branch"}
    assert profile.json()["branches"] == replaced.json()


def test_employee_branch_endpoint_rejects_cross_company_and_invalid_primary(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM employees WHERE company_id = %s", (other_company_id,))
            other_employee_id = cursor.fetchone()[0]

    cross_company_read = client.get(f"/employees/{other_employee_id}/branches", headers=manager_headers)
    assert cross_company_read.status_code == 403

    foreign_branch = client.put(
        "/employees/1/branches",
        headers=manager_headers,
        json={"branch_ids": [1, other_branch_id], "primary_branch_id": 1},
    )
    assert foreign_branch.status_code == 403

    missing_primary = client.put(
        "/employees/1/branches",
        headers=manager_headers,
        json={"branch_ids": [1], "primary_branch_id": other_branch_id},
    )
    assert missing_primary.status_code == 400


def test_registered_user_receives_public_id_in_profile_without_membership(client: TestClient) -> None:
    requested_public_id = "frontend-value"
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Public ID User",
            "email": "public-id-user@example.com",
            "password": "employee456",
            "role": "employee",
            "public_id": requested_public_id,
        },
    )
    assert registered.status_code == 201, registered.text
    public_id = registered.json()["public_id"]
    assert len(public_id) == 16
    assert public_id.isalnum()
    assert public_id == public_id.upper()
    assert public_id != requested_public_id
    assert registered.json()["employee_id"] is None
    assert registered.json()["company_id"] is None

    headers = login_json(client, "public-id-user@example.com", "employee456")
    profile = client.get("/auth/me", headers=headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["public_id"] == public_id
    assert profile.json()["employee_id"] is None
    assert profile.json()["company_id"] is None


def test_public_id_collision_retries(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT public_id FROM users ORDER BY id LIMIT 1")
            existing_public_id = cursor.fetchone()[0]

    generated_public_id = "Z9Z9Z9Z9Z9Z9Z9Z9"
    generated_ids = iter([existing_public_id, generated_public_id])
    monkeypatch.setattr(user_repository, "_generate_public_id", lambda: next(generated_ids))

    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Collision User",
            "email": "public-id-collision@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    assert registered.json()["public_id"] == generated_public_id


def test_employee_response_exposes_immutable_public_id(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    original_public_id = employees.json()[0]["public_id"]

    updated = client.patch(
        "/employees/1/position",
        headers=manager_headers,
        json={"position_id": None, "public_id": "ZZZZZZZZZZZZZZZZ"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["public_id"] == original_public_id

    refreshed = client.get("/employees/", headers=manager_headers)
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()[0]["public_id"] == original_public_id


def test_manager_links_existing_user_by_public_id(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Link Target",
            "email": "link-target@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    public_id = registered.json()["public_id"]
    manager_headers = login_json(client, "manager@example.com", "manager123")

    linked = client.post(
        "/companies/me/link-user",
        headers=manager_headers,
        json={"user_public_id": public_id, "branch_id": None, "position_id": None},
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["public_id"] == public_id
    assert linked.json()["branch_id"] is None
    assert linked.json()["position_id"] is None
    assert linked.json()["position"] is None

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    assert public_id not in {employee["public_id"] for employee in employees.json()}

    requests = client.get("/companies/me/employee-requests", headers=manager_headers)
    assert requests.status_code == 200, requests.text
    request = next(item for item in requests.json() if item["public_id"] == public_id)
    assert request["is_active"] is False

    accepted = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=manager_headers,
        json={},
    )
    assert accepted.status_code == 200, accepted.text

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    assert public_id in {employee["public_id"] for employee in employees.json()}

    duplicate = client.post(
        "/companies/me/link-user",
        headers=manager_headers,
        json={"user_public_id": public_id},
    )
    assert duplicate.status_code == 409


def test_manager_links_existing_user_with_multiple_branches(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Multi Branch Link Target",
            "email": "multi-branch-link@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    public_id = registered.json()["public_id"]
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO branches (company_id, name, address) VALUES (1, 'Second Branch', 'North') RETURNING id"
            )
            second_branch_id = cursor.fetchone()[0]

    linked = client.post(
        "/companies/me/link-user",
        headers=manager_headers,
        json={
            "user_public_id": public_id,
            "branch_ids": [1, second_branch_id],
            "primary_branch_id": second_branch_id,
            "position_id": 1,
        },
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["branch_id"] == second_branch_id
    assert linked.json()["branches"] == [
        {"id": second_branch_id, "name": "Second Branch", "is_primary": True},
        {"id": 1, "name": "Main Branch", "is_primary": False},
    ]

    requests = client.get("/companies/me/employee-requests", headers=manager_headers)
    assert requests.status_code == 200, requests.text
    request = next(item for item in requests.json() if item["public_id"] == public_id)
    assert request["branch_id"] == second_branch_id
    assert request["branches"] == linked.json()["branches"]

    accepted = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=manager_headers,
        json={},
    )
    assert accepted.status_code == 200, accepted.text

    employees = client.get("/employees/", headers=manager_headers)
    employee = next(item for item in employees.json() if item["public_id"] == public_id)
    assert employee["branch_id"] == second_branch_id
    assert employee["branches"] == linked.json()["branches"]


def test_link_user_validates_target_access_and_assignments(client: TestClient) -> None:
    seed_second_company_scope_data()
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Assignment Target",
            "email": "assignment-target@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    public_id = registered.json()["public_id"]
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT public_id FROM users WHERE email = 'second-manager@example.com'")
            manager_public_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    missing = client.post(
        "/companies/me/link-user",
        headers=manager_headers,
        json={"user_public_id": "ZZZZZZZZZZZZZZZZ"},
    )
    assert missing.status_code == 404

    manager_target = client.post(
        "/companies/me/link-user",
        headers=manager_headers,
        json={"user_public_id": manager_public_id},
    )
    assert manager_target.status_code == 400

    foreign_branch = client.post(
        "/companies/me/link-user",
        headers=manager_headers,
        json={"user_public_id": public_id, "branch_id": other_branch_id},
    )
    assert foreign_branch.status_code == 403

    foreign_position = client.post(
        "/companies/me/link-user",
        headers=manager_headers,
        json={"user_public_id": public_id, "position_id": other_position_id},
    )
    assert foreign_position.status_code == 403

    employee_headers = login_json(client, "ivan@example.com", "employee123")
    forbidden = client.post(
        "/companies/me/link-user",
        headers=employee_headers,
        json={"user_public_id": public_id},
    )
    assert forbidden.status_code == 403
    assert client.post("/companies/me/link-user", json={"user_public_id": public_id}).status_code == 401


def test_employee_without_assigned_position_returns_null(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=None)

    employee_headers = login_json(client, "ivan@example.com", "employee123")
    manager_headers = login_json(client, "manager@example.com", "manager123")

    profile = client.get("/auth/me", headers=employee_headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["role"] == "employee"
    assert profile.json()["position"] is None

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    assert employees.json()[0]["position_id"] is None
    assert employees.json()[0]["position"] is None


def test_employees_list_includes_position_and_role(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)

    manager_headers = login_json(client, "manager@example.com", "manager123")

    response = client.get("/employees/", headers=manager_headers)
    assert response.status_code == 200, response.text
    employee = response.json()[0]
    assert employee["role"] == "employee"
    assert employee["position"] == {"id": 1, "name": "Barista"}
    assert employee["position_id"] == 1
    assert employee["position_title"] == "Barista"
    assert employee["max_hours_per_week"] == 40
    assert employee["max_hours_per_day"] == 8


def test_manager_can_read_and_update_employee_work_limits(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    initial = client.get("/employees/1/work-limits", headers=manager_headers)
    assert initial.status_code == 200, initial.text
    assert initial.json() == {"max_hours_per_week": 40, "max_hours_per_day": 8}

    employee_response = client.get("/employees/1/work-limits", headers=employee_headers)
    assert employee_response.status_code == 403
    assert client.get("/employees/1/work-limits").status_code == 401

    updated = client.patch(
        "/employees/1/work-limits",
        headers=manager_headers,
        json={"max_hours_per_week": 36, "max_hours_per_day": 6},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json() == {"max_hours_per_week": 36, "max_hours_per_day": 6}

    listed = client.get("/employees/", headers=manager_headers)
    assert listed.status_code == 200, listed.text
    employee = next(item for item in listed.json() if item["id"] == 1)
    assert employee["max_hours_per_week"] == 36
    assert employee["max_hours_per_day"] == 6

    invalid = client.patch(
        "/employees/1/work-limits",
        headers=manager_headers,
        json={"max_hours_per_week": 36, "max_hours_per_day": 25},
    )
    assert invalid.status_code == 422


def test_employee_work_limits_are_company_scoped(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM employees WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_employee_id = cursor.fetchone()[0]

    read_response = client.get(f"/employees/{other_employee_id}/work-limits", headers=manager_headers)
    assert read_response.status_code == 403

    update_response = client.patch(
        f"/employees/{other_employee_id}/work-limits",
        headers=manager_headers,
        json={"max_hours_per_week": 30, "max_hours_per_day": 5},
    )
    assert update_response.status_code == 403


def test_employee_position_data_does_not_change_role_permissions(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")
    payload = {"full_name": "Role Check", "email": "role-check@example.com", "position_id": 1}

    forbidden = client.post("/employees/", headers=employee_headers, json=payload)
    assert forbidden.status_code == 403

    created = client.post("/employees/", headers=manager_headers, json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["role"] == "employee"
    assert created.json()["position"] == {"id": 1, "name": "Barista"}


def test_manager_can_update_employee_position_and_list_reflects_it(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    updated = client.patch(
        "/employees/1/position",
        headers=manager_headers,
        json={"position_id": 2, "company_id": 999},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["position_id"] == 2
    assert updated.json()["position"] == {"id": 2, "name": "Cashier"}
    assert updated.json()["position_title"] == "Cashier"

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    employee = next(item for item in employees.json() if item["id"] == 1)
    assert employee["position"] == {"id": 2, "name": "Cashier"}


def test_employee_and_unauthenticated_users_cannot_update_employee_position(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    employee_response = client.patch(
        "/employees/1/position",
        headers=employee_headers,
        json={"position_id": 2},
    )
    assert employee_response.status_code == 403

    unauthorized = client.patch("/employees/1/position", json={"position_id": 2})
    assert unauthorized.status_code == 401


def test_manager_cannot_update_other_company_employee_or_assign_foreign_position(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM employees WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_employee_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    foreign_employee = client.patch(
        f"/employees/{other_employee_id}/position",
        headers=manager_headers,
        json={"position_id": 1},
    )
    assert foreign_employee.status_code == 403

    foreign_position = client.patch(
        "/employees/1/position",
        headers=manager_headers,
        json={"position_id": other_position_id},
    )
    assert foreign_position.status_code == 403


def test_manager_can_unassign_employee_position(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    updated = client.patch(
        "/employees/1/position",
        headers=manager_headers,
        json={"position_id": None},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["position_id"] is None
    assert updated.json()["position"] is None
    assert updated.json()["position_title"] == ""

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    assert employees.json()[0]["position"] is None


def test_employee_can_update_own_position(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    updated = client.patch(
        "/employees/me/position",
        headers=employee_headers,
        json={"position_id": 2},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["employee_id"] == 1
    assert updated.json()["company_id"] == 1
    assert updated.json()["position_id"] == 2
    assert updated.json()["position"] == {"id": 2, "name": "Cashier"}

    cleared = client.patch(
        "/employees/me/position",
        headers=employee_headers,
        json={"position_id": None},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["position_id"] is None
    assert cleared.json()["position"] is None


def test_employee_cannot_set_position_from_another_company(client: TestClient) -> None:
    seed_second_company_scope_data()
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    response = client.patch(
        "/employees/me/position",
        headers=employee_headers,
        json={"position_id": other_position_id},
    )
    assert response.status_code == 403


def test_employee_position_update_returns_clear_errors_for_invalid_ids(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    missing_employee = client.patch(
        "/employees/999999/position",
        headers=manager_headers,
        json={"position_id": 1},
    )
    assert missing_employee.status_code == 404
    assert missing_employee.json()["detail"] == "Employee was not found."

    missing_position = client.patch(
        "/employees/1/position",
        headers=manager_headers,
        json={"position_id": 999999},
    )
    assert missing_position.status_code == 404
    assert missing_position.json()["detail"] == "Position was not found."


def test_manager_can_update_own_company(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    updated = client.patch(
        "/companies/me",
        headers=manager_headers,
        json={
            "company_id": 999,
            "name": "Updated Coffee Bar",
            "address": "Updated Address 42",
        },
    )
    assert updated.status_code == 200, updated.text
    updated_json = updated.json()
    assert updated_json["id"] == 1
    assert updated_json["name"] == "Updated Coffee Bar"
    assert updated_json["address"] == "Updated Address 42"
    assert updated_json["invite_code"] == SEED_INVITE_CODE

    profile = client.get("/auth/me", headers=manager_headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["company"]["name"] == "Updated Coffee Bar"


def test_manager_gets_own_company_with_address(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    response = client.get("/companies/me", headers=manager_headers)
    assert response.status_code == 200, response.text
    response_json = response.json()
    assert response_json["id"] == 1
    assert response_json["name"] == "Coffee Bar Barnaul"
    assert response_json["address"] == "Barnaul, Lenin Street"
    assert response_json["invite_code"] == SEED_INVITE_CODE
    assert response_json["invite_code_generated_at"] is not None
    assert response_json["invite_code_expires_at"] is None


def test_employee_and_unauthenticated_users_cannot_get_manager_company(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    assert client.get("/companies/me", headers=employee_headers).status_code == 403
    assert client.get("/companies/me").status_code == 401


def test_new_companies_receive_unique_secure_invite_codes(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    first = client.post(
        "/companies/",
        headers=manager_headers,
        json={"name": "First Generated Company", "invite_code": "AAAAAAAAAAAAAAAA"},
    )
    second = client.post("/companies/", headers=manager_headers, json={"name": "Second Generated Company"})
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text

    first_code = first.json()["invite_code"]
    second_code = second.json()["invite_code"]
    assert len(first_code) == 16
    assert first_code.isascii() and first_code.isalnum() and first_code == first_code.upper()
    assert len(second_code) == 16
    assert second_code.isascii() and second_code.isalnum() and second_code == second_code.upper()
    assert first_code != second_code
    assert first_code != "AAAAAAAAAAAAAAAA"

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT invite_code_generated_at, invite_code_expires_at FROM companies WHERE id = %s",
                (first.json()["id"],),
            )
            generated_at, expires_at = cursor.fetchone()
    assert generated_at is not None
    assert expires_at is None


def test_invite_code_collision_retries(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    generated_code = "D0N2S5A7Q1T4P8V6"
    generated_codes = iter([SEED_INVITE_CODE, generated_code])
    monkeypatch.setattr(company_repository, "_generate_invite_code", lambda: next(generated_codes))
    manager_headers = login_json(client, "manager@example.com", "manager123")

    created = client.post("/companies/", headers=manager_headers, json={"name": "Collision Retry Company"})
    assert created.status_code == 201, created.text
    assert created.json()["invite_code"] == generated_code


def test_manager_regenerates_invite_code_and_new_code_joins(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    before = client.get("/companies/me", headers=manager_headers)
    assert before.status_code == 200, before.text
    old_code = before.json()["invite_code"]

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE companies SET invite_code_generated_at = TIMESTAMP '2020-01-01 00:00:00' WHERE id = 1"
            )

    regenerated = client.post("/companies/me/invite-code/regenerate", headers=manager_headers)
    assert regenerated.status_code == 200, regenerated.text
    regenerated_json = regenerated.json()
    new_code = regenerated_json["invite_code"]
    assert len(new_code) == 16
    assert new_code.isascii() and new_code.isalnum() and new_code == new_code.upper()
    assert new_code != old_code
    assert not regenerated_json["invite_code_generated_at"].startswith("2020-01-01")
    assert regenerated_json["invite_code_expires_at"] is None

    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Regenerated Invite User",
            "email": "regenerated-invite@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    employee_headers = login_json(client, "regenerated-invite@example.com", "employee456")

    old_join = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": old_code, "branch_id": 1, "position_id": 1},
    )
    assert old_join.status_code == 404

    new_join = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": new_code, "branch_id": 1, "position_id": 1},
    )
    assert new_join.status_code == 200, new_join.text


def test_invite_code_regeneration_access_and_collision(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    replacement_code = "R3G5N7C9D1F2H4J6"
    generated_codes = iter([SEED_INVITE_CODE, replacement_code])
    monkeypatch.setattr(company_repository, "_generate_invite_code", lambda: next(generated_codes))
    manager_headers = login_json(client, "manager@example.com", "manager123")

    regenerated = client.post("/companies/me/invite-code/regenerate", headers=manager_headers)
    assert regenerated.status_code == 200, regenerated.text
    assert regenerated.json()["invite_code"] == replacement_code

    employee_headers = login_json(client, "ivan@example.com", "employee123")
    assert client.post("/companies/me/invite-code/regenerate", headers=employee_headers).status_code == 403
    assert client.post("/companies/me/invite-code/regenerate").status_code == 401


def test_manager_invite_request_accept_and_non_owner_permissions(client: TestClient) -> None:
    owner_headers = login_json(client, "manager@example.com", "manager123")
    regenerated = client.post("/companies/me/manager-invite-code/regenerate", headers=owner_headers)
    assert regenerated.status_code == 200, regenerated.text
    manager_code = regenerated.json()["manager_invite_code"]
    assert len(manager_code) == 16
    assert manager_code != SEED_INVITE_CODE

    candidate = client.post(
        "/auth/register",
        json={
            "full_name": "Pending Manager",
            "email": "pending-manager@example.com",
            "password": "manager456",
            "role": "manager",
        },
    )
    assert candidate.status_code == 201, candidate.text
    candidate_headers = login_json(client, "pending-manager@example.com", "manager456")

    joined = client.post(
        "/companies/join-as-manager",
        headers=candidate_headers,
        json={"invite_code": manager_code},
    )
    assert joined.status_code == 200, joined.text
    assert joined.json()["manager_status"] == "pending"
    assert joined.json()["company_id"] is None
    assert client.get("/companies/me", headers=candidate_headers).status_code == 403
    assert client.get("/employees/", headers=candidate_headers).status_code == 403

    requests = client.get("/companies/me/manager-requests", headers=owner_headers)
    assert requests.status_code == 200, requests.text
    request = next(item for item in requests.json() if item["email"] == "pending-manager@example.com")
    assert request["membership_status"] == "pending"

    accepted = client.post(
        f"/companies/me/manager-requests/{request['id']}/accept",
        headers=owner_headers,
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["membership_status"] == "active"

    profile = client.get("/auth/me", headers=candidate_headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["manager_status"] == "active"
    assert profile.json()["company_id"] == 1
    assert client.get("/companies/me", headers=candidate_headers).status_code == 200

    second = client.post(
        "/auth/register",
        json={
            "full_name": "Second Pending Manager",
            "email": "second-pending-manager@example.com",
            "password": "manager456",
            "role": "manager",
        },
    )
    assert second.status_code == 201, second.text
    second_headers = login_json(client, "second-pending-manager@example.com", "manager456")
    assert client.post(
        "/companies/join-as-manager",
        headers=second_headers,
        json={"invite_code": manager_code},
    ).status_code == 200

    second_request = next(
        item
        for item in client.get("/companies/me/manager-requests", headers=owner_headers).json()
        if item["email"] == "second-pending-manager@example.com"
    )
    non_owner_accept = client.post(
        f"/companies/me/manager-requests/{second_request['id']}/accept",
        headers=candidate_headers,
    )
    assert non_owner_accept.status_code == 403


def test_first_manager_declines_manager_and_adds_by_public_id(client: TestClient) -> None:
    owner_headers = login_json(client, "manager@example.com", "manager123")
    target = client.post(
        "/auth/register",
        json={
            "full_name": "Public Manager",
            "email": "public-manager@example.com",
            "password": "manager456",
            "role": "manager",
        },
    )
    assert target.status_code == 201, target.text

    missing = client.post(
        "/companies/me/managers/by-public-id",
        headers=owner_headers,
        json={"user_public_id": "ZZZZZZZZZZZZZZZZ"},
    )
    assert missing.status_code == 404

    created = client.post(
        "/companies/me/managers/by-public-id",
        headers=owner_headers,
        json={"user_public_id": target.json()["public_id"]},
    )
    assert created.status_code == 200, created.text
    assert created.json()["membership_status"] == "pending"

    declined = client.post(
        f"/companies/me/manager-requests/{created.json()['id']}/decline",
        headers=owner_headers,
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["membership_status"] == "declined"

    requests = client.get("/companies/me/manager-requests", headers=owner_headers)
    assert requests.status_code == 200, requests.text
    assert created.json()["id"] not in {request["id"] for request in requests.json()}


def test_cannot_add_active_manager_from_another_company(client: TestClient) -> None:
    seed_second_company_scope_data()
    owner_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT public_id FROM users WHERE email = 'second-manager@example.com'")
            other_manager_public_id = cursor.fetchone()[0]

    response = client.post(
        "/companies/me/managers/by-public-id",
        headers=owner_headers,
        json={"user_public_id": other_manager_public_id},
    )
    assert response.status_code == 409


def test_active_manager_accepts_and_declines_employee_requests(client: TestClient) -> None:
    owner_headers = login_json(client, "manager@example.com", "manager123")

    accept_target = client.post(
        "/auth/register",
        json={
            "full_name": "Accept Employee",
            "email": "accept-employee@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    decline_target = client.post(
        "/auth/register",
        json={
            "full_name": "Decline Employee",
            "email": "decline-employee@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert accept_target.status_code == 201, accept_target.text
    assert decline_target.status_code == 201, decline_target.text

    accept_headers = login_json(client, "accept-employee@example.com", "employee456")
    decline_headers = login_json(client, "decline-employee@example.com", "employee456")
    assert client.post(
        "/companies/join",
        headers=accept_headers,
        json={"invite_code": SEED_INVITE_CODE},
    ).status_code == 200
    assert client.post(
        "/companies/join",
        headers=decline_headers,
        json={"invite_code": SEED_INVITE_CODE},
    ).status_code == 200

    employees = client.get("/employees/", headers=owner_headers)
    assert accept_target.json()["public_id"] not in {employee["public_id"] for employee in employees.json()}

    requests = client.get("/companies/me/employee-requests", headers=owner_headers)
    assert requests.status_code == 200, requests.text
    by_email = {request["email"]: request for request in requests.json()}
    accept_request = by_email["accept-employee@example.com"]
    decline_request = by_email["decline-employee@example.com"]

    accepted = client.post(
        f"/companies/me/employee-requests/{accept_request['id']}/accept",
        headers=owner_headers,
        json={"branch_id": 1, "position_id": 1},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["is_active"] is True
    assert accepted.json()["branch_id"] == 1
    assert accepted.json()["position_id"] == 1

    declined = client.post(
        f"/companies/me/employee-requests/{decline_request['id']}/decline",
        headers=owner_headers,
    )
    assert declined.status_code == 200, declined.text

    employees = client.get("/employees/", headers=owner_headers)
    assert employees.status_code == 200, employees.text
    employee_public_ids = {employee["public_id"] for employee in employees.json()}
    assert accept_target.json()["public_id"] in employee_public_ids
    assert decline_target.json()["public_id"] not in employee_public_ids


def test_employee_request_assignment_validation_and_cross_company_forbidden(client: TestClient) -> None:
    seed_second_company_scope_data()
    owner_headers = login_json(client, "manager@example.com", "manager123")

    target = client.post(
        "/auth/register",
        json={
            "full_name": "Validation Employee",
            "email": "validation-employee@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert target.status_code == 201, target.text
    target_headers = login_json(client, "validation-employee@example.com", "employee456")
    assert client.post(
        "/companies/join",
        headers=target_headers,
        json={"invite_code": SEED_INVITE_CODE},
    ).status_code == 200

    request = next(
        item
        for item in client.get("/companies/me/employee-requests", headers=owner_headers).json()
        if item["email"] == "validation-employee@example.com"
    )

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    foreign_branch = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=owner_headers,
        json={"branch_id": other_branch_id},
    )
    assert foreign_branch.status_code == 403

    foreign_position = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=owner_headers,
        json={"position_id": other_position_id},
    )
    assert foreign_position.status_code == 403

    other_manager_headers = login_json(client, "second-manager@example.com", "manager123")
    cross_company = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=other_manager_headers,
        json={},
    )
    assert cross_company.status_code == 403


def test_expired_invite_code_cannot_be_used_to_join(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Expired Invite User",
            "email": "expired-invite@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    employee_headers = login_json(client, "expired-invite@example.com", "employee456")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE companies SET invite_code_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = 1"
            )

    joined = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": SEED_INVITE_CODE, "branch_id": 1, "position_id": 1},
    )
    assert joined.status_code == 400
    assert joined.json()["detail"] == "Company invite code has expired."


def test_invalid_invite_code_formats_are_rejected(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    short_code = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": "SHORT123", "branch_id": None, "position_id": None},
    )
    assert short_code.status_code == 422

    invalid_characters = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": "A7K9P2X4M8Q1L5R!", "branch_id": None, "position_id": None},
    )
    assert invalid_characters.status_code == 422


def test_employee_joins_with_only_invite_code_and_manager_assigns_later(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Invite Only Employee",
            "email": "invite-only@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    employee_headers = login_json(client, "invite-only@example.com", "employee456")

    joined = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": SEED_INVITE_CODE},
    )
    assert joined.status_code == 200, joined.text
    joined_json = joined.json()
    assert joined_json["employee_status"] == "pending"
    assert joined_json["company_id"] is None
    assert joined_json["branch_id"] is None
    assert joined_json["position_id"] is None
    assert joined_json["branch"] is None
    assert joined_json["position"] is None

    manager_headers = login_json(client, "manager@example.com", "manager123")
    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    assert registered.json()["public_id"] not in {item["public_id"] for item in employees.json()}

    requests = client.get("/companies/me/employee-requests", headers=manager_headers)
    assert requests.status_code == 200, requests.text
    request = next(item for item in requests.json() if item["public_id"] == registered.json()["public_id"])
    assert request["branch_id"] is None
    assert request["position_id"] is None

    accepted = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=manager_headers,
        json={},
    )
    assert accepted.status_code == 200, accepted.text

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    employee = next(item for item in employees.json() if item["public_id"] == registered.json()["public_id"])
    assert employee["branch_id"] is None
    assert employee["position_id"] is None

    assigned_position = client.patch(
        f"/employees/{employee['id']}/position",
        headers=manager_headers,
        json={"position_id": 1},
    )
    assert assigned_position.status_code == 200, assigned_position.text
    assert assigned_position.json()["position_id"] == 1

    assigned_branch = client.patch(
        f"/employees/{employee['id']}/branch",
        headers=manager_headers,
        json={"branch_id": 1},
    )
    assert assigned_branch.status_code == 200, assigned_branch.text
    assert assigned_branch.json()["branch_id"] == 1

    unassigned_branch = client.patch(
        f"/employees/{employee['id']}/branch",
        headers=manager_headers,
        json={"branch_id": None},
    )
    assert unassigned_branch.status_code == 200, unassigned_branch.text
    assert unassigned_branch.json()["branch_id"] is None

    assert client.patch(
        f"/employees/{employee['id']}/branch",
        headers=employee_headers,
        json={"branch_id": None},
    ).status_code == 403
    assert client.patch(
        f"/employees/{employee['id']}/branch",
        json={"branch_id": None},
    ).status_code == 401


def test_employee_joins_with_partial_optional_assignments(client: TestClient) -> None:
    for email in ("position-only@example.com", "branch-only@example.com"):
        registered = client.post(
            "/auth/register",
            json={
                "full_name": "Partial Assignment Employee",
                "email": email,
                "password": "employee456",
                "role": "employee",
            },
        )
        assert registered.status_code == 201, registered.text

    position_headers = login_json(client, "position-only@example.com", "employee456")
    position_only = client.post(
        "/companies/join",
        headers=position_headers,
        json={"invite_code": SEED_INVITE_CODE, "branch_id": None, "position_id": 1},
    )
    assert position_only.status_code == 200, position_only.text
    assert position_only.json()["employee_status"] == "pending"
    assert position_only.json()["company_id"] is None
    assert position_only.json()["branch_id"] is None
    assert position_only.json()["position_id"] is None
    assert position_only.json()["position"] is None

    branch_headers = login_json(client, "branch-only@example.com", "employee456")
    branch_only = client.post(
        "/companies/join",
        headers=branch_headers,
        json={"invite_code": SEED_INVITE_CODE, "branch_id": 1, "position_id": None},
    )
    assert branch_only.status_code == 200, branch_only.text
    assert branch_only.json()["employee_status"] == "pending"
    assert branch_only.json()["branch_id"] is None
    assert branch_only.json()["position_id"] is None
    assert branch_only.json()["position"] is None

    manager_headers = login_json(client, "manager@example.com", "manager123")
    requests = client.get("/companies/me/employee-requests", headers=manager_headers)
    assert requests.status_code == 200, requests.text
    by_email = {request["email"]: request for request in requests.json()}
    assert by_email["position-only@example.com"]["position_id"] == 1
    assert by_email["branch-only@example.com"]["branch_id"] == 1


def test_employee_joins_with_multiple_branches(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Multi Branch Join Employee",
            "email": "multi-branch-join@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO branches (company_id, name, address) VALUES (1, 'Second Branch', 'North') RETURNING id"
            )
            second_branch_id = cursor.fetchone()[0]

    employee_headers = login_json(client, "multi-branch-join@example.com", "employee456")
    joined = client.post(
        "/companies/join",
        headers=employee_headers,
        json={
            "invite_code": SEED_INVITE_CODE,
            "branch_ids": [1, second_branch_id],
            "primary_branch_id": second_branch_id,
            "position_id": 1,
        },
    )
    assert joined.status_code == 200, joined.text
    assert joined.json()["employee_status"] == "pending"
    assert joined.json()["branch_id"] is None
    assert joined.json()["branches"] == []

    manager_headers = login_json(client, "manager@example.com", "manager123")
    requests = client.get("/companies/me/employee-requests", headers=manager_headers)
    assert requests.status_code == 200, requests.text
    request = next(item for item in requests.json() if item["email"] == "multi-branch-join@example.com")
    assert request["branch_id"] == second_branch_id
    assert request["branches"] == [
        {"id": second_branch_id, "name": "Second Branch", "is_primary": True},
        {"id": 1, "name": "Main Branch", "is_primary": False},
    ]

    accepted = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=manager_headers,
        json={},
    )
    assert accepted.status_code == 200, accepted.text

    profile = client.get("/auth/me", headers=employee_headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["branch_id"] == second_branch_id
    assert profile.json()["branches"] == request["branches"]


def test_join_rejects_branch_and_position_from_another_company(client: TestClient) -> None:
    seed_second_company_scope_data()
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Foreign Assignment Employee",
            "email": "foreign-assignment@example.com",
            "password": "employee456",
            "role": "employee",
        },
    )
    assert registered.status_code == 201, registered.text
    employee_headers = login_json(client, "foreign-assignment@example.com", "employee456")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    foreign_branch = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": SEED_INVITE_CODE, "branch_id": other_branch_id},
    )
    assert foreign_branch.status_code == 400

    foreign_position = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": SEED_INVITE_CODE, "position_id": other_position_id},
    )
    assert foreign_position.status_code == 400

    manager_headers = login_json(client, "manager@example.com", "manager123")
    foreign_branch_assignment = client.patch(
        "/employees/1/branch",
        headers=manager_headers,
        json={"branch_id": other_branch_id},
    )
    assert foreign_branch_assignment.status_code == 403


def test_manager_can_create_and_list_branches_with_address(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    created = client.post(
        "/companies/branches",
        headers=manager_headers,
        json={"name": "North Branch", "address": "North Street 10"},
    )
    assert created.status_code == 201, created.text
    created_json = created.json()
    assert created_json["company_id"] == 1
    assert created_json["name"] == "North Branch"
    assert created_json["address"] == "North Street 10"

    listed = client.get("/companies/branches", headers=manager_headers)
    assert listed.status_code == 200, listed.text
    assert created_json in listed.json()

    legacy_created = client.post(
        "/companies/1/branches",
        headers=manager_headers,
        json={"name": "Legacy Branch", "address": "Legacy Street 5"},
    )
    assert legacy_created.status_code == 201, legacy_created.text
    legacy_listed = client.get("/companies/1/branches", headers=manager_headers)
    assert legacy_listed.status_code == 200, legacy_listed.text
    assert legacy_created.json() in legacy_listed.json()


def test_manager_can_update_and_delete_own_branch(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    created = client.post(
        "/companies/branches",
        headers=manager_headers,
        json={"name": "Temporary Branch", "address": "Old Address"},
    )
    assert created.status_code == 201, created.text
    branch_id = created.json()["id"]

    updated = client.patch(
        f"/companies/branches/{branch_id}",
        headers=manager_headers,
        json={"name": "Updated Branch", "address": "New Address"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Updated Branch"
    assert updated.json()["address"] == "New Address"

    deleted = client.delete(f"/companies/branches/{branch_id}", headers=manager_headers)
    assert deleted.status_code == 204, deleted.text

    listed = client.get("/companies/branches", headers=manager_headers)
    assert listed.status_code == 200, listed.text
    assert branch_id not in [branch["id"] for branch in listed.json()]


def test_employee_and_unauthenticated_users_cannot_update_or_delete_branches(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    employee_update = client.patch(
        "/companies/branches/1",
        headers=employee_headers,
        json={"address": "Forbidden"},
    )
    assert employee_update.status_code == 403
    employee_delete = client.delete("/companies/branches/1", headers=employee_headers)
    assert employee_delete.status_code == 403

    assert client.patch("/companies/branches/1", json={"address": "No Token"}).status_code == 401
    assert client.delete("/companies/branches/1").status_code == 401


def test_manager_cannot_update_or_delete_other_company_branch(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]

    update = client.patch(
        f"/companies/branches/{other_branch_id}",
        headers=manager_headers,
        json={"name": "Not Allowed", "address": "Not Allowed"},
    )
    assert update.status_code == 403
    delete = client.delete(f"/companies/branches/{other_branch_id}", headers=manager_headers)
    assert delete.status_code == 403


def test_invalid_and_referenced_branches_cannot_be_deleted(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    missing_update = client.patch(
        "/companies/branches/999999",
        headers=manager_headers,
        json={"address": "Missing"},
    )
    assert missing_update.status_code == 404
    missing_delete = client.delete("/companies/branches/999999", headers=manager_headers)
    assert missing_delete.status_code == 404

    referenced = client.delete("/companies/branches/1", headers=manager_headers)
    assert referenced.status_code == 409
    assert "assigned to employees or requirements" in referenced.json()["detail"]


def test_employee_and_unauthenticated_users_cannot_update_company(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    employee_update = client.patch(
        "/companies/me",
        headers=employee_headers,
        json={"name": "Employee Edit", "address": "Forbidden Address"},
    )
    assert employee_update.status_code == 403

    unauthorized = client.patch(
        "/companies/me",
        json={"name": "Anonymous Edit", "address": "No Token"},
    )
    assert unauthorized.status_code == 401


def test_manager_without_company_cannot_update_company(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "No Company Manager",
            "email": "no-company-manager@example.com",
            "password": "manager456",
            "role": "manager",
        },
    )
    assert registered.status_code == 201, registered.text

    manager_headers = login_json(client, "no-company-manager@example.com", "manager456")
    update = client.patch(
        "/companies/me",
        headers=manager_headers,
        json={"name": "Should Not Update", "address": "No Company"},
    )
    assert update.status_code == 403


def test_employee_and_position_lists_are_scoped_to_authenticated_company(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")
    second_manager_headers = login_json(client, "second-manager@example.com", "manager123")

    first_company_employees = client.get("/employees/", headers=manager_headers)
    assert first_company_employees.status_code == 200, first_company_employees.text
    assert [employee["full_name"] for employee in first_company_employees.json()] == ["Ivan Barista"]

    first_company_positions = client.get("/positions/", headers=manager_headers)
    assert first_company_positions.status_code == 200, first_company_positions.text
    assert [position["title"] for position in first_company_positions.json()] == ["Barista", "Cashier"]

    second_company_employees = client.get("/employees/", headers=second_manager_headers)
    assert second_company_employees.status_code == 200, second_company_employees.text
    assert [employee["full_name"] for employee in second_company_employees.json()] == ["Other Employee"]

    second_company_positions = client.get("/positions/", headers=second_manager_headers)
    assert second_company_positions.status_code == 200, second_company_positions.text
    assert [position["title"] for position in second_company_positions.json()] == ["Other Position"]

    assert client.get("/employees/").status_code == 401
    assert client.get("/positions/").status_code == 401


def test_manager_can_remove_employee_from_own_company_without_deleting_user(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    deleted = client.delete("/employees/1", headers=manager_headers)
    assert deleted.status_code == 204, deleted.text

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    assert employees.json() == []

    profile = client.get("/auth/me", headers=employee_headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["employee_id"] is None
    assert profile.json()["company_id"] is None

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'ivan@example.com'")
            assert cursor.fetchone()[0] == 1
            cursor.execute("SELECT COUNT(*) FROM employees WHERE id = 1")
            assert cursor.fetchone()[0] == 0


def test_manager_cannot_remove_employee_from_another_company(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM employees WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_employee_id = cursor.fetchone()[0]

    response = client.delete(f"/employees/{other_employee_id}", headers=manager_headers)
    assert response.status_code == 403

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM employees WHERE id = %s", (other_employee_id,))
            assert cursor.fetchone()[0] == 1


def test_employee_can_leave_company_without_deleting_user_account(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    deleted = client.delete("/employees/me", headers=employee_headers)
    assert deleted.status_code == 204, deleted.text

    profile = client.get("/auth/me", headers=employee_headers)
    assert profile.status_code == 200, profile.text
    assert profile.json()["employee_id"] is None
    assert profile.json()["company_id"] is None
    assert profile.json()["company"] is None

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'ivan@example.com'")
            assert cursor.fetchone()[0] == 1
            cursor.execute("SELECT COUNT(*) FROM employees WHERE id = 1")
            assert cursor.fetchone()[0] == 0


def test_manager_can_delete_own_unused_position(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO positions (company_id, name) VALUES (1, 'Temporary Position') RETURNING id"
            )
            position_id = cursor.fetchone()[0]

    deleted = client.delete(f"/positions/{position_id}", headers=manager_headers)
    assert deleted.status_code == 204, deleted.text

    positions = client.get("/positions/", headers=manager_headers)
    assert positions.status_code == 200, positions.text
    assert position_id not in [position["id"] for position in positions.json()]


def test_employee_and_unauthenticated_users_cannot_delete_position(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    employee_response = client.delete("/positions/2", headers=employee_headers)
    assert employee_response.status_code == 403

    unauthorized = client.delete("/positions/2")
    assert unauthorized.status_code == 401


def test_manager_cannot_delete_other_company_position(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    response = client.delete(f"/positions/{other_position_id}", headers=manager_headers)
    assert response.status_code == 403


def test_deleting_non_existing_position_returns_not_found(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    response = client.delete("/positions/999999", headers=manager_headers)
    assert response.status_code == 404


def test_referenced_position_cannot_be_deleted(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    response = client.delete("/positions/1", headers=manager_headers)
    assert response.status_code == 409
    assert "assigned to employees, requirements, or shifts" in response.json()["detail"]


def test_requirements_are_fetched_by_company_branch_and_date_range(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO branches (company_id, name, address) VALUES (1, 'Second Branch', 'Second Address') RETURNING id"
            )
            second_branch_id = cursor.fetchone()[0]
            cursor.execute(
                "INSERT INTO companies (name, invite_code) VALUES ('Other Company', %s) RETURNING id",
                (OTHER_REQUIREMENTS_INVITE_CODE,),
            )
            other_company_id = cursor.fetchone()[0]
            cursor.execute(
                "INSERT INTO branches (company_id, name, address) VALUES (%s, 'Other Branch', 'Other Address') RETURNING id",
                (other_company_id,),
            )
            other_branch_id = cursor.fetchone()[0]
            cursor.execute(
                "INSERT INTO positions (company_id, name) VALUES (%s, 'Other Requirement Position') RETURNING id",
                (other_company_id,),
            )
            other_position_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO shift_requirements
                    (company_id, branch_id, position_id, shift_date, start_time, end_time, required_employees)
                VALUES
                    (1, 1, 1, '2026-06-16', '09:00', '17:00', 2),
                    (1, 1, 1, '2026-06-19', '09:00', '17:00', 3),
                    (1, %s, 1, '2026-06-16', '10:00', '18:00', 4),
                    (%s, %s, %s, '2026-06-16', '11:00', '19:00', 5)
                """,
                (second_branch_id, other_company_id, other_branch_id, other_position_id),
            )

    response = client.get(
        "/schedule/requirements?branch_id=1&date_from=2026-06-16&date_to=2026-06-18",
        headers=manager_headers,
    )
    assert response.status_code == 200, response.text
    requirements = response.json()
    assert [(item["branch_id"], item["date"], item["required_count"]) for item in requirements] == [
        (1, "2026-06-16", 2)
    ]
    assert requirements[0]["min_staff"] == 2

    unauthorized = client.get("/schedule/requirements?branch_id=1&date_from=2026-06-16&date_to=2026-06-18")
    assert unauthorized.status_code == 401


def test_manager_can_create_date_based_requirement_and_fetch_it(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    created = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={
            "company_id": 999,
            "branch_id": 1,
            "date": "2026-07-01",
            "position_id": 1,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "required_count": 3,
        },
    )
    assert created.status_code == 201, created.text
    created_json = created.json()
    assert created_json["branch_id"] == 1
    assert created_json["date"] == "2026-07-01"
    assert created_json["position_id"] == 1
    assert created_json["required_count"] == 3
    assert created_json["min_staff"] == 3

    fetched = client.get(
        "/schedule/requirements?branch_id=1&date_from=2026-07-01&date_to=2026-07-01",
        headers=manager_headers,
    )
    assert fetched.status_code == 200, fetched.text
    assert [requirement["id"] for requirement in fetched.json()] == [created_json["id"]]


def test_employee_and_unauthenticated_users_cannot_create_requirement(client: TestClient) -> None:
    employee_headers = login_json(client, "ivan@example.com", "employee123")
    payload = {
        "branch_id": 1,
        "date": "2026-07-02",
        "position_id": 1,
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "required_count": 2,
    }

    employee_response = client.post("/schedule/requirements", headers=employee_headers, json=payload)
    assert employee_response.status_code == 403

    unauthorized = client.post("/schedule/requirements", json=payload)
    assert unauthorized.status_code == 401


def test_requirement_create_for_other_company_branch_or_position_is_forbidden(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    base_payload = {
        "date": "2026-07-03",
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "required_count": 2,
    }

    foreign_branch = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={**base_payload, "branch_id": other_branch_id, "position_id": 1},
    )
    assert foreign_branch.status_code == 403

    foreign_position = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={**base_payload, "branch_id": 1, "position_id": other_position_id},
    )
    assert foreign_position.status_code == 403


def test_manager_can_update_own_requirement_and_fetch_it(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    created = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={
            "branch_id": 1,
            "date": "2026-07-04",
            "position_id": 1,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "required_count": 2,
        },
    )
    assert created.status_code == 201, created.text
    requirement_id = created.json()["id"]

    updated = client.patch(
        f"/schedule/requirements/{requirement_id}",
        headers=manager_headers,
        json={
            "company_id": 999,
            "date": "2026-07-05",
            "branch_id": 1,
            "position_id": 2,
            "start_time": "10:00:00",
            "end_time": "18:00:00",
            "required_count": 5,
        },
    )
    assert updated.status_code == 200, updated.text
    updated_json = updated.json()
    assert updated_json["id"] == requirement_id
    assert updated_json["date"] == "2026-07-05"
    assert updated_json["branch_id"] == 1
    assert updated_json["position_id"] == 2
    assert updated_json["start_time"] == "10:00:00"
    assert updated_json["end_time"] == "18:00:00"
    assert updated_json["required_count"] == 5
    assert updated_json["min_staff"] == 5

    fetched = client.get(
        "/schedule/requirements?branch_id=1&date_from=2026-07-05&date_to=2026-07-05",
        headers=manager_headers,
    )
    assert fetched.status_code == 200, fetched.text
    assert [requirement["id"] for requirement in fetched.json()] == [requirement_id]
    assert fetched.json()[0]["required_count"] == 5


def test_employee_and_unauthenticated_users_cannot_update_requirement(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    created = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={
            "branch_id": 1,
            "date": "2026-07-06",
            "position_id": 1,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "required_count": 2,
        },
    )
    assert created.status_code == 201, created.text
    requirement_id = created.json()["id"]
    payload = {"date": "2026-07-07", "required_count": 3}

    employee_response = client.patch(f"/schedule/requirements/{requirement_id}", headers=employee_headers, json=payload)
    assert employee_response.status_code == 403

    unauthorized = client.patch(f"/schedule/requirements/{requirement_id}", json=payload)
    assert unauthorized.status_code == 401


def test_manager_cannot_update_other_company_requirement(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_position_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO shift_requirements
                    (company_id, branch_id, position_id, shift_date, start_time, end_time, required_employees)
                VALUES (%s, %s, %s, '2026-07-08', '09:00', '17:00', 2)
                RETURNING id
                """,
                (other_company_id, other_branch_id, other_position_id),
            )
            other_requirement_id = cursor.fetchone()[0]

    response = client.patch(
        f"/schedule/requirements/{other_requirement_id}",
        headers=manager_headers,
        json={"required_count": 4},
    )
    assert response.status_code == 403


def test_manager_cannot_move_requirement_to_other_company_branch_or_position(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    created = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={
            "branch_id": 1,
            "date": "2026-07-09",
            "position_id": 1,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "required_count": 2,
        },
    )
    assert created.status_code == 201, created.text
    requirement_id = created.json()["id"]

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s ORDER BY id LIMIT 1", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    foreign_branch = client.patch(
        f"/schedule/requirements/{requirement_id}",
        headers=manager_headers,
        json={"branch_id": other_branch_id},
    )
    assert foreign_branch.status_code == 403

    foreign_position = client.patch(
        f"/schedule/requirements/{requirement_id}",
        headers=manager_headers,
        json={"position_id": other_position_id},
    )
    assert foreign_position.status_code == 403


def test_invite_preview_and_join_flow(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    preview = client.get(f"/companies/invite/{SEED_INVITE_CODE}", headers=manager_headers)
    assert preview.status_code == 200, preview.text
    preview_json = preview.json()
    assert preview_json["company_name"] == "Coffee Bar Barnaul"
    assert len(preview_json["branches"]) == 1
    assert len(preview_json["positions"]) == 2

    invalid_preview = client.get("/companies/invite/BADCODE", headers=manager_headers)
    assert invalid_preview.status_code == 422

    register = client.post(
        "/auth/register",
        json={
            "full_name": "Anna Candidate",
            "email": "anna@example.com",
            "password": "employee12",
            "role": "employee",
        },
    )
    assert register.status_code == 201, register.text
    assert register.json()["employee_id"] is None

    employee_headers = login_json(client, "anna@example.com", "employee12")
    pre_join_profile = client.get("/auth/me", headers=employee_headers)
    assert pre_join_profile.status_code == 200, pre_join_profile.text
    assert pre_join_profile.json()["company"] is None

    invalid_branch = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": SEED_INVITE_CODE, "branch_id": 999, "position_id": 1},
    )
    assert invalid_branch.status_code == 400

    invalid_position = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": SEED_INVITE_CODE, "branch_id": 1, "position_id": 999},
    )
    assert invalid_position.status_code == 400

    joined = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": f"  {SEED_INVITE_CODE.lower()}  ", "branch_id": 1, "position_id": 2},
    )
    assert joined.status_code == 200, joined.text
    joined_json = joined.json()
    assert joined_json["employee_id"] is not None
    assert joined_json["employee_status"] == "pending"
    assert joined_json["company_id"] is None
    assert joined_json["company"] is None
    assert joined_json["branch"] is None
    assert joined_json["position"] is None

    reloaded_profile = client.get("/auth/me", headers=employee_headers)
    assert reloaded_profile.status_code == 200, reloaded_profile.text
    reloaded_json = reloaded_profile.json()
    assert reloaded_json["employee_id"] == joined_json["employee_id"]
    assert reloaded_json["employee_status"] == "pending"
    assert reloaded_json["company"] is None
    assert reloaded_json["branch"] is None
    assert reloaded_json["position"] is None

    requests = client.get("/companies/me/employee-requests", headers=manager_headers)
    assert requests.status_code == 200, requests.text
    request = next(item for item in requests.json() if item["email"] == "anna@example.com")
    accepted = client.post(
        f"/companies/me/employee-requests/{request['id']}/accept",
        headers=manager_headers,
        json={},
    )
    assert accepted.status_code == 200, accepted.text

    accepted_profile = client.get("/auth/me", headers=employee_headers)
    assert accepted_profile.status_code == 200, accepted_profile.text
    accepted_json = accepted_profile.json()
    assert accepted_json["employee_id"] == joined_json["employee_id"]
    assert accepted_json["employee_status"] == "active"
    assert accepted_json["company"]["invite_code"] == SEED_INVITE_CODE
    assert accepted_json["branch"]["id"] == 1
    assert accepted_json["position"]["id"] == 2

    manager_join = client.post("/companies/join", headers=manager_headers, json={"invite_code": SEED_INVITE_CODE})
    assert manager_join.status_code == 403


def test_absences_endpoints_and_access_rules(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    created_employee = client.post(
        "/employees/",
        headers=manager_headers,
        json={"full_name": "Petr Extra", "email": "petr@example.com", "position_id": 2},
    )
    assert created_employee.status_code == 201, created_employee.text
    other_employee_id = created_employee.json()["id"]

    manager_absence = client.post(
        "/employees/1/absences",
        headers=manager_headers,
        json={
            "absence_type": "vacation",
            "start_date": "2026-06-20",
            "end_date": "2026-06-25",
            "comment": "Family trip",
        },
    )
    assert manager_absence.status_code == 201, manager_absence.text
    absence_id = manager_absence.json()["id"]

    own_absence = client.post(
        "/employees/me/absences",
        headers=employee_headers,
        json={
            "absence_type": "sick_leave",
            "start_date": "2026-06-26",
            "end_date": "2026-06-27",
            "comment": "Flu",
        },
    )
    assert own_absence.status_code == 201, own_absence.text

    invalid_range = client.post(
        "/employees/me/absences",
        headers=employee_headers,
        json={
            "absence_type": "vacation",
            "start_date": "2026-06-30",
            "end_date": "2026-06-20",
            "comment": "Bad range",
        },
    )
    assert invalid_range.status_code == 422

    forbidden = client.post(
        f"/employees/{other_employee_id}/absences",
        headers=employee_headers,
        json={
            "absence_type": "other",
            "start_date": "2026-06-28",
            "end_date": "2026-06-28",
            "comment": "Not allowed",
        },
    )
    assert forbidden.status_code == 403

    filtered = client.get(
        "/employees/1/absences?start_date=2026-06-24&end_date=2026-06-30",
        headers=manager_headers,
    )
    assert filtered.status_code == 200, filtered.text
    assert len(filtered.json()) == 2

    deleted = client.delete(f"/employees/1/absences/{absence_id}", headers=manager_headers)
    assert deleted.status_code == 204

    after_delete = client.get("/employees/me/absences", headers=employee_headers)
    assert after_delete.status_code == 200, after_delete.text
    assert len(after_delete.json()) == 1


def test_bulk_requirements_creation_and_permissions(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    bulk = client.post(
        "/schedule/requirements/bulk",
        headers=manager_headers,
        json={
            "start_date": "2026-06-15",
            "end_date": "2026-06-21",
            "weekdays": [0, 1, 2, 3, 4],
            "requirements": [
                {"position_id": 1, "min_staff": 2, "start_time": "10:00:00", "end_time": "18:00:00"},
                {"position_id": 2, "min_staff": 1, "start_time": "12:00:00", "end_time": "20:00:00"},
            ],
        },
    )
    assert bulk.status_code == 201, bulk.text
    bulk_json = bulk.json()
    assert bulk_json["created_count"] == 10
    assert all(item["date"] != "2026-06-21" for item in bulk_json["requirements"])

    filtered = client.get(
        "/schedule/requirements?start_date=2026-06-15&end_date=2026-06-21&position_id=2",
        headers=manager_headers,
    )
    assert filtered.status_code == 200, filtered.text
    assert len(filtered.json()) == 5

    invalid_range = client.post(
        "/schedule/requirements/bulk",
        headers=manager_headers,
        json={
            "start_date": "2026-06-21",
            "end_date": "2026-06-15",
            "weekdays": [0],
            "requirements": [
                {"position_id": 1, "min_staff": 1, "start_time": "10:00:00", "end_time": "18:00:00"}
            ],
        },
    )
    assert invalid_range.status_code == 422

    forbidden = client.post(
        "/schedule/requirements/bulk",
        headers=employee_headers,
        json={
            "start_date": "2026-06-15",
            "end_date": "2026-06-15",
            "weekdays": [0],
            "requirements": [
                {"position_id": 1, "min_staff": 1, "start_time": "10:00:00", "end_time": "18:00:00"}
            ],
        },
    )
    assert forbidden.status_code == 403


def test_manager_publishes_own_draft_and_employee_visibility_changes(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    draft_schedule = client.get("/schedule/my", headers=employee_headers)
    assert draft_schedule.status_code == 200, draft_schedule.text
    assert draft_schedule.json() == []

    assert client.post("/schedule/1/publish", headers=employee_headers).status_code == 403
    assert client.post("/schedule/1/publish").status_code == 401

    published = client.post("/schedule/1/publish", headers=manager_headers)
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"

    visible_schedule = client.get("/schedule/my", headers=employee_headers)
    assert visible_schedule.status_code == 200, visible_schedule.text
    assert len(visible_schedule.json()) == 1
    assert visible_schedule.json()[0]["id"] == 1

    already_published = client.post("/schedule/1/publish", headers=manager_headers)
    assert already_published.status_code == 400


def test_manager_can_delete_own_company_schedule_and_related_rows(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    assert client.delete("/schedule/1", headers=employee_headers).status_code == 403
    assert client.delete("/schedule/1").status_code == 401

    published = client.post("/schedule/1/publish", headers=manager_headers)
    assert published.status_code == 200, published.text
    visible_schedule = client.get("/schedule/my", headers=employee_headers)
    assert visible_schedule.status_code == 200, visible_schedule.text
    assert len(visible_schedule.json()) == 1

    deleted = client.delete("/schedule/1", headers=manager_headers)
    assert deleted.status_code == 204, deleted.text

    hidden_schedule = client.get("/schedule/my", headers=employee_headers)
    assert hidden_schedule.status_code == 200, hidden_schedule.text
    assert hidden_schedule.json() == []

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM schedules WHERE id = 1")
            assert cursor.fetchone()[0] == 0
            cursor.execute("SELECT COUNT(*) FROM shifts WHERE schedule_id = 1")
            assert cursor.fetchone()[0] == 0
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM shift_assignments sa
                LEFT JOIN shifts s ON s.id = sa.shift_id
                WHERE s.id IS NULL
                """
            )
            assert cursor.fetchone()[0] == 0


def test_manager_cannot_delete_another_company_schedule(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (%s, '2026-08-01', '2026-08-07', 'published')
                RETURNING id
                """,
                (other_company_id,),
            )
            other_schedule_id = cursor.fetchone()[0]

    forbidden = client.delete(f"/schedule/{other_schedule_id}", headers=manager_headers)
    assert forbidden.status_code == 403

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM schedules WHERE id = %s", (other_schedule_id,))
            assert cursor.fetchone()[0] == 1


def test_manager_gets_latest_schedule_with_status_filters(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    latest_draft = client.get("/schedule/latest?status=draft", headers=manager_headers)
    assert latest_draft.status_code == 200, latest_draft.text
    assert latest_draft.json()["id"] == 1
    assert latest_draft.json()["status"] == "draft"
    assert len(latest_draft.json()["shifts"]) == 1

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-07-01', '2026-07-07', 'published')
                RETURNING id
                """
            )
            published_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-08-01', '2026-08-07', 'archived')
                RETURNING id
                """
            )
            archived_id = cursor.fetchone()[0]

    latest_published = client.get("/schedule/latest?status=published", headers=manager_headers)
    assert latest_published.status_code == 200, latest_published.text
    assert latest_published.json()["id"] == published_id
    assert latest_published.json()["status"] == "published"

    latest_archived = client.get("/schedule/latest?status=archived", headers=manager_headers)
    assert latest_archived.status_code == 200, latest_archived.text
    assert latest_archived.json()["id"] == archived_id
    assert latest_archived.json()["status"] == "archived"

    latest_any = client.get("/schedule/latest", headers=manager_headers)
    assert latest_any.status_code == 200, latest_any.text
    assert latest_any.json()["id"] == archived_id


def test_latest_schedule_is_manager_company_scoped_and_manager_only(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (%s, '2026-09-01', '2026-09-07', 'draft')
                RETURNING id
                """,
                (other_company_id,),
            )
            other_schedule_id = cursor.fetchone()[0]

    latest = client.get("/schedule/latest", headers=manager_headers)
    assert latest.status_code == 200, latest.text
    assert latest.json()["id"] == 1
    assert latest.json()["id"] != other_schedule_id
    assert client.get("/schedule/latest", headers=employee_headers).status_code == 403
    assert client.get("/schedule/latest").status_code == 401
    assert client.get("/schedule/latest?status=invalid", headers=manager_headers).status_code == 422

    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Latest Manager Without Company",
            "email": "latest-no-company@example.com",
            "password": "manager456",
            "role": "manager",
        },
    )
    assert registered.status_code == 201, registered.text
    no_company_headers = login_json(client, "latest-no-company@example.com", "manager456")
    assert client.get("/schedule/latest", headers=no_company_headers).status_code == 403


def test_latest_schedule_returns_404_when_company_has_no_schedules(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM schedules WHERE company_id = 1")

    manager_headers = login_json(client, "manager@example.com", "manager123")
    missing = client.get("/schedule/latest", headers=manager_headers)
    assert missing.status_code == 404


def test_manager_can_manually_add_edit_and_delete_shifts(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)

    manager_headers = login_json(client, "manager@example.com", "manager123")

    assigned = client.post(
        "/schedule/1/shifts",
        headers=manager_headers,
        json={
            "date": "2026-06-16",
            "start_time": "12:00:00",
            "end_time": "20:00:00",
            "position_id": 1,
            "employee_id": 1,
        },
    )
    assert assigned.status_code == 201, assigned.text
    assigned_shift = next(
        shift
        for shift in assigned.json()["shifts"]
        if shift["date"] == "2026-06-16" and shift["start_time"] == "12:00:00"
    )
    assert assigned_shift["employee_id"] == 1
    assert assigned_shift["position_id"] == 1

    unassigned = client.post(
        "/schedule/1/shifts",
        headers=manager_headers,
        json={
            "date": "2026-06-17",
            "start_time": "10:00:00",
            "end_time": "18:00:00",
            "position_id": 1,
        },
    )
    assert unassigned.status_code == 201, unassigned.text
    unassigned_shift = next(
        shift
        for shift in unassigned.json()["shifts"]
        if shift["date"] == "2026-06-17" and shift["start_time"] == "10:00:00"
    )
    assert unassigned_shift["employee_id"] is None
    assert unassigned_shift["employee_name"] is None

    edited = client.patch(
        f"/schedule/1/shifts/{unassigned_shift['id']}",
        headers=manager_headers,
        json={
            "date": "2026-06-18",
            "start_time": "10:00:00",
            "end_time": "18:00:00",
            "position_id": 1,
            "employee_id": 1,
        },
    )
    assert edited.status_code == 200, edited.text
    edited_shift = next(shift for shift in edited.json()["shifts"] if shift["id"] == unassigned_shift["id"])
    assert edited_shift["date"] == "2026-06-18"
    assert edited_shift["employee_id"] == 1

    deleted = client.delete(f"/schedule/1/shifts/{assigned_shift['id']}", headers=manager_headers)
    assert deleted.status_code == 204, deleted.text
    after_delete = client.get("/schedule/1", headers=manager_headers)
    assert assigned_shift["id"] not in [shift["id"] for shift in after_delete.json()["shifts"]]


def test_manager_can_assign_employee_to_unfilled_requirement(client: TestClient) -> None:
    password_hash = "$2b$12$uSYcqEdeSEBbX1C4vnns9.33t2QvChgi0eQ5RxJBGg8jCHGqu3w8a"
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)
            cursor.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES ('Cashier Cover', 'cashier-cover@example.com', %s, 'employee')
                RETURNING id
                """,
                (password_hash,),
            )
            user_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO employees (user_id, company_id)
                VALUES (%s, 1)
                RETURNING id
                """,
                (user_id,),
            )
            cover_employee_id = cursor.fetchone()[0]
            set_employee_assignment(cursor, cover_employee_id, branch_id=1, position_id=2)

    manager_headers = login_json(client, "manager@example.com", "manager123")
    requirement = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={
            "branch_id": 1,
            "position_id": 1,
            "date": "2026-06-16",
            "start_time": "12:00:00",
            "end_time": "20:00:00",
            "required_count": 1,
        },
    )
    assert requirement.status_code == 201, requirement.text

    assigned = client.post(
        f"/schedule/1/requirements/{requirement.json()['id']}/assign",
        headers=manager_headers,
        json={"employee_id": cover_employee_id},
    )
    assert assigned.status_code == 200, assigned.text
    assert any(
        shift["employee_id"] == cover_employee_id
        and shift["position_id"] == 1
        and shift["date"] == "2026-06-16"
        and shift["start_time"] == "12:00:00"
        for shift in assigned.json()["shifts"]
    )
    assert requirement.json()["id"] not in [
        item["requirement_id"]
        for item in assigned.json()["unfilled_requirements"]
    ]

    already_filled = client.post(
        f"/schedule/1/requirements/{requirement.json()['id']}/assign",
        headers=manager_headers,
        json={"employee_id": cover_employee_id},
    )
    assert already_filled.status_code == 400


def test_available_employees_filters_position_absence_availability_and_overlap(client: TestClient) -> None:
    password_hash = "$2b$12$uSYcqEdeSEBbX1C4vnns9.33t2QvChgi0eQ5RxJBGg8jCHGqu3w8a"
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)
            created_employee_ids = []
            for full_name, email, position_id in [
                ("Absent Barista", "absent-barista@example.com", 1),
                ("Busy Barista", "busy-barista@example.com", 1),
                ("Wrong Position", "wrong-position@example.com", 2),
                ("No Availability", "no-availability@example.com", 1),
            ]:
                cursor.execute(
                    """
                    INSERT INTO users (full_name, email, password_hash, role)
                    VALUES (%s, %s, %s, 'employee')
                    RETURNING id
                    """,
                    (full_name, email, password_hash),
                )
                user_id = cursor.fetchone()[0]
                cursor.execute(
                    """
                    INSERT INTO employees (user_id, company_id)
                    VALUES (%s, 1)
                    RETURNING id
                    """,
                    (user_id,),
                )
                employee_id = cursor.fetchone()[0]
                set_employee_assignment(cursor, employee_id, branch_id=1, position_id=position_id)
                created_employee_ids.append(employee_id)

            absent_id, busy_id, wrong_position_id, _no_availability_id = created_employee_ids
            cursor.execute(
                """
                INSERT INTO employee_availability (employee_id, weekday, start_time, end_time, availability_status)
                VALUES
                (%s, 1, '12:00', '20:00', 'available'),
                (%s, 1, '12:00', '20:00', 'available'),
                (%s, 1, '12:00', '20:00', 'available')
                """,
                (absent_id, busy_id, wrong_position_id),
            )
            cursor.execute(
                """
                INSERT INTO absences (employee_id, absence_type, start_date, end_date)
                VALUES (%s, 'vacation', '2026-06-16', '2026-06-16')
                """,
                (absent_id,),
            )
            cursor.execute(
                """
                INSERT INTO shifts (schedule_id, company_id, position_id, shift_date, start_time, end_time)
                VALUES (1, 1, 1, '2026-06-16', '13:00', '15:00')
                RETURNING id
                """
            )
            busy_shift_id = cursor.fetchone()[0]
            cursor.execute(
                "INSERT INTO shift_assignments (shift_id, employee_id, status) VALUES (%s, %s, 'assigned')",
                (busy_shift_id, busy_id),
            )

    manager_headers = login_json(client, "manager@example.com", "manager123")
    available = client.get(
        "/schedule/1/employees/available"
        "?date=2026-06-16&start_time=12:00:00&end_time=20:00:00&position_id=1",
        headers=manager_headers,
    )
    assert available.status_code == 200, available.text
    available_json = available.json()
    assert [employee["id"] for employee in available_json] == [1]
    assert available_json[0]["availability_status"] == "if_needed"
    assert available_json[0]["assigned_hours"] >= 8

    available_with_other_positions = client.get(
        "/schedule/1/employees/available"
        "?date=2026-06-16&start_time=12:00:00&end_time=20:00:00&position_id=1"
        "&include_other_positions=true",
        headers=manager_headers,
    )
    assert available_with_other_positions.status_code == 200, available_with_other_positions.text
    available_with_other_positions_json = available_with_other_positions.json()
    assert [employee["id"] for employee in available_with_other_positions_json] == [wrong_position_id, 1]
    assert available_with_other_positions_json[0]["position"]["id"] == 2


def test_manual_schedule_editing_access_and_company_scope(client: TestClient) -> None:
    seed_second_company_scope_data()
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s", (other_company_id,))
            other_position_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM employees WHERE company_id = %s", (other_company_id,))
            other_employee_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (%s, '2026-06-15', '2026-06-21', 'draft')
                RETURNING id
                """,
                (other_company_id,),
            )
            other_schedule_id = cursor.fetchone()[0]

    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")
    payload = {
        "date": "2026-06-16",
        "start_time": "12:00:00",
        "end_time": "20:00:00",
        "position_id": 1,
        "employee_id": 1,
    }

    assert client.post("/schedule/1/shifts", headers=employee_headers, json=payload).status_code == 403
    assert client.patch("/schedule/1/shifts/1", headers=employee_headers, json={"employee_id": 1}).status_code == 403
    assert client.delete("/schedule/1/shifts/1", headers=employee_headers).status_code == 403
    assert client.post("/schedule/1/requirements/1/assign", headers=employee_headers, json={"employee_id": 1}).status_code == 403
    assert client.get(
        "/schedule/1/employees/available?date=2026-06-16&start_time=12:00:00&end_time=20:00:00&position_id=1",
        headers=employee_headers,
    ).status_code == 403

    assert client.post(f"/schedule/{other_schedule_id}/shifts", headers=manager_headers, json=payload).status_code == 403
    assert client.get(
        f"/schedule/{other_schedule_id}/employees/available"
        "?date=2026-06-16&start_time=12:00:00&end_time=20:00:00&position_id=1",
        headers=manager_headers,
    ).status_code == 403
    assert client.post(
        "/schedule/1/shifts",
        headers=manager_headers,
        json={**payload, "position_id": other_position_id, "employee_id": None},
    ).status_code == 403
    assert client.post(
        "/schedule/1/shifts",
        headers=manager_headers,
        json={**payload, "employee_id": other_employee_id},
    ).status_code == 403


def test_manager_generation_is_company_scoped_and_publishable(client: TestClient) -> None:
    seed_second_company_scope_data()
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s", (other_company_id,))
            other_position_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO shift_requirements (
                    company_id, branch_id, position_id, shift_date,
                    start_time, end_time, required_employees
                )
                VALUES (%s, %s, %s, '2026-06-15', '09:00', '17:00', 1)
                """,
                (other_company_id, other_branch_id, other_position_id),
            )

    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")
    deleted_existing = client.delete("/schedule/1", headers=manager_headers)
    assert deleted_existing.status_code == 204, deleted_existing.text

    generated = client.post(
        "/schedule/generate",
        headers=manager_headers,
        json={"start_date": "2026-06-15", "end_date": "2026-06-15"},
    )
    assert generated.status_code == 200, generated.text
    generated_json = generated.json()
    schedule_id = generated_json["id"]
    assert generated_json["status"] == "draft"
    assert all(shift["position_id"] != other_position_id for shift in generated_json["shifts"])
    assert all(item["position_id"] != other_position_id for item in generated_json["unfilled_requirements"])

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT company_id, status FROM schedules WHERE id = %s", (schedule_id,))
            assert cursor.fetchone() == (1, "draft")
            cursor.execute("SELECT DISTINCT company_id FROM shifts WHERE schedule_id = %s", (schedule_id,))
            assert cursor.fetchall() == [(1,)]

    hidden = client.get("/schedule/my", headers=employee_headers)
    assert hidden.status_code == 200, hidden.text
    assert hidden.json() == []

    published = client.post(f"/schedule/{schedule_id}/publish", headers=manager_headers)
    assert published.status_code == 200, published.text
    visible = client.get("/schedule/my", headers=employee_headers)
    assert visible.status_code == 200, visible.text
    assert len(visible.json()) == 1


def test_generating_schedule_rejects_existing_overlapping_schedule(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE employees SET position_id = 1 WHERE id = 1")
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-07-01', '2026-07-10', 'draft')
                RETURNING id
                """
            )
            old_overlapping_draft_id = cursor.fetchone()[0]

    manager_headers = login_json(client, "manager@example.com", "manager123")
    generated = client.post(
        "/schedule/generate",
        headers=manager_headers,
        json={"start_date": "2026-07-06", "end_date": "2026-08-02"},
    )
    assert generated.status_code == 409, generated.text
    assert "Delete schedule" in generated.json()["detail"]

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM schedules WHERE id = %s", (old_overlapping_draft_id,))
            assert cursor.fetchone()[0] == 1
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM schedules
                WHERE company_id = 1
                  AND start_date = '2026-07-06'
                  AND end_date = '2026-08-02'
                """
            )
            assert cursor.fetchone()[0] == 0


def test_generating_four_week_period_creates_one_full_period_schedule(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE employees SET position_id = 1 WHERE id = 1")

    manager_headers = login_json(client, "manager@example.com", "manager123")
    requirements = client.post(
        "/schedule/requirements/bulk",
        headers=manager_headers,
        json={
            "start_date": "2026-07-06",
            "end_date": "2026-08-02",
            "weekdays": [0, 1, 2, 3, 4],
            "requirements": [
                {"position_id": 1, "min_staff": 1, "start_time": "09:00:00", "end_time": "17:00:00"}
            ],
        },
    )
    assert requirements.status_code == 201, requirements.text

    generated = client.post(
        "/schedule/generate",
        headers=manager_headers,
        json={"start_date": "2026-07-06", "end_date": "2026-08-02"},
    )
    assert generated.status_code == 200, generated.text
    generated_json = generated.json()
    schedule_id = generated_json["id"]
    assert generated_json["start_date"] == "2026-07-06"
    assert generated_json["end_date"] == "2026-08-02"
    assert generated_json["status"] == "draft"
    assert len(generated_json["shifts"]) == 20

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, start_date, end_date
                FROM schedules
                WHERE company_id = 1
                  AND status = 'draft'
                  AND start_date <= '2026-08-02'
                  AND end_date >= '2026-07-06'
                """
            )
            assert cursor.fetchall() == [(schedule_id, date(2026, 7, 6), date(2026, 8, 2))]
            cursor.execute("SELECT COUNT(DISTINCT schedule_id) FROM shifts WHERE schedule_id = %s", (schedule_id,))
            assert cursor.fetchone()[0] == 1
            cursor.execute("SELECT COUNT(*) FROM shifts WHERE schedule_id = %s", (schedule_id,))
            assert cursor.fetchone()[0] == 20


def test_publishing_full_period_schedule_exposes_all_employee_shifts(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE employees SET position_id = 1 WHERE id = 1")

    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")
    requirements = client.post(
        "/schedule/requirements/bulk",
        headers=manager_headers,
        json={
            "start_date": "2026-07-06",
            "end_date": "2026-08-02",
            "weekdays": [0, 1, 2, 3, 4],
            "requirements": [
                {"position_id": 1, "min_staff": 1, "start_time": "09:00:00", "end_time": "17:00:00"}
            ],
        },
    )
    assert requirements.status_code == 201, requirements.text
    generated = client.post(
        "/schedule/generate",
        headers=manager_headers,
        json={"start_date": "2026-07-06", "end_date": "2026-08-02"},
    )
    assert generated.status_code == 200, generated.text
    schedule_id = generated.json()["id"]

    published = client.post(f"/schedule/{schedule_id}/publish", headers=manager_headers)
    assert published.status_code == 200, published.text
    assert published.json()["start_date"] == "2026-07-06"
    assert published.json()["end_date"] == "2026-08-02"

    visible = client.get(
        "/schedule/my?date_from=2026-07-06&date_to=2026-08-02",
        headers=employee_headers,
    )
    assert visible.status_code == 200, visible.text
    assert len(visible.json()) == 20
    assert {shift["date"] for shift in visible.json()} >= {"2026-07-06", "2026-07-31"}


def test_employee_schedule_period_query_returns_all_matching_published_schedules(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE employees SET position_id = 1 WHERE id = 1")
            cursor.execute("UPDATE schedules SET status = 'published' WHERE id = 1")
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-07-01', '2026-07-07', 'published')
                RETURNING id
                """
            )
            second_schedule_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO shifts (schedule_id, company_id, position_id, shift_date, start_time, end_time)
                VALUES (%s, 1, 1, '2026-07-02', '09:00', '17:00')
                RETURNING id
                """,
                (second_schedule_id,),
            )
            second_shift_id = cursor.fetchone()[0]
            cursor.execute(
                "INSERT INTO shift_assignments (shift_id, employee_id, status) VALUES (%s, 1, 'assigned')",
                (second_shift_id,),
            )

    employee_headers = login_json(client, "ivan@example.com", "employee123")
    response = client.get(
        "/schedule/my?date_from=2026-06-01&date_to=2026-07-31",
        headers=employee_headers,
    )
    assert response.status_code == 200, response.text
    assert [shift["date"] for shift in response.json()] == ["2026-06-15", "2026-07-02"]

    filtered = client.get(
        "/schedule/my?date_from=2026-07-01&date_to=2026-07-31",
        headers=employee_headers,
    )
    assert filtered.status_code == 200, filtered.text
    assert [shift["date"] for shift in filtered.json()] == ["2026-07-02"]


def test_publishing_archives_only_overlapping_published_schedules(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE employees SET position_id = 1 WHERE id = 1")

    manager_headers = login_json(client, "manager@example.com", "manager123")
    requirements = client.post(
        "/schedule/requirements/bulk",
        headers=manager_headers,
        json={
            "start_date": "2026-07-06",
            "end_date": "2026-08-02",
            "weekdays": [0],
            "requirements": [
                {"position_id": 1, "min_staff": 1, "start_time": "09:00:00", "end_time": "17:00:00"}
            ],
        },
    )
    assert requirements.status_code == 201, requirements.text
    generated = client.post(
        "/schedule/generate",
        headers=manager_headers,
        json={"start_date": "2026-07-06", "end_date": "2026-08-02"},
    )
    assert generated.status_code == 200, generated.text
    schedule_id = generated.json()["id"]

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-07-01', '2026-07-10', 'published')
                RETURNING id
                """
            )
            overlapping_schedule_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-09-01', '2026-09-07', 'published')
                RETURNING id
                """
            )
            non_overlapping_schedule_id = cursor.fetchone()[0]

    published = client.post(f"/schedule/{schedule_id}/publish", headers=manager_headers)
    assert published.status_code == 200, published.text

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT status FROM schedules WHERE id = %s", (overlapping_schedule_id,))
            assert cursor.fetchone()[0] == "archived"
            cursor.execute("SELECT status FROM schedules WHERE id = %s", (non_overlapping_schedule_id,))
            assert cursor.fetchone()[0] == "published"
            cursor.execute("SELECT status FROM schedules WHERE id = %s", (schedule_id,))
            assert cursor.fetchone()[0] == "published"


def test_manager_can_list_schedules_overlapping_period(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE schedules SET status = 'published' WHERE id = 1")
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-07-01', '2026-07-07', 'published')
                RETURNING id
                """
            )
            overlapping_schedule_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (1, '2026-09-01', '2026-09-07', 'published')
                RETURNING id
                """
            )
            non_overlapping_schedule_id = cursor.fetchone()[0]

    response = client.get(
        "/schedule?date_from=2026-06-20&date_to=2026-07-02&status=published",
        headers=manager_headers,
    )
    assert response.status_code == 200, response.text
    schedule_ids = [schedule["id"] for schedule in response.json()]
    assert overlapping_schedule_id in schedule_ids
    assert non_overlapping_schedule_id not in schedule_ids
    assert all("start_date" in schedule and "end_date" in schedule for schedule in response.json())


def test_repeated_generation_requires_deleting_existing_schedule(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)

    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")
    payload = {"start_date": "2026-06-15", "end_date": "2026-06-21"}

    deleted_existing = client.delete("/schedule/1", headers=manager_headers)
    assert deleted_existing.status_code == 204, deleted_existing.text

    first = client.post("/schedule/generate", headers=manager_headers, json=payload)
    second = client.post("/schedule/generate", headers=manager_headers, json=payload)
    assert first.status_code == 200, first.text
    assert second.status_code == 409, second.text
    assert "Delete schedule" in second.json()["detail"]
    first_schedule_id = first.json()["id"]

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*) FROM schedules
                WHERE company_id = 1
                  AND start_date = '2026-06-15'
                  AND end_date = '2026-06-21'
                  AND status = 'draft'
                """
            )
            assert cursor.fetchone()[0] == 1
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM shift_assignments sa
                JOIN shifts s ON s.id = sa.shift_id
                WHERE s.schedule_id = %s
                """,
                (first_schedule_id,),
            )
            assert cursor.fetchone()[0] == 1

    assert client.get("/schedule/my", headers=employee_headers).json() == []
    published_first = client.post(f"/schedule/{first_schedule_id}/publish", headers=manager_headers)
    assert published_first.status_code == 200, published_first.text
    assert len(client.get("/schedule/my", headers=employee_headers).json()) == 1

    first_report = client.get(
        "/reports/me?start_date=2026-06-15&end_date=2026-06-21",
        headers=employee_headers,
    )
    assert first_report.status_code == 200, first_report.text
    assert first_report.json()["total_shifts"] == 1
    assert first_report.json()["total_hours"] == 8.0

    third = client.post("/schedule/generate", headers=manager_headers, json=payload)
    assert third.status_code == 409, third.text
    assert "Delete schedule" in third.json()["detail"]

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT status FROM schedules WHERE id = %s", (first_schedule_id,))
            assert cursor.fetchone()[0] == "published"

    final_schedule = client.get("/schedule/my", headers=employee_headers)
    assert final_schedule.status_code == 200, final_schedule.text
    assert len(final_schedule.json()) == 1
    final_report = client.get(
        "/reports/me?start_date=2026-06-15&end_date=2026-06-21",
        headers=employee_headers,
    )
    assert final_report.status_code == 200, final_report.text
    assert final_report.json()["total_shifts"] == 1
    assert final_report.json()["total_hours"] == 8.0


def test_manager_without_company_cannot_generate_schedule(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Generation Manager Without Company",
            "email": "generate-no-company@example.com",
            "password": "manager456",
            "role": "manager",
        },
    )
    assert registered.status_code == 201, registered.text
    headers = login_json(client, "generate-no-company@example.com", "manager456")

    generated = client.post("/schedule/generate", headers=headers, json={})
    assert generated.status_code == 403


def test_manager_cannot_publish_another_company_schedule(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (%s, '2026-08-01', '2026-08-07', 'draft')
                RETURNING id
                """,
                (other_company_id,),
            )
            other_schedule_id = cursor.fetchone()[0]

    forbidden = client.post(f"/schedule/{other_schedule_id}/publish", headers=manager_headers)
    assert forbidden.status_code == 403

    registered = client.post(
        "/auth/register",
        json={
            "full_name": "Manager Without Company",
            "email": "schedule-no-company@example.com",
            "password": "manager456",
            "role": "manager",
        },
    )
    assert registered.status_code == 201, registered.text
    no_company_headers = login_json(client, "schedule-no-company@example.com", "manager456")
    assert client.post("/schedule/1/publish", headers=no_company_headers).status_code == 403

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT status FROM schedules WHERE id = %s", (other_schedule_id,))
            assert cursor.fetchone()[0] == "draft"


def test_calendar_summary_reports_and_exchange_flow(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            set_employee_assignment(cursor, 1, branch_id=1, position_id=1)

    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    draft_report = client.get("/reports/me?start_date=2026-06-15&end_date=2026-06-30", headers=employee_headers)
    assert draft_report.status_code == 200, draft_report.text
    assert draft_report.json()["total_shifts"] == 0
    deleted_existing = client.delete("/schedule/1", headers=manager_headers)
    assert deleted_existing.status_code == 204, deleted_existing.text

    created_employee = client.post(
        "/employees/",
        headers=manager_headers,
        json={"full_name": "Petr Shift", "email": "petrshift@example.com", "position_id": 1},
    )
    assert created_employee.status_code == 201, created_employee.text
    second_employee_id = created_employee.json()["id"]

    client.post(
        "/employees/1/absences",
        headers=manager_headers,
        json={
            "absence_type": "vacation",
            "start_date": "2026-06-20",
            "end_date": "2026-06-25",
            "comment": "Trip",
        },
    )

    bulk = client.post(
        "/schedule/requirements/bulk",
        headers=manager_headers,
        json={
            "start_date": "2026-06-15",
            "end_date": "2026-06-16",
            "weekdays": [0, 1],
            "requirements": [
                {"position_id": 1, "min_staff": 1, "start_time": "10:00:00", "end_time": "18:00:00"}
            ],
        },
    )
    assert bulk.status_code == 201, bulk.text

    generated = client.post(
        "/schedule/generate",
        headers=manager_headers,
        json={"start_date": "2026-06-15", "end_date": "2026-06-21"},
    )
    assert generated.status_code == 200, generated.text
    generated_json = generated.json()
    schedule_id = generated_json["id"]
    shift_id = generated_json["shifts"][0]["id"]

    summary_before_publish = client.get(
        "/employees/me/calendar-summary?start_date=2026-06-15&end_date=2026-06-30",
        headers=employee_headers,
    )
    assert summary_before_publish.status_code == 200, summary_before_publish.text
    assert summary_before_publish.json()["workload"]["total_shifts"] == 0

    published = client.post(f"/schedule/{schedule_id}/publish", headers=manager_headers)
    assert published.status_code == 200, published.text

    exchange = client.post(
        "/schedule/exchange-requests",
        headers=employee_headers,
        json={"shift_id": shift_id, "note": "Need a swap"},
    )
    assert exchange.status_code == 201, exchange.text
    exchange_id = exchange.json()["id"]

    approve = client.patch(
        f"/schedule/exchange-requests/{exchange_id}",
        headers=manager_headers,
        json={"status": "approved"},
    )
    assert approve.status_code == 200, approve.text

    summary_manager = client.get(
        "/employees/1/calendar-summary?start_date=2026-06-15&end_date=2026-06-30",
        headers=manager_headers,
    )
    assert summary_manager.status_code == 200, summary_manager.text
    summary_json = summary_manager.json()
    assert summary_json["employee"]["full_name"] == "Ivan Barista"
    assert len(summary_json["absences"]) == 1
    assert summary_json["workload"]["total_shifts"] >= 1

    summary_employee = client.get(
        "/employees/me/calendar-summary?start_date=2026-06-15&end_date=2026-06-30",
        headers=employee_headers,
    )
    assert summary_employee.status_code == 200, summary_employee.text
    assert summary_employee.json()["workload"]["total_shifts"] >= 1

    forbidden_summary = client.get(
        f"/employees/{second_employee_id}/calendar-summary?start_date=2026-06-15&end_date=2026-06-30",
        headers=employee_headers,
    )
    assert forbidden_summary.status_code == 403

    manager_report = client.get("/reports/employees?start_date=2026-06-15&end_date=2026-06-30", headers=manager_headers)
    assert manager_report.status_code == 200, manager_report.text
    report_rows = manager_report.json()
    assert any(row["full_name"] == "Ivan Barista" for row in report_rows)
    assert any(row["total_shifts"] >= 1 for row in report_rows)

    my_report = client.get("/reports/me?start_date=2026-06-15&end_date=2026-06-30", headers=employee_headers)
    assert my_report.status_code == 200, my_report.text
    assert my_report.json()["full_name"] == "Ivan Barista"
    assert my_report.json()["total_shifts"] >= 1


def test_requirements_xlsx_import(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    workbook_bytes = build_requirements_workbook(
        [
            ["2026-06-18", 1, "10:00:00", "18:00:00", 2],
            ["2026-06-19", "", "12:00:00", "20:00:00", 1],
        ]
    )

    imported = client.post(
        "/imports/requirements/xlsx",
        headers=manager_headers,
        files={"file": ("requirements.xlsx", workbook_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert imported.status_code == 200, imported.text
    imported_json = imported.json()
    assert imported_json["created_count"] == 1
    assert imported_json["errors"][0]["row"] == 3

    forbidden = client.post(
        "/imports/requirements/xlsx",
        headers=employee_headers,
        files={"file": ("requirements.xlsx", workbook_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert forbidden.status_code == 403

    invalid = client.post(
        "/imports/requirements/xlsx",
        headers=manager_headers,
        files={"file": ("requirements.xlsx", b"not-an-xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert invalid.status_code == 400


def test_logout_invalidates_access_token(client: TestClient) -> None:
    headers = login_json(client, "manager@example.com", "manager123")

    logged_out = client.post("/auth/logout", headers=headers)
    assert logged_out.status_code == 200, logged_out.text
    assert logged_out.json() == {"detail": "Logged out successfully."}

    assert client.get("/auth/me", headers=headers).status_code == 401
    assert client.post("/auth/logout", headers=headers).status_code == 401

    fresh_headers = login_json(client, "manager@example.com", "manager123")
    assert client.get("/auth/me", headers=fresh_headers).status_code == 200


def test_validation_errors_are_normalized_by_field(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "full_name": "",
            "email": "ab",
            "password": "short",
            "role": "owner",
        },
    )

    assert response.status_code == 422, response.text
    errors = response.json()["detail"]
    assert {"field", "message"} <= set(errors[0])
    assert {"full_name", "email", "password", "role"} <= {error["field"] for error in errors}


def test_schedule_detail_is_company_scoped_and_employees_only_read_published(client: TestClient) -> None:
    seed_second_company_scope_data()
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO schedules (company_id, start_date, end_date, status)
                VALUES (%s, '2026-08-01', '2026-08-07', 'draft')
                RETURNING id
                """,
                (other_company_id,),
            )
            other_schedule_id = cursor.fetchone()[0]

    manager_headers = login_json(client, "manager@example.com", "manager123")
    second_manager_headers = login_json(client, "second-manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    own_schedule = client.get("/schedule/1", headers=manager_headers)
    assert own_schedule.status_code == 200, own_schedule.text
    assert own_schedule.json()["status"] == "draft"

    employee_draft = client.get("/schedule/1", headers=employee_headers)
    assert employee_draft.status_code == 403

    forbidden = client.get(f"/schedule/{other_schedule_id}", headers=manager_headers)
    assert forbidden.status_code == 403

    visible_to_owner = client.get(f"/schedule/{other_schedule_id}", headers=second_manager_headers)
    assert visible_to_owner.status_code == 200, visible_to_owner.text
    assert visible_to_owner.json()["id"] == other_schedule_id


def test_bulk_requirements_cannot_target_another_company_position(client: TestClient) -> None:
    seed_second_company_scope_data()
    manager_headers = login_json(client, "manager@example.com", "manager123")

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s", (other_company_id,))
            other_position_id = cursor.fetchone()[0]

    response = client.post(
        "/schedule/requirements/bulk",
        headers=manager_headers,
        json={
            "start_date": "2026-07-06",
            "end_date": "2026-07-06",
            "weekdays": [0],
            "requirements": [
                {"position_id": other_position_id, "min_staff": 1, "start_time": "09:00:00", "end_time": "17:00:00"}
            ],
        },
    )

    assert response.status_code == 403
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM shift_requirements WHERE company_id = %s", (other_company_id,))
            assert cursor.fetchone()[0] == 0


def test_requirement_delete_is_company_scoped(client: TestClient) -> None:
    seed_second_company_scope_data()
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM companies WHERE invite_code = %s", (SECOND_COMPANY_INVITE_CODE,))
            other_company_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM branches WHERE company_id = %s", (other_company_id,))
            other_branch_id = cursor.fetchone()[0]
            cursor.execute("SELECT id FROM positions WHERE company_id = %s", (other_company_id,))
            other_position_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO shift_requirements (
                    company_id, branch_id, position_id, shift_date,
                    start_time, end_time, required_employees
                )
                VALUES (%s, %s, %s, '2026-07-06', '09:00', '17:00', 1)
                RETURNING id
                """,
                (other_company_id, other_branch_id, other_position_id),
            )
            other_requirement_id = cursor.fetchone()[0]

    manager_headers = login_json(client, "manager@example.com", "manager123")
    second_manager_headers = login_json(client, "second-manager@example.com", "manager123")

    forbidden = client.delete(f"/schedule/requirements/{other_requirement_id}", headers=manager_headers)
    assert forbidden.status_code == 403

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM shift_requirements WHERE id = %s", (other_requirement_id,))
            assert cursor.fetchone()[0] == 1

    deleted = client.delete(f"/schedule/requirements/{other_requirement_id}", headers=second_manager_headers)
    assert deleted.status_code == 204, deleted.text

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM shift_requirements WHERE id = %s", (other_requirement_id,))
            assert cursor.fetchone()[0] == 0
