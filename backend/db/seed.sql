INSERT INTO users (full_name, email, password_hash, role)
VALUES
('Maria Manager', 'manager@example.com', '$2b$12$oo5ryRPAlz/TOfenPoE3JuFYJsdljzAhv.FLXcvx6vrvCPcCA1kTm', 'manager'),
('Ivan Barista', 'ivan@example.com', '$2b$12$uSYcqEdeSEBbX1C4vnns9.33t2QvChgi0eQ5RxJBGg8jCHGqu3w8a', 'employee');

INSERT INTO companies (name, address, invite_code, manager_user_id)
VALUES ('Coffee Bar Barnaul', 'Barnaul, Lenin Street', 'A7K9P2X4M8Q1L5R3', 1);

INSERT INTO branches (company_id, name, address)
VALUES (1, 'Main Branch', 'Barnaul, Lenin Street');

INSERT INTO positions (company_id, name)
VALUES
(1, 'Barista'),
(1, 'Cashier');

INSERT INTO employees (user_id, company_id, branch_id, position_id, max_hours_per_week)
VALUES
(2, 1, NULL, NULL, 40);

INSERT INTO employee_availability (employee_id, weekday, start_time, end_time)
VALUES
(1, 0, '10:00', '18:00'),
(1, 1, '12:00', '20:00');

INSERT INTO employee_desired_days_off (employee_id, weekday)
VALUES
(1, 5),
(1, 6);

INSERT INTO shift_requirements (company_id, branch_id, position_id, shift_date, start_time, end_time, required_employees)
VALUES
(1, 1, 1, '2026-06-15', '10:00', '18:00', 1);

INSERT INTO schedules (company_id, start_date, end_date, status)
VALUES
(1, '2026-06-15', '2026-06-21', 'draft');

INSERT INTO shifts (schedule_id, company_id, position_id, shift_date, start_time, end_time)
VALUES
(1, 1, 1, '2026-06-15', '10:00', '18:00');

INSERT INTO shift_assignments (shift_id, employee_id, status)
VALUES
(1, 1, 'assigned');