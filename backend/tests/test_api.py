from io import BytesIO
from pathlib import Path
import sys

import psycopg
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import DATABASE_URL
from app.main import app
from app.repositories import company_repository
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


def seed_second_company_scope_data() -> None:
    manager_password_hash = "$2b$12$oo5ryRPAlz/TOfenPoE3JuFYJsdljzAhv.FLXcvx6vrvCPcCA1kTm"
    employee_password_hash = "$2b$12$uSYcqEdeSEBbX1C4vnns9.33t2QvChgi0eQ5RxJBGg8jCHGqu3w8a"

    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE companies SET manager_user_id = 1 WHERE id = 1")
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
                INSERT INTO companies (name, invite_code, manager_user_id)
                VALUES ('Other Company', %s, %s)
                RETURNING id
                """,
                (SECOND_COMPANY_INVITE_CODE, second_manager_id),
            )
            second_company_id = cursor.fetchone()[0]
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
                INSERT INTO employees (user_id, company_id, branch_id, position_id, max_hours_per_week)
                VALUES (%s, %s, %s, %s, 40)
                """,
                (second_employee_user_id, second_company_id, second_branch_id, second_position_id),
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
    assert employee_json["branch"] is None
    assert employee_json["position"] is None

    unauthorized = client.get("/auth/me")
    assert unauthorized.status_code == 401


def test_employee_without_assigned_position_returns_null(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE employees SET position_id = NULL WHERE id = 1")

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
            cursor.execute("UPDATE employees SET branch_id = 1, position_id = 1 WHERE id = 1")

    manager_headers = login_json(client, "manager@example.com", "manager123")

    response = client.get("/employees/", headers=manager_headers)
    assert response.status_code == 200, response.text
    employee = response.json()[0]
    assert employee["role"] == "employee"
    assert employee["position"] == {"id": 1, "name": "Barista"}
    assert employee["position_id"] == 1
    assert employee["position_title"] == "Barista"


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
    assert response.json() == {
        "id": 1,
        "name": "Coffee Bar Barnaul",
        "address": "Barnaul, Lenin Street",
        "invite_code": SEED_INVITE_CODE,
    }


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
    assert joined_json["company"]["name"] == "Coffee Bar Barnaul"
    assert joined_json["branch"]["id"] == 1
    assert joined_json["position"]["id"] == 2

    reloaded_profile = client.get("/auth/me", headers=employee_headers)
    assert reloaded_profile.status_code == 200, reloaded_profile.text
    reloaded_json = reloaded_profile.json()
    assert reloaded_json["employee_id"] == joined_json["employee_id"]
    assert reloaded_json["company"]["invite_code"] == SEED_INVITE_CODE
    assert reloaded_json["branch"]["id"] == 1
    assert reloaded_json["position"]["id"] == 2

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


def test_calendar_summary_reports_and_exchange_flow(client: TestClient) -> None:
    with psycopg.connect(PSYCOPG_DSN) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE employees SET branch_id = 1, position_id = 1 WHERE id = 1")

    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_json(client, "ivan@example.com", "employee123")

    draft_report = client.get("/reports/me?start_date=2026-06-15&end_date=2026-06-30", headers=employee_headers)
    assert draft_report.status_code == 200, draft_report.text
    assert draft_report.json()["total_shifts"] == 0

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
