"""CP-SAT employee schedule generator for the normalized slot-based schema.

The public entry point is :func:`generate_schedule`. It reads all input through
the supplied SQLAlchemy session, solves the requested date range, and persists
one continuous row per employee/day in ``schedule_assignments`` plus slot-level
audit rows in ``schedule_assignment_slots``.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Iterable

from ortools.sat.python import cp_model
from sqlalchemy import text
from sqlalchemy.orm import Session


SLOT_MINUTES = 30
SLOTS_PER_HOUR = 60 // SLOT_MINUTES


@dataclass(frozen=True)
class EmployeeData:
    id: int
    profession_id: int
    weekly_target_slots: int
    min_daily_slots: int
    max_daily_slots: int


@dataclass(frozen=True)
class DemandKey:
    work_date: date
    slot_time: time
    profession_id: int


@dataclass(frozen=True)
class GeneratedAssignment:
    employee_id: int
    profession_id: int
    work_date: date
    start_time: time
    end_time: time
    slots: tuple[tuple[time, str], ...]


@dataclass(frozen=True)
class UncoveredSlot:
    key: DemandKey
    required_count: int
    uncovered_count: int
    reason: str


@dataclass(frozen=True)
class ScheduleResult:
    schedule_id: int
    solver_status: str
    assignments: tuple[GeneratedAssignment, ...]
    uncovered_slots: tuple[UncoveredSlot, ...]
    total_required_slots: int
    total_uncovered_slots: int


@dataclass
class LoadedData:
    employees: list[EmployeeData]
    dates: list[date]
    business_slots: dict[date, list[time]]
    demand: dict[DemandKey, int]
    availability: dict[tuple[int, int, time], str]
    absent_dates: set[tuple[int, date]]


class ScheduleDataError(ValueError):
    """Raised when database input violates a solver-level business invariant."""


def generate_schedule(
    db: Session,
    *,
    company_id: int,
    branch_id: int,
    start_date: date,
    end_date: date,
    max_time_seconds: float = 60.0,
    num_workers: int = 8,
    commit: bool = True,
) -> ScheduleResult:
    """Generate, persist, and return the best schedule found.

    Coverage is a soft constraint, so a valid result is persisted even when
    demand cannot be fully covered. The first optimization phase minimizes
    uncovered demand and then possible-availability use. A second phase keeps
    those values fixed and improves overstaffing, weekly target deviation, and
    unnecessary shift starts.
    """

    if end_date < start_date:
        raise ScheduleDataError("end_date must be on or after start_date")
    if max_time_seconds <= 0:
        raise ScheduleDataError("max_time_seconds must be positive")
    if num_workers <= 0:
        raise ScheduleDataError("num_workers must be positive")

    data = _load_data(
        db,
        company_id=company_id,
        branch_id=branch_id,
        start_date=start_date,
        end_date=end_date,
    )
    _validate_loaded_data(data)

    (
        model,
        assignment_vars,
        shortage_vars,
        overstaff_vars,
        start_vars,
        target_deviation_vars,
        candidate_counts,
    ) = _build_model(data)

    # Phase 1 is lexicographic in one safe weighted expression. One additional
    # uncovered employee-slot costs more than every possible-availability
    # assignment combined, so possible availability is never avoided by leaving
    # coverable demand unmet.
    possible_vars = [
        variable
        for key, variable in assignment_vars.items()
        if data.availability[(key[0], key[1].weekday(), key[2])] == "possible"
    ]
    max_possible_assignments = len(possible_vars)
    total_shortage = sum(shortage_vars.values())
    total_possible = sum(possible_vars)
    model.minimize(
        total_shortage * (max_possible_assignments + 1)
        + total_possible
    )

    first_solver = _new_solver(
        max_time_seconds=max_time_seconds * 0.7,
        num_workers=num_workers,
    )
    first_status = first_solver.solve(model)
    if first_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(
            "CP-SAT did not find a schedule. "
            f"Solver status: {first_solver.status_name(first_status)}"
        )

    best_shortage = sum(first_solver.value(var) for var in shortage_vars.values())
    best_possible = sum(first_solver.value(var) for var in possible_vars)

    # Preserve the primary business priorities while improving schedule shape.
    model.add(total_shortage == best_shortage)
    model.add(total_possible == best_possible)

    total_overstaff = sum(overstaff_vars.values())
    total_target_deviation = sum(target_deviation_vars)
    total_shift_starts = sum(start_vars)
    max_target_deviation = sum(
        max(employee.weekly_target_slots, len(data.dates) * employee.max_daily_slots)
        for employee in data.employees
    )
    max_shift_starts = len(data.employees) * len(data.dates)

    # Overstaffing dominates target deviation, which dominates cosmetic extra
    # starts. This prevents the model from inventing work merely to hit targets.
    target_weight = max_shift_starts + 1
    overstaff_weight = target_weight * (max_target_deviation + 1)
    model.minimize(
        total_overstaff * overstaff_weight
        + total_target_deviation * target_weight
        + total_shift_starts
    )

    second_solver = _new_solver(
        max_time_seconds=max(max_time_seconds * 0.3, 0.1),
        num_workers=num_workers,
    )
    second_status = second_solver.solve(model)
    if second_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        final_solver = second_solver
        fully_optimized = (
            first_status == cp_model.OPTIMAL
            and second_status == cp_model.OPTIMAL
        )
    else:
        # The first phase already has a complete feasible schedule. Returning it
        # is safer than failing because the optional quality phase timed out.
        final_solver = first_solver
        fully_optimized = False

    assignments = _extract_assignments(data, assignment_vars, final_solver)
    uncovered = _extract_uncovered(
        data,
        shortage_vars,
        candidate_counts,
        final_solver,
    )
    solver_status = "optimal" if fully_optimized else "feasible"

    try:
        schedule_id = _save_result(
            db,
            company_id=company_id,
            branch_id=branch_id,
            start_date=start_date,
            end_date=end_date,
            solver_status=solver_status,
            assignments=assignments,
            uncovered=uncovered,
        )
        if commit:
            db.commit()
    except Exception:
        db.rollback()
        raise

    return ScheduleResult(
        schedule_id=schedule_id,
        solver_status=solver_status,
        assignments=tuple(assignments),
        uncovered_slots=tuple(uncovered),
        total_required_slots=sum(data.demand.values()),
        total_uncovered_slots=sum(item.uncovered_count for item in uncovered),
    )


def _load_data(
    db: Session,
    *,
    company_id: int,
    branch_id: int,
    start_date: date,
    end_date: date,
) -> LoadedData:
    branch_exists = db.execute(
        text(
            """
            SELECT 1
            FROM branches
            WHERE id = :branch_id AND company_id = :company_id
            """
        ),
        {"branch_id": branch_id, "company_id": company_id},
    ).scalar_one_or_none()
    if branch_exists is None:
        raise ScheduleDataError("branch does not belong to the requested company")

    employee_rows = db.execute(
        text(
            """
            SELECT
                id,
                profession_id,
                weekly_target_minutes,
                min_daily_minutes,
                max_daily_minutes
            FROM employees
            WHERE company_id = :company_id
              AND branch_id = :branch_id
              AND is_active = TRUE
            ORDER BY id
            """
        ),
        {"company_id": company_id, "branch_id": branch_id},
    ).mappings()
    employees = [
        EmployeeData(
            id=row["id"],
            profession_id=row["profession_id"],
            weekly_target_slots=row["weekly_target_minutes"] // SLOT_MINUTES,
            min_daily_slots=row["min_daily_minutes"] // SLOT_MINUTES,
            max_daily_slots=row["max_daily_minutes"] // SLOT_MINUTES,
        )
        for row in employee_rows
    ]

    hours_by_weekday = {
        row["day_of_week"]: (row["start_time"], row["finish_time"])
        for row in db.execute(
            text(
                """
                SELECT day_of_week, start_time, finish_time
                FROM business_hours
                WHERE company_id = :company_id AND branch_id = :branch_id
                ORDER BY day_of_week
                """
            ),
            {"company_id": company_id, "branch_id": branch_id},
        ).mappings()
    }

    dates = list(_date_range(start_date, end_date))
    business_slots = {
        work_date: _time_slots(*hours_by_weekday[work_date.weekday()])
        if work_date.weekday() in hours_by_weekday
        else []
        for work_date in dates
    }

    recurring_demand = {
        (row["day_of_week"], row["slot_time"], row["profession_id"]): row["required_count"]
        for row in db.execute(
            text(
                """
                SELECT day_of_week, slot_time, profession_id, required_count
                FROM staffing_requirements
                WHERE company_id = :company_id AND branch_id = :branch_id
                  AND required_count > 0
                """
            ),
            {"company_id": company_id, "branch_id": branch_id},
        ).mappings()
    }
    demand = {
        DemandKey(work_date, slot_time, profession_id): required_count
        for work_date in dates
        for (weekday, slot_time, profession_id), required_count in recurring_demand.items()
        if weekday == work_date.weekday()
    }

    availability: dict[tuple[int, int, time], str] = {}
    availability_params = {"company_id": company_id, "branch_id": branch_id}
    for table_name, source in (
        ("employee_possible_availability", "possible"),
        ("employee_confirmed_availability", "confirmed"),
    ):
        rows = db.execute(
            text(
                f"""
                SELECT availability.employee_id, availability.day_of_week, availability.slot_time
                FROM {table_name} AS availability
                JOIN employees ON employees.id = availability.employee_id
                WHERE employees.company_id = :company_id
                  AND employees.branch_id = :branch_id
                  AND employees.is_active = TRUE
                """
            ),
            availability_params,
        ).mappings()
        for row in rows:
            # Confirmed wins defensively if legacy data predates the overlap trigger.
            availability[(row["employee_id"], row["day_of_week"], row["slot_time"])] = source

    absence_rows = db.execute(
        text(
            """
            SELECT absences.employee_id, absences.start_date, absences.end_date
            FROM absences
            JOIN employees ON employees.id = absences.employee_id
            WHERE employees.company_id = :company_id
              AND employees.branch_id = :branch_id
              AND employees.is_active = TRUE
              AND absences.start_date <= :end_date
              AND absences.end_date >= :start_date
            """
        ),
        {
            "company_id": company_id,
            "branch_id": branch_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    ).mappings()
    absent_dates = {
        (row["employee_id"], absent_date)
        for row in absence_rows
        for absent_date in _date_range(
            max(row["start_date"], start_date),
            min(row["end_date"], end_date),
        )
    }

    return LoadedData(
        employees=employees,
        dates=dates,
        business_slots=business_slots,
        demand=demand,
        availability=availability,
        absent_dates=absent_dates,
    )


def _validate_loaded_data(data: LoadedData) -> None:
    if not 3 <= len(data.employees) <= 100:
        raise ScheduleDataError(
            "the selected branch must have between 3 and 100 active employees"
        )

    for employee in data.employees:
        if employee.min_daily_slots > employee.max_daily_slots:
            raise ScheduleDataError(
                f"employee {employee.id} has minimum daily hours above maximum"
            )

    for key in data.demand:
        if key.slot_time not in data.business_slots[key.work_date]:
            raise ScheduleDataError(
                "staffing requirement is outside business hours: "
                f"{key.work_date} {key.slot_time} profession {key.profession_id}"
            )


def _build_model(data: LoadedData):
    model = cp_model.CpModel()
    assignment_vars: dict[tuple[int, date, time], cp_model.IntVar] = {}
    shortage_vars: dict[DemandKey, cp_model.IntVar] = {}
    overstaff_vars: dict[DemandKey, cp_model.IntVar] = {}
    start_vars: list[cp_model.IntVar] = []
    target_deviation_vars: list[cp_model.IntVar] = []
    candidate_counts: dict[DemandKey, int] = {}

    demanded_professions = {key.profession_id for key in data.demand}

    # Assignment variables only exist for legal availability slots. A missing
    # variable is therefore a hard prohibition, directly enforcing rules 1-2.
    for employee in data.employees:
        if employee.profession_id not in demanded_professions:
            continue
        for work_date in data.dates:
            if (employee.id, work_date) in data.absent_dates:
                continue
            for slot_time in data.business_slots[work_date]:
                availability_key = (employee.id, work_date.weekday(), slot_time)
                if availability_key not in data.availability:
                    continue
                key = (employee.id, work_date, slot_time)
                assignment_vars[key] = model.new_bool_var(
                    f"work_e{employee.id}_{work_date.isoformat()}_{slot_time:%H%M}"
                )

    # Demand is soft. shortage can absorb any uncovered count, so availability
    # shortages never make the entire model infeasible. overstaff permits a
    # continuous shift to cross a zero/low-demand slot when operationally needed.
    for demand_key, required_count in data.demand.items():
        matching = [
            assignment_vars[(employee.id, demand_key.work_date, demand_key.slot_time)]
            for employee in data.employees
            if employee.profession_id == demand_key.profession_id
            and (employee.id, demand_key.work_date, demand_key.slot_time) in assignment_vars
        ]
        candidate_counts[demand_key] = len(matching)
        shortage = model.new_int_var(
            0,
            required_count,
            f"short_{demand_key.work_date}_{demand_key.slot_time:%H%M}_p{demand_key.profession_id}",
        )
        overstaff = model.new_int_var(
            0,
            len(matching),
            f"over_{demand_key.work_date}_{demand_key.slot_time:%H%M}_p{demand_key.profession_id}",
        )
        model.add(sum(matching) + shortage == required_count + overstaff)
        shortage_vars[demand_key] = shortage
        overstaff_vars[demand_key] = overstaff

    # Availability slots with no requirement still receive an overstaff penalty.
    # They are useful only when needed to connect a continuous shift or satisfy a
    # daily minimum, and cannot be added for free merely to hit weekly targets.
    demanded_keys = set(data.demand)
    for employee in data.employees:
        for work_date in data.dates:
            for slot_time in data.business_slots[work_date]:
                variable = assignment_vars.get((employee.id, work_date, slot_time))
                if variable is None:
                    continue
                demand_key = DemandKey(work_date, slot_time, employee.profession_id)
                if demand_key not in demanded_keys:
                    overstaff_vars[demand_key] = variable

    # Per employee/day:
    # - work_day links daily minimum/maximum hours to whether any slot is worked;
    # - a start is a 0->1 transition in the chronological slot sequence;
    # - at most one start enforces one continuous, non-split shift per day.
    for employee in data.employees:
        for work_date in data.dates:
            slots = data.business_slots[work_date]
            daily_vars = [
                assignment_vars.get((employee.id, work_date, slot_time))
                for slot_time in slots
            ]
            present_daily_vars = [var for var in daily_vars if var is not None]
            if not present_daily_vars:
                continue

            works_day = model.new_bool_var(
                f"works_day_e{employee.id}_{work_date.isoformat()}"
            )
            daily_total = sum(present_daily_vars)
            model.add(daily_total >= employee.min_daily_slots * works_day)
            model.add(daily_total <= employee.max_daily_slots * works_day)
            model.add(daily_total >= works_day)

            day_starts: list[cp_model.IntVar] = []
            previous = None
            for index, variable in enumerate(daily_vars):
                if variable is None:
                    previous = None
                    continue
                start = model.new_bool_var(
                    f"start_e{employee.id}_{work_date.isoformat()}_{index}"
                )
                if previous is None:
                    model.add(start == variable)
                else:
                    model.add(start >= variable - previous)
                    model.add(start <= variable)
                    model.add(start <= 1 - previous)
                day_starts.append(start)
                previous = variable

            model.add(sum(day_starts) <= 1)
            start_vars.extend(day_starts)

    # Weekly target hours are soft because hard equality could make a partially
    # coverable week infeasible. Absolute under/over deviations are minimized.
    # For a partial calendar week, the target is prorated by included days.
    dates_by_week: dict[date, list[date]] = defaultdict(list)
    for work_date in data.dates:
        monday = work_date - timedelta(days=work_date.weekday())
        dates_by_week[monday].append(work_date)

    for employee in data.employees:
        for monday, week_dates in dates_by_week.items():
            week_vars = [
                variable
                for work_date in week_dates
                for slot_time in data.business_slots[work_date]
                if (
                    variable := assignment_vars.get(
                        (employee.id, work_date, slot_time)
                    )
                )
                is not None
            ]
            prorated_target = (
                employee.weekly_target_slots * len(week_dates) + 3
            ) // 7
            max_week_slots = sum(
                min(employee.max_daily_slots, len(data.business_slots[work_date]))
                for work_date in week_dates
            )
            under = model.new_int_var(
                0,
                prorated_target,
                f"target_under_e{employee.id}_{monday.isoformat()}",
            )
            over = model.new_int_var(
                0,
                max(max_week_slots - prorated_target, 0),
                f"target_over_e{employee.id}_{monday.isoformat()}",
            )
            model.add(sum(week_vars) + under - over == prorated_target)
            target_deviation_vars.extend((under, over))

    return (
        model,
        assignment_vars,
        shortage_vars,
        overstaff_vars,
        start_vars,
        target_deviation_vars,
        candidate_counts,
    )


def _extract_assignments(
    data: LoadedData,
    assignment_vars: dict[tuple[int, date, time], cp_model.IntVar],
    solver: cp_model.CpSolver,
) -> list[GeneratedAssignment]:
    assignments: list[GeneratedAssignment] = []
    for employee in data.employees:
        for work_date in data.dates:
            worked_slots = [
                slot_time
                for slot_time in data.business_slots[work_date]
                if (
                    variable := assignment_vars.get(
                        (employee.id, work_date, slot_time)
                    )
                )
                is not None
                and solver.value(variable)
            ]
            if not worked_slots:
                continue

            # Continuity is enforced by the model; this assertion catches future
            # model regressions before corrupt rows reach the database.
            expected = _time_slots(
                worked_slots[0],
                _add_minutes(worked_slots[-1], SLOT_MINUTES),
            )
            if worked_slots != expected:
                raise RuntimeError(
                    f"non-continuous solution for employee {employee.id} on {work_date}"
                )

            slot_sources = tuple(
                (
                    slot_time,
                    data.availability[
                        (employee.id, work_date.weekday(), slot_time)
                    ],
                )
                for slot_time in worked_slots
            )
            assignments.append(
                GeneratedAssignment(
                    employee_id=employee.id,
                    profession_id=employee.profession_id,
                    work_date=work_date,
                    start_time=worked_slots[0],
                    end_time=_add_minutes(worked_slots[-1], SLOT_MINUTES),
                    slots=slot_sources,
                )
            )
    return assignments


def _extract_uncovered(
    data: LoadedData,
    shortage_vars: dict[DemandKey, cp_model.IntVar],
    candidate_counts: dict[DemandKey, int],
    solver: cp_model.CpSolver,
) -> list[UncoveredSlot]:
    uncovered: list[UncoveredSlot] = []
    for key, variable in shortage_vars.items():
        missing = solver.value(variable)
        if missing == 0:
            continue
        candidates = candidate_counts[key]
        if candidates == 0:
            reason = "no_available_employee"
        elif candidates < data.demand[key]:
            reason = "insufficient_available_employees"
        else:
            reason = "scheduling_constraints"
        uncovered.append(
            UncoveredSlot(
                key=key,
                required_count=data.demand[key],
                uncovered_count=missing,
                reason=reason,
            )
        )
    return uncovered


def _save_result(
    db: Session,
    *,
    company_id: int,
    branch_id: int,
    start_date: date,
    end_date: date,
    solver_status: str,
    assignments: list[GeneratedAssignment],
    uncovered: list[UncoveredSlot],
) -> int:
    schedule_id = db.execute(
        text(
            """
            INSERT INTO schedules (
                company_id, branch_id, start_date, end_date, status, solver_status
            )
            VALUES (
                :company_id, :branch_id, :start_date, :end_date, 'draft', :solver_status
            )
            RETURNING id
            """
        ),
        {
            "company_id": company_id,
            "branch_id": branch_id,
            "start_date": start_date,
            "end_date": end_date,
            "solver_status": solver_status,
        },
    ).scalar_one()

    for assignment in assignments:
        assignment_id = db.execute(
            text(
                """
                INSERT INTO schedule_assignments (
                    schedule_id,
                    employee_id,
                    profession_id,
                    work_date,
                    start_time,
                    end_time
                )
                VALUES (
                    :schedule_id,
                    :employee_id,
                    :profession_id,
                    :work_date,
                    :start_time,
                    :end_time
                )
                RETURNING id
                """
            ),
            {
                "schedule_id": schedule_id,
                "employee_id": assignment.employee_id,
                "profession_id": assignment.profession_id,
                "work_date": assignment.work_date,
                "start_time": assignment.start_time,
                "end_time": assignment.end_time,
            },
        ).scalar_one()
        db.execute(
            text(
                """
                INSERT INTO schedule_assignment_slots (
                    schedule_assignment_id, slot_time, availability_source
                )
                VALUES (
                    :schedule_assignment_id, :slot_time, :availability_source
                )
                """
            ),
            [
                {
                    "schedule_assignment_id": assignment_id,
                    "slot_time": slot_time,
                    "availability_source": source,
                }
                for slot_time, source in assignment.slots
            ],
        )

    if uncovered:
        db.execute(
            text(
                """
                INSERT INTO uncovered_slots (
                    schedule_id,
                    work_date,
                    day_of_week,
                    slot_time,
                    profession_id,
                    required_count,
                    uncovered_count,
                    reason
                )
                VALUES (
                    :schedule_id,
                    :work_date,
                    :day_of_week,
                    :slot_time,
                    :profession_id,
                    :required_count,
                    :uncovered_count,
                    :reason
                )
                """
            ),
            [
                {
                    "schedule_id": schedule_id,
                    "work_date": item.key.work_date,
                    "day_of_week": item.key.work_date.weekday(),
                    "slot_time": item.key.slot_time,
                    "profession_id": item.key.profession_id,
                    "required_count": item.required_count,
                    "uncovered_count": item.uncovered_count,
                    "reason": item.reason,
                }
                for item in uncovered
            ],
        )

    return schedule_id


def _new_solver(*, max_time_seconds: float, num_workers: int) -> cp_model.CpSolver:
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_time_seconds
    solver.parameters.num_search_workers = num_workers
    return solver


def _date_range(start_date: date, end_date: date) -> Iterable[date]:
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def _time_slots(start_time: time, finish_time: time) -> list[time]:
    slots: list[time] = []
    current = datetime.combine(date.min, start_time)
    finish = datetime.combine(date.min, finish_time)
    while current < finish:
        slots.append(current.time())
        current += timedelta(minutes=SLOT_MINUTES)
    return slots


def _add_minutes(value: time, minutes: int) -> time:
    return (datetime.combine(date.min, value) + timedelta(minutes=minutes)).time()
