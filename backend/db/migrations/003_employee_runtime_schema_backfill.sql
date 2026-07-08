ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS invite_code_generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS invite_code_expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

UPDATE companies
SET invite_code_generated_at = CURRENT_TIMESTAMP
WHERE invite_code_generated_at IS NULL;

CREATE TABLE IF NOT EXISTS company_managers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_role VARCHAR(50) NOT NULL DEFAULT 'manager',
    membership_status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_managers_user_status
    ON company_managers (user_id, membership_status);

CREATE INDEX IF NOT EXISTS idx_company_managers_company_status
    ON company_managers (company_id, membership_status);

INSERT INTO company_managers (
    company_id,
    user_id,
    manager_role,
    membership_status
)
SELECT companies.id, companies.manager_user_id, 'owner', 'active'
FROM companies
WHERE companies.manager_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM company_managers
    WHERE company_managers.company_id = companies.id
      AND company_managers.user_id = companies.manager_user_id
  );

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS max_hours_per_week INTEGER DEFAULT 40,
    ADD COLUMN IF NOT EXISTS max_hours_per_day INTEGER DEFAULT 8,
    ADD COLUMN IF NOT EXISTS min_hours_per_shift INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_hours_per_shift INTEGER DEFAULT 12;

UPDATE employees
SET
    max_hours_per_week = COALESCE(max_hours_per_week, 40),
    max_hours_per_day = COALESCE(max_hours_per_day, 8),
    min_hours_per_shift = COALESCE(min_hours_per_shift, 5),
    max_hours_per_shift = COALESCE(max_hours_per_shift, 12)
WHERE max_hours_per_week IS NULL
   OR max_hours_per_day IS NULL
   OR min_hours_per_shift IS NULL
   OR max_hours_per_shift IS NULL;

CREATE TABLE IF NOT EXISTS employee_branches (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, branch_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_branches_one_primary_per_employee
    ON employee_branches (employee_id)
    WHERE is_primary;

INSERT INTO employee_branches (employee_id, branch_id, is_primary)
SELECT employees.id, employees.branch_id, TRUE
FROM employees
WHERE employees.branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM employee_branches
    WHERE employee_branches.employee_id = employees.id
      AND employee_branches.branch_id = employees.branch_id
  );

CREATE TABLE IF NOT EXISTS employee_positions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, position_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_positions_one_primary_per_employee
    ON employee_positions (employee_id)
    WHERE is_primary;

INSERT INTO employee_positions (employee_id, position_id, is_primary)
SELECT employees.id, employees.position_id, TRUE
FROM employees
WHERE employees.position_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM employee_positions
    WHERE employee_positions.employee_id = employees.id
      AND employee_positions.position_id = employees.position_id
  );
