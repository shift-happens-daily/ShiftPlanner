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
VALUES (
    'Coffee Bar Barnaul',
    'Barnaul, Lenin Street',
    'A7K9P2X4M8Q1L5R3',
    1
);

INSERT INTO branches (company_id, name, address)
SELECT id, 'Main Branch', 'Barnaul, Lenin Street'
FROM companies
WHERE invite_code = 'A7K9P2X4M8Q1L5R3';

INSERT INTO positions (company_id, name)
SELECT companies.id, position.name
FROM companies
CROSS JOIN (
    VALUES
        ('Barista'),
        ('Cashier'),
        ('Kitchen'),
        ('Supervisor')
) AS position(name)
WHERE companies.invite_code = 'A7K9P2X4M8Q1L5R3';

-- Generate 30 deterministic employee accounts. Keeping the sequence number in
-- the email makes employees easy to locate in manual SQL queries.
WITH employee_names(employee_number, full_name) AS (
    VALUES
        (1, 'Ivan Barista'),
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
    CASE
        WHEN employee_number = 1 THEN 'ivan@example.com'
        ELSE 'employee' || LPAD(employee_number::text, 2, '0') || '@example.com'
    END,
    '$2b$12$uSYcqEdeSEBbX1C4vnns9.33t2QvChgi0eQ5RxJBGg8jCHGqu3w8a',
    'employee'
FROM employee_names
ORDER BY employee_number;

-- Position distribution:
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
        CASE
            WHEN users.email = 'ivan@example.com' THEN 1
            ELSE SUBSTRING(users.email FROM 'employee([0-9]+)@')::INTEGER
        END AS employee_number
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
        END AS position_name,
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
    position_id,
    weekly_target_minutes,
    min_daily_minutes,
    max_daily_minutes
)
SELECT
    employee_configuration.user_id,
    companies.id,
    branches.id,
    positions.id,
    employee_configuration.weekly_target_minutes,
    employee_configuration.min_daily_minutes,
    employee_configuration.max_daily_minutes
FROM employee_configuration
JOIN companies ON companies.invite_code = 'A7K9P2X4M8Q1L5R3'
JOIN branches
  ON branches.company_id = companies.id
 AND branches.name = 'Main Branch'
JOIN positions
  ON positions.company_id = companies.id
 AND positions.name = employee_configuration.position_name
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
WHERE companies.invite_code = 'A7K9P2X4M8Q1L5R3';

-- Create one recurring requirement for every open 30-minute slot and
-- position. Demand changes by time of day and is busier on Friday/weekends.
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
position_demand AS (
    SELECT
        open_slots.*,
        positions.id AS position_id,
        positions.name AS position_name,
        CASE positions.name
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
    JOIN positions
      ON positions.company_id = open_slots.company_id
)
INSERT INTO staffing_requirements (
    company_id,
    branch_id,
    day_of_week,
    slot_time,
    position_id,
    required_count
)
SELECT
    company_id,
    branch_id,
    day_of_week,
    slot_time,
    position_id,
    required_count
FROM position_demand
WHERE required_count > 0
ORDER BY day_of_week, slot_time, position_id;

-- Availability pattern
-- --------------------
-- Each employee has two rotating unavailable dates. On the other five dates,
-- their available slots follow an early, middle, or late preference:
--   early  = opening through opening + 9 hours
--   middle = opening + 3 hours through opening + 12 hours
--   late   = closing - 9 hours through closing
--
-- This produces overlapping coverage without making every employee identical.
WITH employee_order AS (
    SELECT
        employees.id AS employee_id,
        CASE
            WHEN users.email = 'ivan@example.com' THEN 1
            ELSE SUBSTRING(users.email FROM 'employee([0-9]+)@')::INTEGER
        END AS employee_number
    FROM employees
    JOIN users ON users.id = employees.user_id
),
candidate_slots AS (
    SELECT
        employee_order.employee_id,
        employee_order.employee_number,
        business_hours.day_of_week,
        ('2026-06-22'::date + business_hours.day_of_week) AS availability_date,
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
INSERT INTO employee_availability (
    employee_id,
    availability_date,
    slot_time,
    availability_status
)
SELECT
    employee_id,
    availability_date,
    slot_time,
    CASE
        WHEN day_of_week <> employee_number % 7
         AND day_of_week <> (employee_number + 3) % 7
         AND slot_time >= preferred_start
         AND slot_time < preferred_finish
            THEN 'available'
        WHEN (
                day_of_week <> employee_number % 7
                AND day_of_week <> (employee_number + 3) % 7
             )
          OR (
                day_of_week = employee_number % 7
                AND slot_time >= '10:00'
                AND slot_time < '18:00'
             )
            THEN 'if_needed'
        ELSE 'unavailable'
    END
FROM preferred_windows
ORDER BY employee_id, availability_date, slot_time;

-- Concrete absences make the June 22-28 example exercise date-specific logic.
-- The selected employees cover different positions and absence types.
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
