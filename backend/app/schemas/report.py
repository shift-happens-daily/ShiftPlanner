from pydantic import BaseModel


class EmployeeReportRead(BaseModel):
    employee_id: int
    employee_name: str
    position: str
    total_hours: float
    total_shifts: int
