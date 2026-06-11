from datetime import date, time

from app.schemas.company import CompanyCreate, CompanyRead
from app.schemas.employee import EmployeeCreate, EmployeeRead
from app.schemas.position import PositionCreate, PositionRead
from app.schemas.schedule import ScheduleRead, ShiftRead


class MockDatabase:
    def __init__(self) -> None:
        self._company_id = 1
        self._position_id = 1
        self._employee_id = 1
        self._schedule_id = 1

        self._companies: list[CompanyRead] = []
        self._positions: list[PositionRead] = []
        self._employees: list[EmployeeRead] = []
        self._schedules: list[ScheduleRead] = []

        self._seed()

    def _seed(self) -> None:
        company = CompanyRead(id=self._next_company_id(), name="Demo Company", invite_code="FPPFPF")
        position = PositionRead(id=self._next_position_id(), title="Barista")
        employee = EmployeeRead(
            id=self._next_employee_id(),
            full_name="Ivan Ivanov",
            email="ivan@example.com",
            position_id=position.id,
            position_title=position.title,
        )

        self._companies.append(company)
        self._positions.append(position)
        self._employees.append(employee)

    def _next_company_id(self) -> int:
        current_id = self._company_id
        self._company_id += 1
        return current_id

    def _next_position_id(self) -> int:
        current_id = self._position_id
        self._position_id += 1
        return current_id

    def _next_employee_id(self) -> int:
        current_id = self._employee_id
        self._employee_id += 1
        return current_id

    def _next_schedule_id(self) -> int:
        current_id = self._schedule_id
        self._schedule_id += 1
        return current_id

    def _generate_invite_code(self, company_id: int) -> str:
        return f"CMP{company_id:03d}"

    def list_companies(self) -> list[CompanyRead]:
        return list(self._companies)

    def create_company(self, payload: CompanyCreate) -> CompanyRead:
        company_id = self._next_company_id()
        company = CompanyRead(
            id=company_id,
            name=payload.name,
            invite_code=self._generate_invite_code(company_id),
        )
        self._companies.append(company)
        return company

    def list_positions(self) -> list[PositionRead]:
        return list(self._positions)

    def create_position(self, payload: PositionCreate) -> PositionRead:
        position = PositionRead(id=self._next_position_id(), title=payload.title)
        self._positions.append(position)
        return position

    def get_position(self, position_id: int) -> PositionRead | None:
        return next((position for position in self._positions if position.id == position_id), None)

    def list_employees(self) -> list[EmployeeRead]:
        return list(self._employees)

    def create_employee(self, payload: EmployeeCreate) -> EmployeeRead:
        position = self.get_position(payload.position_id)
        if position is None:
            raise ValueError(f"Position {payload.position_id} was not found.")

        employee = EmployeeRead(
            id=self._next_employee_id(),
            full_name=payload.full_name,
            email=payload.email,
            position_id=payload.position_id,
            position_title=position.title,
        )
        self._employees.append(employee)
        return employee

    def create_schedule(self, start_date: date | None = None) -> ScheduleRead:
        employee = self._employees[0]
        shift_date = start_date or date(2026, 10, 26)
        shift = ShiftRead(
            employee_name=employee.full_name,
            position=employee.position_title,
            date=shift_date,
            start_time=time(hour=10, minute=0),
            end_time=time(hour=12, minute=0),
        )
        schedule = ScheduleRead(id=self._next_schedule_id(), status="draft", shifts=[shift])
        self._schedules.append(schedule)
        return schedule


mock_db = MockDatabase()
