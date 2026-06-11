from pydantic import BaseModel


class EmployeeReportRead(BaseModel):
    employee_name: str
    position: str
    total_hours: int
    total_shifts: int
