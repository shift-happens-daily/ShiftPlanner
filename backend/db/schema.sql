CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION generate_alphanumeric_code(code_length INTEGER)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..code_length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    public_id VARCHAR(16) UNIQUE NOT NULL DEFAULT generate_alphanumeric_code(16),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('manager', 'employee')),
    is_registration_complete BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    email_verification_token VARCHAR(128) UNIQUE,
    email_verification_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (public_id ~ '^[A-Za-z0-9]{16}$')   
);

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    invite_code VARCHAR(16) UNIQUE NOT NULL DEFAULT generate_alphanumeric_code(16),
    invite_code_generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invite_code_expires_at TIMESTAMP,
    manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (invite_code ~ '^[A-Za-z0-9]{16}$')
);

CREATE TABLE branches (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    working_hours_by_weekday JSONB NOT NULL DEFAULT '{"0":{"start_slot":0,"end_slot":48},"1":{"start_slot":0,"end_slot":48},"2":{"start_slot":0,"end_slot":48},"3":{"start_slot":0,"end_slot":48},"4":{"start_slot":0,"end_slot":48},"5":{"start_slot":0,"end_slot":48},"6":{"start_slot":0,"end_slot":48}}'::jsonb
);

CREATE TABLE company_managers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_role VARCHAR(50) NOT NULL DEFAULT 'manager'
        CHECK (manager_role IN ('owner', 'manager')),
    membership_status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('pending', 'active', 'declined')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, user_id)
);

CREATE INDEX idx_company_managers_user_status
    ON company_managers (user_id, membership_status);

CREATE INDEX idx_company_managers_company_status
    ON company_managers (company_id, membership_status);

CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

CREATE OR REPLACE FUNCTION set_default_branch_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.branch_id IS NULL THEN
        SELECT id
        INTO NEW.branch_id
        FROM branches
        WHERE company_id = NEW.company_id
        ORDER BY id
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(16) UNIQUE NOT NULL DEFAULT generate_alphanumeric_code(16),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    max_hours_per_week INTEGER DEFAULT 40 CHECK (max_hours_per_week > 0),
    max_hours_per_day INTEGER DEFAULT 8 CHECK (max_hours_per_day > 0 AND max_hours_per_day <= 24),
    min_hours_per_shift INTEGER DEFAULT 5 CHECK (min_hours_per_shift > 0),
    max_hours_per_shift INTEGER DEFAULT 12 CHECK (max_hours_per_shift > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, company_id),
    CHECK (employee_code ~ '^[A-Za-z0-9]{16}$'),
    CHECK (max_hours_per_shift >= min_hours_per_shift)
);

CREATE TABLE employee_branches (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, branch_id)
);

CREATE UNIQUE INDEX employee_branches_one_primary_per_employee
    ON employee_branches (employee_id)
    WHERE is_primary;

CREATE TABLE employee_positions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, position_id)
);

CREATE UNIQUE INDEX employee_positions_one_primary_per_employee
    ON employee_positions (employee_id)
    WHERE is_primary;

CREATE TABLE employee_availability (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    availability_date DATE,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    availability_status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (availability_status IN ('available', 'if_needed', 'unavailable')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time),
    CHECK (EXTRACT(MINUTE FROM start_time)::INTEGER % 5 = 0),
    CHECK (EXTRACT(MINUTE FROM end_time)::INTEGER % 5 = 0)
);

CREATE UNIQUE INDEX employee_availability_weekly_template_unique
    ON employee_availability (employee_id, weekday, start_time, end_time)
    WHERE availability_date IS NULL;

CREATE UNIQUE INDEX employee_availability_daily_unique
    ON employee_availability (employee_id, availability_date, start_time, end_time)
    WHERE availability_date IS NOT NULL;

CREATE INDEX idx_employee_availability_exact_date
    ON employee_availability (employee_id, availability_date, start_time, end_time);

CREATE TABLE employee_desired_days_off (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    UNIQUE (employee_id, weekday)
);

CREATE TABLE absences (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    absence_type VARCHAR(50) NOT NULL CHECK (absence_type IN ('vacation', 'sick_leave', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    comment TEXT,
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_absences_employee_dates
    ON absences (employee_id, start_date, end_date);

CREATE TABLE shift_requirements (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_employees INTEGER NOT NULL DEFAULT 1 CHECK (required_employees > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time),
    CHECK (EXTRACT(MINUTE FROM start_time)::INTEGER % 5 = 0),
    CHECK (EXTRACT(MINUTE FROM end_time)::INTEGER % 5 = 0)
);

CREATE TRIGGER trg_shift_requirements_default_branch
BEFORE INSERT OR UPDATE ON shift_requirements
FOR EACH ROW
EXECUTE FUNCTION set_default_branch_id();

CREATE INDEX idx_shift_requirements_branch_date
    ON shift_requirements (company_id, branch_id, shift_date, position_id);

CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_schedules_default_branch
BEFORE INSERT OR UPDATE ON schedules
FOR EACH ROW
EXECUTE FUNCTION set_default_branch_id();

CREATE UNIQUE INDEX uq_schedules_company_branch_draft_period
    ON schedules (company_id, branch_id, start_date, end_date)
    WHERE status = 'draft';

CREATE INDEX idx_schedules_retention_end_date
    ON schedules (end_date);

CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time),
    CHECK (EXTRACT(MINUTE FROM start_time)::INTEGER % 5 = 0),
    CHECK (EXTRACT(MINUTE FROM end_time)::INTEGER % 5 = 0)
);

CREATE TABLE shift_assignments (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'assigned'
        CHECK (status IN ('assigned', 'completed', 'cancelled')),
    UNIQUE (shift_id, employee_id)
);

CREATE TABLE shift_exchange_requests (
    id SERIAL PRIMARY KEY,
    shift_assignment_id INTEGER NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
    requested_by_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

