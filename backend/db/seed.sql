INSERT INTO companies (name, invite_code)
VALUES ('Coffee Bar Barnaul', 'COFFEE123');

INSERT INTO branches (company_id, name, address)
VALUES (1, 'Main Branch', 'Barnaul, Lenin Street');

INSERT INTO users (full_name, email, password_hash, role)
VALUES
('Maria Manager', 'manager@example.com', 'hashed_password', 'manager'),
('Ivan Barista', 'ivan@example.com', 'hashed_password', 'employee');

INSERT INTO positions (company_id, name)
VALUES
(1, 'Barista'),
(1, 'Cashier');

INSERT INTO employees (user_id, company_id, branch_id, position_id, max_hours_per_week)
VALUES
(2, 1, 1, 1, 40);

INSERT INTO employee_availability (employee_id, day_of_week, start_time, end_time)
VALUES
(1, 1, '10:00', '18:00'),
(1, 2, '12:00', '20:00');

INSERT INTO shift_requirements (company_id, position_id, shift_date, start_time, end_time, required_employees)
VALUES
(1, 1, '2026-06-15', '10:00', '18:00', 1);