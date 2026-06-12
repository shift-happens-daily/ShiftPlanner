from datetime import date, datetime, time, timezone

from app.schemas.company import CompanyCreate
from app.schemas.employee import AvailabilityUpsert, EmployeeCreate
from app.schemas.position import PositionCreate
from app.schemas.schedule import ScheduleRequirementCreate
from app.services.security import decode_access_token, get_password_hash


class MockDatabase:
    def __init__(self) -> None:
        self._company_id = 1
        self._position_id = 1
        self._employee_id = 1
        self._user_id = 1
        self._schedule_id = 1
        self._shift_id = 1
        self._requirement_id = 1
        self._exchange_request_id = 1

        self._companies: list[dict] = []
        self._positions: list[dict] = []
        self._employees: list[dict] = []
        self._users: list[dict] = []
        self._availability_records: dict[int, dict] = {}
        self._schedule_requirements: list[dict] = []
        self._schedules: list[dict] = []
        self._active_tokens: set[str] = set()
        self._exchange_requests: list[dict] = []

        self._seed()

    def _seed(self) -> None:
        self.create_company(CompanyCreate(name="Demo Company"))
        self._companies[0]["invite_code"] = "FPPFPF"

        position = self.create_position(PositionCreate(title="Barista"))
        employee = self.create_employee(
            EmployeeCreate(
                full_name="Ivan Ivanov",
                email="ivan@example.com",
                position_id=position["id"],
            )
        )

        self.upsert_availability(
            employee_id=employee["id"],
            payload=AvailabilityUpsert(
                weekly_availability=[
                    {"weekday": 0, "start_time": time(hour=9), "end_time": time(hour=18)},
                    {"weekday": 1, "start_time": time(hour=9), "end_time": time(hour=18)},
                    {"weekday": 2, "start_time": time(hour=9), "end_time": time(hour=18)},
                    {"weekday": 3, "start_time": time(hour=9), "end_time": time(hour=18)},
                    {"weekday": 4, "start_time": time(hour=9), "end_time": time(hour=18)},
                ],
                desired_days_off=[5, 6],
            ),
        )

        self.create_user(
            full_name="Demo Manager",
            email="manager@example.com",
            password_hash=get_password_hash("manager123"),
            role="manager",
            employee_id=None,
        )
        self.create_user(
            full_name=employee["full_name"],
            email=employee["email"],
            password_hash=get_password_hash("employee123"),
            role="employee",
            employee_id=employee["id"],
        )

    def decode_token(self, token: str) -> dict:
        return decode_access_token(token)

    def token_is_active(self, token: str) -> bool:
        return token in self._active_tokens

    def add_active_token(self, token: str) -> None:
        self._active_tokens.add(token)

    def remove_active_token(self, token: str) -> None:
        self._active_tokens.discard(token)

    def list_companies(self) -> list[dict]:
        return [company.copy() for company in self._companies]

    def create_company(self, payload: CompanyCreate) -> dict:
        company = {
            "id": self._next_company_id(),
            "name": payload.name,
            "invite_code": self._generate_invite_code(self._company_id - 1),
        }
        self._companies.append(company)
        return company.copy()

    def list_positions(self) -> list[dict]:
        return [position.copy() for position in self._positions]

    def create_position(self, payload: PositionCreate) -> dict:
        position = {
            "id": self._next_position_id(),
            "title": payload.title,
        }
        self._positions.append(position)
        return position.copy()

    def get_position_by_id(self, position_id: int) -> dict | None:
        return next((position.copy() for position in self._positions if position["id"] == position_id), None)

    def get_position_title(self, position_id: int) -> str:
        position = self.get_position_by_id(position_id)
        if position is None:
            raise ValueError(f"Position {position_id} was not found.")
        return position["title"]

    def list_employees(self) -> list[dict]:
        return [employee.copy() for employee in self._employees]

    def create_employee(self, payload: EmployeeCreate) -> dict:
        if self.get_position_by_id(payload.position_id) is None:
            raise ValueError(f"Position {payload.position_id} was not found.")
        if self.get_employee_by_email(payload.email) is not None:
            raise ValueError("An employee with this email already exists.")

        employee = {
            "id": self._next_employee_id(),
            "full_name": payload.full_name,
            "email": payload.email,
            "position_id": payload.position_id,
        }
        self._employees.append(employee)
        self._availability_records[employee["id"]] = {
            "employee_id": employee["id"],
            "weekly_availability": [],
            "desired_days_off": [],
        }
        return employee.copy()

    def get_employee_by_id(self, employee_id: int) -> dict | None:
        return next((employee.copy() for employee in self._employees if employee["id"] == employee_id), None)

    def get_employee_by_email(self, email: str) -> dict | None:
        return next(
            (employee.copy() for employee in self._employees if employee["email"].lower() == email.lower()),
            None,
        )

    def get_availability(self, employee_id: int) -> dict:
        availability = self._availability_records.get(employee_id)
        if availability is None:
            return {"employee_id": employee_id, "weekly_availability": [], "desired_days_off": []}
        return {
            "employee_id": availability["employee_id"],
            "weekly_availability": [block.copy() for block in availability["weekly_availability"]],
            "desired_days_off": list(availability["desired_days_off"]),
        }

    def upsert_availability(self, employee_id: int, payload: AvailabilityUpsert) -> dict:
        availability = {
            "employee_id": employee_id,
            "weekly_availability": [block.model_dump() for block in payload.weekly_availability],
            "desired_days_off": list(payload.desired_days_off),
        }
        self._availability_records[employee_id] = availability
        return self.get_availability(employee_id)

    def create_user(
        self,
        full_name: str,
        email: str,
        password_hash: str,
        role: str,
        employee_id: int | None,
    ) -> dict:
        user = {
            "id": self._next_user_id(),
            "full_name": full_name,
            "email": email,
            "password_hash": password_hash,
            "role": role,
            "employee_id": employee_id,
        }
        self._users.append(user)
        return user.copy()

    def get_user_by_email(self, email: str) -> dict | None:
        return next((user.copy() for user in self._users if user["email"].lower() == email.lower()), None)

    def get_user_by_id(self, user_id: int) -> dict | None:
        return next((user.copy() for user in self._users if user["id"] == user_id), None)

    def get_user_by_employee_id(self, employee_id: int) -> dict | None:
        return next((user.copy() for user in self._users if user.get("employee_id") == employee_id), None)

    def list_schedule_requirements(self, start_date: date | None = None, end_date: date | None = None) -> list[dict]:
        requirements = self._schedule_requirements
        if start_date is not None:
            requirements = [item for item in requirements if item["date"] >= start_date]
        if end_date is not None:
            requirements = [item for item in requirements if item["date"] <= end_date]
        return [requirement.copy() for requirement in requirements]

    def create_schedule_requirement(self, payload: ScheduleRequirementCreate) -> dict:
        position = self.get_position_by_id(payload.position_id)
        if position is None:
            raise ValueError(f"Position {payload.position_id} was not found.")

        requirement = {
            "id": self._next_requirement_id(),
            "position_id": payload.position_id,
            "position_title": position["title"],
            "date": payload.date,
            "min_staff": payload.min_staff,
            "start_time": payload.start_time,
            "end_time": payload.end_time,
        }
        self._schedule_requirements.append(requirement)
        return requirement.copy()

    def build_shift(
        self,
        employee_id: int,
        employee_name: str,
        position_id: int,
        position_name: str,
        shift_date: date,
        start_time: time,
        end_time: time,
    ) -> dict:
        return {
            "id": self._next_shift_id(),
            "employee_id": employee_id,
            "employee_name": employee_name,
            "position_id": position_id,
            "position": position_name,
            "date": shift_date,
            "start_time": start_time,
            "end_time": end_time,
        }

    def create_schedule(self, shifts: list[dict], unfilled_requirements: list[dict]) -> dict:
        schedule = {
            "id": self._next_schedule_id(),
            "status": "draft",
            "shifts": [shift.copy() for shift in shifts],
            "unfilled_requirements": [item.copy() for item in unfilled_requirements],
        }
        self._schedules.append(schedule)
        return self._copy_schedule(schedule)

    def get_schedule_by_id(self, schedule_id: int) -> dict | None:
        schedule = next((item for item in self._schedules if item["id"] == schedule_id), None)
        if schedule is None:
            return None
        return self._copy_schedule(schedule)

    def get_shift(self, schedule_id: int, shift_id: int) -> dict | None:
        schedule = next((item for item in self._schedules if item["id"] == schedule_id), None)
        if schedule is None:
            return None
        shift = next((item for item in schedule["shifts"] if item["id"] == shift_id), None)
        return None if shift is None else shift.copy()

    def remove_shift(self, schedule_id: int, shift_id: int) -> None:
        schedule = next(item for item in self._schedules if item["id"] == schedule_id)
        schedule["shifts"] = [shift for shift in schedule["shifts"] if shift["id"] != shift_id]

    def reassign_shift(self, schedule_id: int, shift_id: int, employee_id: int, employee_name: str) -> None:
        schedule = next(item for item in self._schedules if item["id"] == schedule_id)
        for shift in schedule["shifts"]:
            if shift["id"] == shift_id:
                shift["employee_id"] = employee_id
                shift["employee_name"] = employee_name
                return

    def publish_schedule(self, schedule_id: int) -> dict:
        schedule = next(item for item in self._schedules if item["id"] == schedule_id)
        schedule["status"] = "published"
        return self._copy_schedule(schedule)

    def list_published_schedules(self) -> list[dict]:
        published = [schedule for schedule in self._schedules if schedule["status"] == "published"]
        return [self._copy_schedule(schedule) for schedule in published]

    def list_current_published_shifts_for_employee(self, employee_id: int) -> list[dict]:
        published = [schedule for schedule in self._schedules if schedule["status"] == "published"]
        if not published:
            return []
        latest_schedule = max(published, key=lambda item: item["id"])
        return [shift.copy() for shift in latest_schedule["shifts"] if shift["employee_id"] == employee_id]

    def find_shift_across_schedules(self, shift_id: int) -> dict | None:
        for schedule in self._schedules:
            for shift in schedule["shifts"]:
                if shift["id"] == shift_id:
                    return shift.copy()
        return None

    def create_exchange_request(self, shift_id: int, employee_id: int, employee_name: str, note: str) -> dict:
        now = datetime.now(timezone.utc)
        exchange_request = {
            "id": self._next_exchange_request_id(),
            "shift_id": shift_id,
            "employee_id": employee_id,
            "employee_name": employee_name,
            "note": note,
            "status": "pending",
            "created_at": now,
            "updated_at": now,
        }
        self._exchange_requests.append(exchange_request)
        return exchange_request.copy()

    def list_exchange_requests(self, status_filter: str | None = None) -> list[dict]:
        requests = self._exchange_requests
        if status_filter is not None:
            requests = [item for item in requests if item["status"] == status_filter]
        return [request.copy() for request in requests]

    def get_exchange_request_by_id(self, exchange_request_id: int) -> dict | None:
        return next((item.copy() for item in self._exchange_requests if item["id"] == exchange_request_id), None)

    def update_exchange_request_status(self, exchange_request_id: int, status_value: str) -> dict:
        for request in self._exchange_requests:
            if request["id"] == exchange_request_id:
                request["status"] = status_value
                request["updated_at"] = datetime.now(timezone.utc)
                return request.copy()
        raise ValueError("Exchange request was not found.")

    def _copy_schedule(self, schedule: dict) -> dict:
        return {
            "id": schedule["id"],
            "status": schedule["status"],
            "shifts": [shift.copy() for shift in schedule["shifts"]],
            "unfilled_requirements": [item.copy() for item in schedule["unfilled_requirements"]],
        }

    def _generate_invite_code(self, company_id: int) -> str:
        return f"CMP{company_id:03d}"

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

    def _next_user_id(self) -> int:
        current_id = self._user_id
        self._user_id += 1
        return current_id

    def _next_schedule_id(self) -> int:
        current_id = self._schedule_id
        self._schedule_id += 1
        return current_id

    def _next_shift_id(self) -> int:
        current_id = self._shift_id
        self._shift_id += 1
        return current_id

    def _next_requirement_id(self) -> int:
        current_id = self._requirement_id
        self._requirement_id += 1
        return current_id

    def _next_exchange_request_id(self) -> int:
        current_id = self._exchange_request_id
        self._exchange_request_id += 1
        return current_id

mock_db = MockDatabase()
