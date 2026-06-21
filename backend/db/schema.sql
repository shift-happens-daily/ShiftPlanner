-- ShiftPlanner PostgreSQL schema.
--
-- Weekdays use Python's convention everywhere: Monday = 0, Sunday = 6.
-- Every scheduling time is the start of a 30-minute slot.

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('manager', 'employee')),
    is_registration_complete BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Authentication should treat differently-cased versions of an email as equal.
CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    invite_code VARCHAR(50) UNIQUE,
    manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_manager_user_id ON companies(manager_user_id);

CREATE TABLE branches (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    UNIQUE (company_id, name),
    -- Supports tenant-safe composite foreign keys below.
    UNIQUE (company_id, id)
);

CREATE INDEX idx_branches_company_id ON branches(company_id);

-- A position is a company-owned job classification referenced by employees
-- and staffing requirements.
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    UNIQUE (company_id, name),
    -- Supports tenant-safe composite foreign keys below.
    UNIQUE (company_id, id)
);

CREATE INDEX idx_positions_company_id ON positions(company_id);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL,
    position_id INTEGER NOT NULL,

    -- Minutes avoid fractional-hour rounding and must map to whole 30-minute slots.
    weekly_target_minutes INTEGER NOT NULL DEFAULT 2400
        CHECK (weekly_target_minutes >= 0 AND weekly_target_minutes % 30 = 0),
    min_daily_minutes INTEGER NOT NULL DEFAULT 0
        CHECK (min_daily_minutes >= 0 AND min_daily_minutes % 30 = 0),
    max_daily_minutes INTEGER NOT NULL DEFAULT 480
        CHECK (max_daily_minutes > 0 AND max_daily_minutes % 30 = 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_employees_daily_hours
        CHECK (min_daily_minutes <= max_daily_minutes),
    CONSTRAINT fk_employees_branch
        FOREIGN KEY (company_id, branch_id)
        REFERENCES branches(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_employees_position
        FOREIGN KEY (company_id, position_id)
        REFERENCES positions(company_id, id) ON DELETE RESTRICT,
    -- Allows assignments to guarantee that the recorded position belongs to
    -- the assigned employee.
    UNIQUE (id, position_id)
);

CREATE INDEX idx_employees_company_branch_active
    ON employees(company_id, branch_id, is_active);
CREATE INDEX idx_employees_position_active
    ON employees(position_id, is_active);

-- A branch may have different opening hours on every weekday. A missing weekday
-- means the branch is closed. Overnight opening periods are intentionally not
-- represented; split them at midnight into two weekday rows if needed.
CREATE TABLE business_hours (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    finish_time TIME NOT NULL,

    CONSTRAINT fk_business_hours_branch
        FOREIGN KEY (company_id, branch_id)
        REFERENCES branches(company_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_business_hours_order CHECK (finish_time > start_time),
    CONSTRAINT ck_business_hours_start_slot CHECK (
        EXTRACT(MINUTE FROM start_time) IN (0, 30)
        AND EXTRACT(SECOND FROM start_time) = 0
    ),
    CONSTRAINT ck_business_hours_finish_slot CHECK (
        EXTRACT(MINUTE FROM finish_time) IN (0, 30)
        AND EXTRACT(SECOND FROM finish_time) = 0
    ),
    UNIQUE (branch_id, day_of_week)
);

CREATE INDEX idx_business_hours_company_branch
    ON business_hours(company_id, branch_id);

-- Recurring demand template: one row per weekday, 30-minute slot, position,
-- and branch. The solver expands these rows into concrete dates.
CREATE TABLE staffing_requirements (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    slot_time TIME NOT NULL,
    position_id INTEGER NOT NULL,
    required_count INTEGER NOT NULL CHECK (required_count >= 0),

    CONSTRAINT fk_staffing_requirements_branch
        FOREIGN KEY (company_id, branch_id)
        REFERENCES branches(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_staffing_requirements_position
        FOREIGN KEY (company_id, position_id)
        REFERENCES positions(company_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_staffing_requirements_slot CHECK (
        EXTRACT(MINUTE FROM slot_time) IN (0, 30)
        AND EXTRACT(SECOND FROM slot_time) = 0
    ),
    UNIQUE (branch_id, day_of_week, slot_time, position_id)
);

CREATE INDEX idx_staffing_requirements_lookup
    ON staffing_requirements(company_id, branch_id, day_of_week, slot_time);
CREATE INDEX idx_staffing_requirements_position
    ON staffing_requirements(position_id);

-- Availability is concrete-date and slot based. The status controls whether a
-- slot is preferred, usable only as a fallback, or prohibited.
CREATE TABLE employee_availability (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    availability_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    availability_status VARCHAR(20) NOT NULL CHECK (
        availability_status IN ('available', 'if_needed', 'unavailable')
    ),
    CONSTRAINT ck_employee_availability_slot CHECK (
        EXTRACT(MINUTE FROM slot_time) IN (0, 30)
        AND EXTRACT(SECOND FROM slot_time) = 0
    ),
    UNIQUE (employee_id, availability_date, slot_time)
);

CREATE INDEX idx_employee_availability_lookup
    ON employee_availability(availability_date, slot_time, employee_id);

CREATE TABLE absences (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    absence_type VARCHAR(50) NOT NULL
        CHECK (absence_type IN ('vacation', 'sick_leave', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    comment TEXT,
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_absences_employee_dates
    ON absences(employee_id, start_date, end_date);

CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    solver_status VARCHAR(50) NOT NULL
        CHECK (solver_status IN ('optimal', 'feasible', 'unknown')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CONSTRAINT fk_schedules_branch
        FOREIGN KEY (company_id, branch_id)
        REFERENCES branches(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_schedules_branch_dates
    ON schedules(company_id, branch_id, start_date, end_date);
CREATE INDEX idx_schedules_status
    ON schedules(company_id, branch_id, status);

-- One row is one continuous employee shift. The unique key enforces at most one
-- shift per employee per day within a generated schedule.
CREATE TABLE schedule_assignments (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL,
    position_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_schedule_assignment_employee_position
        FOREIGN KEY (employee_id, position_id)
        REFERENCES employees(id, position_id) ON DELETE RESTRICT,
    CONSTRAINT ck_schedule_assignment_time_order CHECK (end_time > start_time),
    CONSTRAINT ck_schedule_assignment_start_slot CHECK (
        EXTRACT(MINUTE FROM start_time) IN (0, 30)
        AND EXTRACT(SECOND FROM start_time) = 0
    ),
    CONSTRAINT ck_schedule_assignment_end_slot CHECK (
        EXTRACT(MINUTE FROM end_time) IN (0, 30)
        AND EXTRACT(SECOND FROM end_time) = 0
    ),
    UNIQUE (schedule_id, employee_id, work_date)
);

CREATE INDEX idx_schedule_assignments_schedule_date
    ON schedule_assignments(schedule_id, work_date, start_time);
CREATE INDEX idx_schedule_assignments_employee_date
    ON schedule_assignments(employee_id, work_date);
CREATE INDEX idx_schedule_assignments_position_date
    ON schedule_assignments(position_id, work_date);

-- Slot-level children make coverage and availability-source auditing possible
-- without duplicating employee/shift data in every solver query.
CREATE TABLE schedule_assignment_slots (
    id SERIAL PRIMARY KEY,
    schedule_assignment_id INTEGER NOT NULL
        REFERENCES schedule_assignments(id) ON DELETE CASCADE,
    slot_time TIME NOT NULL,
    availability_source VARCHAR(20) NOT NULL
        CHECK (availability_source IN ('available', 'if_needed')),
    CONSTRAINT ck_schedule_assignment_slots_time CHECK (
        EXTRACT(MINUTE FROM slot_time) IN (0, 30)
        AND EXTRACT(SECOND FROM slot_time) = 0
    ),
    UNIQUE (schedule_assignment_id, slot_time)
);

CREATE INDEX idx_schedule_assignment_slots_assignment
    ON schedule_assignment_slots(schedule_assignment_id, slot_time);

-- Stores every unmet demand row. The reason distinguishes truly impossible
-- slots (no employee offered either availability type) from shortages caused by
-- employee count, continuity, or daily-hour constraints.
CREATE TABLE uncovered_slots (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    slot_time TIME NOT NULL,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    required_count INTEGER NOT NULL CHECK (required_count > 0),
    uncovered_count INTEGER NOT NULL CHECK (
        uncovered_count > 0 AND uncovered_count <= required_count
    ),
    reason VARCHAR(100) NOT NULL CHECK (
        reason IN (
            'no_available_employee',
            'insufficient_available_employees',
            'scheduling_constraints'
        )
    ),
    CONSTRAINT ck_uncovered_slots_time CHECK (
        EXTRACT(MINUTE FROM slot_time) IN (0, 30)
        AND EXTRACT(SECOND FROM slot_time) = 0
    ),
    UNIQUE (schedule_id, work_date, slot_time, position_id)
);

CREATE INDEX idx_uncovered_slots_schedule_date
    ON uncovered_slots(schedule_id, work_date, slot_time);
CREATE INDEX idx_uncovered_slots_position
    ON uncovered_slots(position_id);

CREATE TABLE shift_exchange_requests (
    id SERIAL PRIMARY KEY,
    schedule_assignment_id INTEGER NOT NULL
        REFERENCES schedule_assignments(id) ON DELETE CASCADE,
    requested_by_employee_id INTEGER NOT NULL
        REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shift_exchange_requests_assignment
    ON shift_exchange_requests(schedule_assignment_id);
CREATE INDEX idx_shift_exchange_requests_status
    ON shift_exchange_requests(status, created_at);
