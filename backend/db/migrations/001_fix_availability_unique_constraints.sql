-- Fix: daily availability for multiple weeks failed with UniqueViolation on
-- (employee_id, weekday, start_time, end_time) because weekday repeats across dates.
-- Weekly template uniqueness applies only when availability_date IS NULL.

ALTER TABLE employee_availability
    DROP CONSTRAINT IF EXISTS employee_availability_employee_id_weekday_start_time_end_ti_key;

ALTER TABLE employee_availability
    DROP CONSTRAINT IF EXISTS employee_availability_employee_id_weekday_start_time_end_time_key;

ALTER TABLE employee_availability
    DROP CONSTRAINT IF EXISTS employee_availability_employee_id_availability_date_start_ti_key;

ALTER TABLE employee_availability
    DROP CONSTRAINT IF EXISTS employee_availability_employee_id_availability_date_start_time_key;

DROP INDEX IF EXISTS employee_availability_weekly_template_unique;
DROP INDEX IF EXISTS employee_availability_daily_unique;

CREATE UNIQUE INDEX employee_availability_weekly_template_unique
    ON employee_availability (employee_id, weekday, start_time, end_time)
    WHERE availability_date IS NULL;

CREATE UNIQUE INDEX employee_availability_daily_unique
    ON employee_availability (employee_id, availability_date, start_time, end_time)
    WHERE availability_date IS NOT NULL;
