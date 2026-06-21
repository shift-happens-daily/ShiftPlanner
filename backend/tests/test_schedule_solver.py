from datetime import date, time

from ortools.sat.python import cp_model

from app.services.schedule_solver import (
    DemandKey,
    EmployeeData,
    LoadedData,
    _build_model,
    _extract_assignments,
)


WORK_DATE = date(2026, 6, 22)
NEXT_SAME_WEEKDAY = date(2026, 6, 29)
SLOT_TIME = time(9, 0)


def _employee(employee_id: int, position_id: int = 1) -> EmployeeData:
    return EmployeeData(
        id=employee_id,
        position_id=position_id,
        weekly_target_slots=0,
        min_daily_slots=0,
        max_daily_slots=1,
    )


def _data(
    *,
    employees: list[EmployeeData],
    dates: list[date] | None = None,
    demand: dict[DemandKey, int] | None = None,
    availability: dict[tuple[int, date, time], str] | None = None,
) -> LoadedData:
    work_dates = dates or [WORK_DATE]
    return LoadedData(
        employees=employees,
        dates=work_dates,
        business_slots={work_date: [SLOT_TIME] for work_date in work_dates},
        demand=demand or {DemandKey(WORK_DATE, SLOT_TIME, 1): 1},
        availability=availability or {},
        absent_dates=set(),
    )


def _solve_primary(data: LoadedData):
    (
        model,
        assignment_vars,
        shortage_vars,
        _,
        _,
        _,
        _,
    ) = _build_model(data)
    if_needed_vars = [
        variable
        for (employee_id, work_date, slot_time), variable in assignment_vars.items()
        if data.availability[(employee_id, work_date, slot_time)] == "if_needed"
    ]
    model.minimize(
        sum(shortage_vars.values()) * (len(if_needed_vars) + 1)
        + sum(if_needed_vars)
    )
    solver = cp_model.CpSolver()
    status = solver.solve(model)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    return assignment_vars, shortage_vars, solver


def test_available_employee_can_be_assigned_and_source_is_preserved() -> None:
    data = _data(
        employees=[_employee(1)],
        availability={(1, WORK_DATE, SLOT_TIME): "available"},
    )

    assignment_vars, shortage_vars, solver = _solve_primary(data)

    assert solver.value(assignment_vars[(1, WORK_DATE, SLOT_TIME)]) == 1
    assert solver.value(shortage_vars[DemandKey(WORK_DATE, SLOT_TIME, 1)]) == 0
    assignments = _extract_assignments(data, assignment_vars, solver)
    assert assignments[0].position_id == 1
    assert assignments[0].slots == ((SLOT_TIME, "available"),)


def test_if_needed_employee_is_used_only_when_necessary() -> None:
    data = _data(
        employees=[_employee(1), _employee(2)],
        availability={
            (1, WORK_DATE, SLOT_TIME): "available",
            (2, WORK_DATE, SLOT_TIME): "if_needed",
        },
    )

    assignment_vars, _, solver = _solve_primary(data)

    assert solver.value(assignment_vars[(1, WORK_DATE, SLOT_TIME)]) == 1
    assert solver.value(assignment_vars[(2, WORK_DATE, SLOT_TIME)]) == 0

    required_data = _data(
        employees=[_employee(1), _employee(2)],
        demand={DemandKey(WORK_DATE, SLOT_TIME, 1): 2},
        availability=data.availability,
    )
    required_vars, shortage_vars, required_solver = _solve_primary(required_data)

    assert required_solver.value(required_vars[(1, WORK_DATE, SLOT_TIME)]) == 1
    assert required_solver.value(required_vars[(2, WORK_DATE, SLOT_TIME)]) == 1
    assert (
        required_solver.value(
            shortage_vars[DemandKey(WORK_DATE, SLOT_TIME, 1)]
        )
        == 0
    )


def test_unavailable_employee_is_never_assignable() -> None:
    data = _data(
        employees=[_employee(1)],
        availability={(1, WORK_DATE, SLOT_TIME): "unavailable"},
    )

    assignment_vars, shortage_vars, solver = _solve_primary(data)

    assert (1, WORK_DATE, SLOT_TIME) not in assignment_vars
    assert solver.value(shortage_vars[DemandKey(WORK_DATE, SLOT_TIME, 1)]) == 1


def test_assignment_candidates_must_match_position_id() -> None:
    data = _data(
        employees=[_employee(1, position_id=2)],
        availability={(1, WORK_DATE, SLOT_TIME): "available"},
    )

    assignment_vars, shortage_vars, solver = _solve_primary(data)

    assert assignment_vars == {}
    assert solver.value(shortage_vars[DemandKey(WORK_DATE, SLOT_TIME, 1)]) == 1


def test_availability_matches_exact_date_instead_of_weekday() -> None:
    data = _data(
        employees=[_employee(1)],
        dates=[WORK_DATE, NEXT_SAME_WEEKDAY],
        demand={
            DemandKey(WORK_DATE, SLOT_TIME, 1): 1,
            DemandKey(NEXT_SAME_WEEKDAY, SLOT_TIME, 1): 1,
        },
        availability={(1, WORK_DATE, SLOT_TIME): "available"},
    )

    assignment_vars, shortage_vars, solver = _solve_primary(data)

    assert (1, WORK_DATE, SLOT_TIME) in assignment_vars
    assert (1, NEXT_SAME_WEEKDAY, SLOT_TIME) not in assignment_vars
    assert (
        solver.value(
            shortage_vars[DemandKey(NEXT_SAME_WEEKDAY, SLOT_TIME, 1)]
        )
        == 1
    )
