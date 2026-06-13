from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.database import DATABASE_URL
from app.main import app
from app.services import auth_service

ROOT_DIR = Path(__file__).resolve().parents[1]
SCHEMA_SQL = (ROOT_DIR / "db" / "schema.sql").read_text(encoding="utf-8")
SEED_SQL = (ROOT_DIR / "db" / "seed.sql").read_text(encoding="utf-8")
PSYCOPG_DSN = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://", 1)


def _execute_script(cursor, script: str) -> None:
    for statement in script.split(";"):
        sql = statement.strip()
        if sql:
            cursor.execute(sql)


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


def login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_auth_and_rbac(client: TestClient) -> None:
    manager_headers = login(client, "manager@example.com", "manager123")
    employee_headers = login(client, "ivan@example.com", "employee123")

    invalid_login = client.post("/auth/login", json={"email": "manager@example.com", "password": "wrong-password"})
    assert invalid_login.status_code == 401

    unauthorized = client.get("/companies/")
    assert unauthorized.status_code == 401

    forbidden = client.post("/companies/", headers=employee_headers, json={"name": "Should Fail"})
    assert forbidden.status_code == 403

    company = client.post("/companies/", headers=manager_headers, json={"name": "North Branch"})
    assert company.status_code == 201, company.text

    position = client.post("/positions/", headers=manager_headers, json={"title": "Supervisor"})
    assert position.status_code == 201, position.text

    logout = client.post("/auth/logout", headers=manager_headers)
    assert logout.status_code == 200, logout.text

    after_logout = client.get("/companies/", headers=manager_headers)
    assert after_logout.status_code == 401


def test_employee_and_availability_flow(client: TestClient) -> None:
    manager_headers = login(client, "manager@example.com", "manager123")
    employee_headers = login(client, "ivan@example.com", "employee123")

    created_employee = client.post(
        "/employees/",
        headers=manager_headers,
        json={"full_name": "Anna Petrova", "email": "anna@example.com", "position_id": 2},
    )
    assert created_employee.status_code == 201, created_employee.text
    new_employee_id = created_employee.json()["id"]

    employees = client.get("/employees/", headers=manager_headers)
    assert employees.status_code == 200, employees.text
    assert len(employees.json()) == 2

    own_availability = client.post(
        "/employees/1/availability",
        headers=employee_headers,
        json={
            "weekly_availability": [{"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"}],
            "desired_days_off": [5],
        },
    )
    assert own_availability.status_code == 200, own_availability.text

    forbidden = client.post(
        f"/employees/{new_employee_id}/availability",
        headers=employee_headers,
        json={"weekly_availability": [], "desired_days_off": []},
    )
    assert forbidden.status_code == 403

    manager_update = client.post(
        f"/employees/{new_employee_id}/availability",
        headers=manager_headers,
        json={
            "weekly_availability": [{"weekday": 2, "start_time": "12:00:00", "end_time": "20:00:00"}],
            "desired_days_off": [6],
        },
    )
    assert manager_update.status_code == 200, manager_update.text
    assert manager_update.json()["employee_id"] == new_employee_id


def test_schedule_exchange_and_reports_flow(client: TestClient) -> None:
    manager_headers = login(client, "manager@example.com", "manager123")
    employee_headers = login(client, "ivan@example.com", "employee123")

    second_employee = client.post(
        "/employees/",
        headers=manager_headers,
        json={"full_name": "Petr Shift", "email": "petr@example.com", "position_id": 1},
    )
    assert second_employee.status_code == 201, second_employee.text
    second_employee_id = second_employee.json()["id"]

    requirement = client.post(
        "/schedule/requirements",
        headers=manager_headers,
        json={
            "position_id": 1,
            "date": "2026-06-16",
            "min_staff": 1,
            "start_time": "10:00:00",
            "end_time": "18:00:00",
        },
    )
    assert requirement.status_code == 201, requirement.text

    generated = client.post(
        "/schedule/generate",
        headers=manager_headers,
        json={"start_date": "2026-06-15", "end_date": "2026-06-21"},
    )
    assert generated.status_code == 200, generated.text
    schedule = generated.json()
    assert len(schedule["shifts"]) >= 2

    schedule_id = schedule["id"]
    reassigned_shift_id = schedule["shifts"][1]["id"]
    employee_shift_id = schedule["shifts"][0]["id"]

    reassigned = client.patch(
        f"/schedule/{schedule_id}/shifts/{reassigned_shift_id}",
        headers=manager_headers,
        json={"action": "reassign", "employee_id": second_employee_id},
    )
    assert reassigned.status_code == 200, reassigned.text

    published = client.post(f"/schedule/{schedule_id}/publish", headers=manager_headers)
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"

    my_schedule = client.get("/schedule/my", headers=employee_headers)
    assert my_schedule.status_code == 200, my_schedule.text
    assert len(my_schedule.json()) == 1

    exchange = client.post(
        "/schedule/exchange-requests",
        headers=employee_headers,
        json={"shift_id": employee_shift_id, "note": "Need a swap"},
    )
    assert exchange.status_code == 201, exchange.text
    exchange_id = exchange.json()["id"]

    pending = client.get("/schedule/exchange-requests", headers=manager_headers)
    assert pending.status_code == 200, pending.text
    assert len(pending.json()) == 1

    approved = client.patch(
        f"/schedule/exchange-requests/{exchange_id}",
        headers=manager_headers,
        json={"status": "approved"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"

    reports = client.get("/reports/employees?start_date=2026-06-15&end_date=2026-06-30", headers=manager_headers)
    assert reports.status_code == 200, reports.text
    report_rows = reports.json()
    assert len(report_rows) == 2
    assert sum(row["total_shifts"] for row in report_rows) == 2
