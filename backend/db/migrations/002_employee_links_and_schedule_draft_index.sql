INSERT INTO employee_branches (employee_id, branch_id, is_primary)
SELECT id, branch_id, TRUE
FROM employees
WHERE branch_id IS NOT NULL
ON CONFLICT (employee_id, branch_id) DO NOTHING;

INSERT INTO employee_positions (employee_id, position_id, is_primary)
SELECT id, position_id, TRUE
FROM employees
WHERE position_id IS NOT NULL
ON CONFLICT (employee_id, position_id) DO NOTHING;

DROP INDEX IF EXISTS uq_schedules_company_branch_week;

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedules_company_branch_draft_period
    ON schedules (company_id, branch_id, start_date, end_date)
    WHERE status = 'draft';

ALTER TABLE company_managers
    ALTER COLUMN membership_status SET DEFAULT 'active';
