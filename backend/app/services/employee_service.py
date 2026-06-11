from app.repositories import mock_db
from app.schemas.employee import EmployeeCreate, EmployeeRead


def list_employees() -> list[EmployeeRead]:
    return mock_db.list_employees()


def create_employee(payload: EmployeeCreate) -> EmployeeRead:
    return mock_db.create_employee(payload)
