-- Complex local-development dataset for one seven-day scheduling run.
--
-- Example schedule period: Monday 2026-06-22 through Sunday 2026-06-28.
-- The data contains exactly 30 active employees at the Main Branch:
--   12 baristas, 8 cashiers, 6 kitchen staff, and 4 supervisors.
--
-- All employee accounts use the same development-only password hash as the
-- original seed accounts. Never reuse these credentials outside local testing.

INSERT INTO users (full_name, email, password_hash, role)
VALUES (
    'Maria Manager',
    'manager@example.com',
    '$2b$12$oo5ryRPAlz/TOfenPoE3JuFYJsdljzAhv.FLXcvx6vrvCPcCA1kTm',
    'manager'
);

INSERT INTO companies (name, address, invite_code, manager_user_id)
SELECT
    'Coffee Bar Barnaul',
    'Barnaul, Lenin Street',
    'COFFEE30',
    id
FROM users
WHERE email = 'manager@example.com';

INSERT INTO branches (company_id, name, address)
SELECT id, 'Main Branch', 'Barnaul, Lenin Street'
FROM companies
WHERE invite_code = 'COFFEE30';

INSERT INTO professions (company_id, name)
SELECT companies.id, profession.name
FROM companies
CROSS JOIN (
    VALUES
        ('Barista'),
        ('Cashier'),
        ('Kitchen'),
        ('Supervisor')
) AS profession(name)
WHERE companies.invite_code = 'COFFEE30';

-- Generate 30 deterministic employee accounts. Keeping the sequence number in
-- the email makes employees easy to locate in manual SQL queries.
WITH employee_names(employee_number, full_name) AS (
    VALUES
        (1, 'Ivan Petrov'),
        (2, 'Elena Smirnova'),
        (3, 'Alexey Ivanov'),
        (4, 'Anna Kuznetsova'),
        (5, 'Dmitry Popov'),
        (6, 'Olga Sokolova'),
        (7, 'Sergey Lebedev'),
        (8, 'Natalia Kozlova'),
        (9, 'Mikhail Novikov'),
        (10, 'Irina Morozova'),
        (11, 'Andrey Volkov'),
        (12, 'Tatiana Solovieva'),
        (13, 'Nikolay Vasiliev'),
        (14, 'Svetlana Zaitseva'),
        (15, 'Vladimir Pavlov'),
        (16, 'Marina Semenova'),
        (17, 'Artem Golubev'),
        (18, 'Yulia Vinogradova'),
        (19, 'Roman Bogdanov'),
        (20, 'Ekaterina Vorobieva'),
        (21, 'Denis Fedorov'),
        (22, 'Alina Mikhailova'),
        (23, 'Kirill Belyaev'),
        (24, 'Polina Tarasova'),
        (25, 'Maxim Belov'),
        (26, 'Vera Komarova'),
        (27, 'Ilya Orlov'),
        (28, 'Ksenia Kiseleva'),
        (29, 'Oleg Makarov'),
        (30, 'Lidia Andreeva')
)
INSERT INTO users (full_name, email, password_hash, role)
SELECT
    full_name,
    'employee' || LPAD(employee_number::text, 2, '0') || '@example.com',
    '$2b$12$uSYcqEdeSEBbX1C4vnns9.33t2QvChgi0eQ5RxJBGg8jCHGqu3w8a',
    'employee'
FROM employee_names
ORDER BY employee_number;

-- Profession distribution:
--   employee01..12 = Barista
--   employee13..20 = Cashier
--   employee21..26 = Kitchen
--   employee27..30 = Supervisor
--
-- Hour targets deliberately vary so the solver has a meaningful balancing
-- objective. Daily limits remain aligned to 30-minute slots.
WITH numbered_users AS (
    SELECT
        users.id AS user_id,
        ROW_NUMBER() OVER (ORDER BY users.email) AS employee_number
    FROM users
    WHERE users.role = 'employee'
),
employee_configuration AS (
    SELECT
        numbered_users.*,
        CASE
            WHEN employee_number <= 12 THEN 'Barista'
            WHEN employee_number <= 20 THEN 'Cashier'
            WHEN employee_number <= 26 THEN 'Kitchen'
            ELSE 'Supervisor'
        END AS profession_name,
        CASE employee_number % 4
            WHEN 0 THEN 2400
            WHEN 1 THEN 2100
            WHEN 2 THEN 1800
            ELSE 1500
        END AS weekly_target_minutes,
        CASE
            WHEN employee_number % 5 = 0 THEN 180
            ELSE 240
        END AS min_daily_minutes,
        CASE
            WHEN employee_number % 6 = 0 THEN 420
            ELSE 480
        END AS max_daily_minutes
    FROM numbered_users
)
INSERT INTO employees (
    user_id,
    company_id,
    branch_id,
    profession_id,
    weekly_target_minutes,
    min_daily_minutes,
    max_daily_minutes
)
SELECT
    employee_configuration.user_id,
    companies.id,
    branches.id,
    professions.id,
    employee_configuration.weekly_target_minutes,
    employee_configuration.min_daily_minutes,
    employee_configuration.max_daily_minutes
FROM employee_configuration
JOIN companies ON companies.invite_code = 'COFFEE30'
JOIN branches
  ON branches.company_id = companies.id
 AND branches.name = 'Main Branch'
JOIN professions
  ON professions.company_id = companies.id
 AND professions.name = employee_configuration.profession_name
ORDER BY employee_configuration.employee_number;

-- Longer Friday/Saturday trading hours make the example meaningfully different
-- across weekdays while retaining half-hour boundaries.
INSERT INTO business_hours (
    company_id,
    branch_id,
    day_of_week,
    start_time,
    finish_time
)
SELECT
    companies.id,
    branches.id,
    hours.day_of_week,
    hours.start_time,
    hours.finish_time
FROM companies
JOIN branches
  ON branches.company_id = companies.id
 AND branches.name = 'Main Branch'
CROSS JOIN (
    VALUES
        (0, '07:00'::time, '22:00'::time),
        (1, '07:00'::time, '22:00'::time),
        (2, '07:00'::time, '22:00'::time),
        (3, '07:00'::time, '22:00'::time),
        (4, '07:00'::time, '23:00'::time),
        (5, '08:00'::time, '23:00'::time),
        (6, '08:00'::time, '21:00'::time)
) AS hours(day_of_week, start_time, finish_time)
WHERE companies.invite_code = 'COFFEE30';

-- Create one recurring requirement for every open 30-minute slot and
-- profession. Demand changes by time of day and is busier on Friday/weekends.
WITH open_slots AS (
    SELECT
        business_hours.company_id,
        business_hours.branch_id,
        business_hours.day_of_week,
        slot_start::time AS slot_time
    FROM business_hours
    CROSS JOIN LATERAL generate_series(
        CURRENT_DATE + business_hours.start_time,
        CURRENT_DATE + business_hours.finish_time - INTERVAL '30 minutes',
        INTERVAL '30 minutes'
    ) AS slot_start
),
profession_demand AS (
    SELECT
        open_slots.*,
        professions.id AS profession_id,
        professions.name AS profession_name,
        CASE professions.name
            WHEN 'Barista' THEN
                CASE
                    WHEN slot_time >= '08:00' AND slot_time < '11:00' THEN 4
                    WHEN slot_time >= '12:00' AND slot_time < '14:00' THEN 3
                    WHEN slot_time >= '17:00' AND slot_time < '20:30' THEN
                        CASE WHEN day_of_week IN (4, 5) THEN 5 ELSE 4 END
                    ELSE 2
                END
            WHEN 'Cashier' THEN
                CASE
                    WHEN slot_time >= '08:00' AND slot_time < '11:00' THEN 2
                    WHEN slot_time >= '12:00' AND slot_time < '14:00' THEN 2
                    WHEN slot_time >= '17:00' AND slot_time < '20:30' THEN 3
                    ELSE 1
                END
            WHEN 'Kitchen' THEN
                CASE
                    WHEN slot_time < '08:00' THEN 0
                    WHEN slot_time >= '11:00' AND slot_time < '15:00' THEN 2
                    WHEN slot_time >= '17:00' AND slot_time < '21:00' THEN 2
                    ELSE 1
                END
            WHEN 'Supervisor' THEN 1
        END AS required_count
    FROM open_slots
    JOIN professions
      ON professions.company_id = open_slots.company_id
)
INSERT INTO staffing_requirements (
    company_id,
    branch_id,
    day_of_week,
    slot_time,
    profession_id,
    required_count
)
SELECT
    company_id,
    branch_id,
    day_of_week,
    slot_time,
    profession_id,
    required_count
FROM profession_demand
WHERE required_count > 0
ORDER BY day_of_week, slot_time, profession_id;

-- Availability pattern
-- --------------------
-- Each employee has two rotating unavailable weekdays. On the other five days,
-- their confirmed availability follows an early, middle, or late preference:
--   early  = opening through opening + 9 hours
--   middle = opening + 3 hours through opening + 12 hours
--   late   = closing - 9 hours through closing
--
-- This produces overlapping coverage without making every employee identical.
WITH employee_order AS (
    SELECT
        employees.id AS employee_id,
        ROW_NUMBER() OVER (ORDER BY users.email) AS employee_number
    FROM employees
    JOIN users ON users.id = employees.user_id
),
candidate_slots AS (
    SELECT
        employee_order.employee_id,
        employee_order.employee_number,
        business_hours.day_of_week,
        business_hours.start_time,
        business_hours.finish_time,
        slot_start::time AS slot_time
    FROM employee_order
    CROSS JOIN business_hours
    CROSS JOIN LATERAL generate_series(
        CURRENT_DATE + business_hours.start_time,
        CURRENT_DATE + business_hours.finish_time - INTERVAL '30 minutes',
        INTERVAL '30 minutes'
    ) AS slot_start
),
preferred_windows AS (
    SELECT
        candidate_slots.*,
        CASE employee_number % 3
            WHEN 1 THEN start_time
            WHEN 2 THEN (CURRENT_DATE + start_time + INTERVAL '3 hours')::time
            ELSE GREATEST(
                CURRENT_DATE + start_time,
                CURRENT_DATE + finish_time - INTERVAL '9 hours'
            )::time
        END AS preferred_start,
        CASE employee_number % 3
            WHEN 1 THEN LEAST(
                CURRENT_DATE + finish_time,
                CURRENT_DATE + start_time + INTERVAL '9 hours'
            )::time
            WHEN 2 THEN LEAST(
                CURRENT_DATE + finish_time,
                CURRENT_DATE + start_time + INTERVAL '12 hours'
            )::time
            ELSE finish_time
        END AS preferred_finish
    FROM candidate_slots
)
INSERT INTO employee_confirmed_availability (
    employee_id,
    day_of_week,
    slot_time
)
SELECT employee_id, day_of_week, slot_time
FROM preferred_windows
WHERE day_of_week <> employee_number % 7
  AND day_of_week <> (employee_number + 3) % 7
  AND slot_time >= preferred_start
  AND slot_time < preferred_finish
ORDER BY employee_id, day_of_week, slot_time;

-- Possible availability provides two kinds of fallback:
--   1. slots outside the employee's preferred window on a confirmed workday;
--   2. 10:00-18:00 availability on one rotating otherwise-unavailable day.
--
-- NOT EXISTS guarantees that no slot overlaps confirmed availability.
WITH employee_order AS (
    SELECT
        employees.id AS employee_id,
        ROW_NUMBER() OVER (ORDER BY users.email) AS employee_number
    FROM employees
    JOIN users ON users.id = employees.user_id
),
candidate_slots AS (
    SELECT
        employee_order.employee_id,
        employee_order.employee_number,
        business_hours.day_of_week,
        slot_start::time AS slot_time
    FROM employee_order
    CROSS JOIN business_hours
    CROSS JOIN LATERAL generate_series(
        CURRENT_DATE + business_hours.start_time,
        CURRENT_DATE + business_hours.finish_time - INTERVAL '30 minutes',
        INTERVAL '30 minutes'
    ) AS slot_start
)
INSERT INTO employee_possible_availability (
    employee_id,
    day_of_week,
    slot_time
)
SELECT
    candidate_slots.employee_id,
    candidate_slots.day_of_week,
    candidate_slots.slot_time
FROM candidate_slots
WHERE (
        (
            day_of_week <> employee_number % 7
            AND day_of_week <> (employee_number + 3) % 7
        )
        OR (
            day_of_week = employee_number % 7
            AND slot_time >= '10:00'
            AND slot_time < '18:00'
        )
    )
  AND NOT EXISTS (
      SELECT 1
      FROM employee_confirmed_availability AS confirmed
      WHERE confirmed.employee_id = candidate_slots.employee_id
        AND confirmed.day_of_week = candidate_slots.day_of_week
        AND confirmed.slot_time = candidate_slots.slot_time
  )
ORDER BY employee_id, day_of_week, slot_time;

-- Concrete absences make the June 22-28 example exercise date-specific logic.
-- The selected employees cover different professions and absence types.
INSERT INTO absences (
    employee_id,
    absence_type,
    start_date,
    end_date,
    comment
)
SELECT
    employees.id,
    absence.absence_type,
    absence.start_date,
    absence.end_date,
    absence.comment
FROM (
    VALUES
        ('employee03@example.com', 'sick_leave', '2026-06-22'::date, '2026-06-23'::date, 'Seasonal illness'),
        ('employee09@example.com', 'vacation', '2026-06-26'::date, '2026-06-28'::date, 'Planned leave'),
        ('employee16@example.com', 'other', '2026-06-24'::date, '2026-06-24'::date, 'University exam'),
        ('employee23@example.com', 'vacation', '2026-06-22'::date, '2026-06-25'::date, 'Family trip'),
        ('employee28@example.com', 'sick_leave', '2026-06-27'::date, '2026-06-28'::date, 'Medical leave')
) AS absence(email, absence_type, start_date, end_date, comment)
JOIN users ON users.email = absence.email
JOIN employees ON employees.user_id = users.id;
