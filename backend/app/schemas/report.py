from pydantic import BaseModel


class EmployeeReportRead(BaseModel):
    employee_id: int
    full_name: str
    position: str
    total_hours: float
    total_shifts: int


class EmployeeSelfReportRead(BaseModel):
    employee_id: int
    full_name: str
    total_hours: float
    total_shifts: int
