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
from app.services import auth_service

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


def test_auth_token_and_profile_endpoints(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")
    employee_headers = login_form(client, "ivan@example.com", "employee123")

    manager_profile = client.get("/auth/me", headers=manager_headers)
    assert manager_profile.status_code == 200, manager_profile.text
    manager_json = manager_profile.json()
    assert manager_json["role"] == "manager"
    assert manager_json["employee_id"] is None
    assert manager_json["company"] is None

    employee_profile = client.get("/auth/me", headers=employee_headers)
    assert employee_profile.status_code == 200, employee_profile.text
    employee_json = employee_profile.json()
    assert employee_json["role"] == "employee"
    assert employee_json["employee_id"] == 1
    assert employee_json["company"]["invite_code"] == "COFFEE123"
    assert employee_json["branch"]["name"] == "Main Branch"
    assert employee_json["position"]["name"] == "Barista"

    unauthorized = client.get("/auth/me")
    assert unauthorized.status_code == 401


def test_invite_preview_and_join_flow(client: TestClient) -> None:
    manager_headers = login_json(client, "manager@example.com", "manager123")

    preview = client.get("/companies/invite/COFFEE123", headers=manager_headers)
    assert preview.status_code == 200, preview.text
    preview_json = preview.json()
    assert preview_json["company_name"] == "Coffee Bar Barnaul"
    assert len(preview_json["branches"]) == 1
    assert len(preview_json["positions"]) == 2

    invalid_preview = client.get("/companies/invite/BADCODE", headers=manager_headers)
    assert invalid_preview.status_code == 404

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
        json={"invite_code": "COFFEE123", "branch_id": 999, "position_id": 1},
    )
    assert invalid_branch.status_code == 400

    invalid_position = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": "COFFEE123", "branch_id": 1, "position_id": 999},
    )
    assert invalid_position.status_code == 400

    joined = client.post(
        "/companies/join",
        headers=employee_headers,
        json={"invite_code": "COFFEE123", "branch_id": 1, "position_id": 2},
    )
    assert joined.status_code == 200, joined.text
    joined_json = joined.json()
    assert joined_json["employee_id"] is not None
    assert joined_json["company"]["name"] == "Coffee Bar Barnaul"
    assert joined_json["branch"]["id"] == 1
    assert joined_json["position"]["id"] == 2

    manager_join = client.post("/companies/join", headers=manager_headers, json={"invite_code": "COFFEE123"})
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
