from fastapi import APIRouter, HTTPException, status

from app.schemas.employee import EmployeeCreate, EmployeeRead
from app.services import employee_service

router = APIRouter()


@router.get("/", response_model=list[EmployeeRead])
def get_employees() -> list[EmployeeRead]:
    return employee_service.list_employees()


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate) -> EmployeeRead:
    try:
        return employee_service.create_employee(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
