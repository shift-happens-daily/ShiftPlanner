from fastapi import HTTPException, status

from app.repositories import mock_db
from app.schemas.employee import AvailabilityRead, AvailabilityUpsert, EmployeeCreate, EmployeeRead


def list_employees() -> list[EmployeeRead]:
    return [_build_employee_read(employee) for employee in mock_db.list_employees()]


def create_employee(payload: EmployeeCreate) -> EmployeeRead:
    try:
        employee = mock_db.create_employee(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _build_employee_read(employee)


def get_availability(employee_id: int) -> AvailabilityRead:
    employee = mock_db.get_employee_by_id(employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    availability = mock_db.get_availability(employee_id)
    return AvailabilityRead(**availability)


def upsert_availability(employee_id: int, payload: AvailabilityUpsert) -> AvailabilityRead:
    employee = mock_db.get_employee_by_id(employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee was not found.")
    availability = mock_db.upsert_availability(employee_id, payload)
    return AvailabilityRead(**availability)


def _build_employee_read(employee: dict) -> EmployeeRead:
    availability = mock_db.get_availability(employee["id"])
    return EmployeeRead(
        id=employee["id"],
        full_name=employee["full_name"],
        email=employee["email"],
        position_id=employee["position_id"],
        position_title=mock_db.get_position_title(employee["position_id"]),
        availability=AvailabilityRead(**availability),
    )
