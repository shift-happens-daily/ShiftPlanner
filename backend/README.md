# ShiftPlanner Backend

FastAPI backend for ShiftPlanner with PostgreSQL persistence, SQLAlchemy repositories, JWT authentication, role-based access control, invite-based company joining, company ownership for managers, employee membership, absences, reporting, and XLSX import for schedule requirements.

## Stack

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy 2.x
- `psycopg`
- Pydantic
- `python-jose`
- `passlib` + `bcrypt`
- `openpyxl`

## Architecture

```text
HTTP request
  -> API router
  -> auth / RBAC dependency
  -> service layer
  -> repository layer
  -> SQLAlchemy session
  -> PostgreSQL
  -> response schema
````

## Persistent Data

The backend persists:

* users and password hashes
* companies and invite codes
* manager-company ownership through `companies.manager_user_id`
* branches
* positions
* employee profiles
* employee company / branch / position membership
* weekly availability and desired days off
* absences
* schedule requirements
* schedules, shifts, and assignments
* shift exchange requests
* reports based on published shifts

The only auth state that still stays in memory is the active access-token set used for logout invalidation.

Because active tokens are stored in memory, after backend restart previously issued tokens are no longer treated as active.

## Source of Truth

The backend is the source of truth for company data.

For managers:

```text
users.id -> companies.manager_user_id
```

A manager's current company is returned through:

```text
GET /auth/me
```

For employees:

```text
users.id -> employees.user_id -> company_id / branch_id / position_id
```

An employee's current company, branch, and position are also returned through:

```text
GET /auth/me
```

The frontend should not restore company data from `localStorage`.

## Environment

Example `.env`:

```env
DATABASE_URL=postgresql+psycopg://shiftplanner_user:shiftplanner_password@localhost:5432/shiftplanner
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ROOT_PATH=/api
PUBLIC_API_BASE_URL=https://shiftplanner.online/api
EMAIL_VERIFICATION_REQUIRED=true
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USERNAME=shiftplanner@mail.ru
SMTP_FROM_EMAIL=shiftplanner@mail.ru
SMTP_PASSWORD=mail-ru-app-password
```

`SMTP_PASSWORD` must be an app password for `shiftplanner@mail.ru`, not the regular mailbox password.

If the server blocks outbound SMTP ports, use an HTTPS email API instead:

```env
PUBLIC_API_BASE_URL=https://shiftplanner.online/api
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_PROVIDER=resend
EMAIL_FROM=ShiftPlanner <no-reply@shiftplanner.online>
RESEND_API_KEY=re_...
```

For production delivery through Resend, verify the sending domain in Resend and use an address from that domain, for example `no-reply@shiftplanner.online`.

## Run PostgreSQL

From repository root:

```bash
docker compose -f backend/docker-compose.yml up -d
```

## Apply Schema

PowerShell:

```powershell
Get-Content backend/db/schema.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Git Bash / Linux / macOS:

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/schema.sql
```

## Apply Seed Data

Apply seed only if demo accounts and demo company data are needed.

PowerShell:

```powershell
Get-Content backend/db/seed.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Git Bash / Linux / macOS:

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/seed.sql
```

## Reset Database

After schema changes, reset the database from repository root:

```powershell
docker exec shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
Get-Content backend/db/schema.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Apply seed data only if needed:

```powershell
Get-Content backend/db/seed.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Useful check:

```powershell
docker exec shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner -c "SELECT id, name, invite_code, manager_user_id FROM companies ORDER BY id;"
```

## Demo Accounts

After applying `backend/db/seed.sql`:

* `manager@example.com` / `manager123`
* `ivan@example.com` / `employee123`

Seeded company data:

* company: `Coffee Bar Barnaul`
* invite code: `COFFEE123`
* branch: `Main Branch`
* positions: `Barista`, `Cashier`

If seed data is not applied, create manager, company, branch, position, and employee manually through the UI.

## Run Backend

From `backend/`:

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `.env`:

```bash
copy .env.example .env
```

Start API:

```bash
uvicorn app.main:app --reload
```

Useful URLs:

* Swagger UI: `http://localhost:8000/docs`
* OpenAPI schema: `http://localhost:8000/openapi.json`
* Health: `http://localhost:8000/health`
* DB health: `http://localhost:8000/health/db`

## Auth And Swagger

Main frontend login endpoint:

* `POST /auth/login`

Swagger-compatible token endpoint:

* `POST /auth/token`

`POST /auth/login` returns token and role.

After login, the frontend should call:

* `GET /auth/me`

`GET /auth/me` returns the full current profile:

* user id
* full name
* email
* role
* employee id, if the user is an employee
* company, if attached
* branch, if attached
* position, if attached

Swagger `Authorize` uses `/auth/token`, not `/auth/login`.

Typical frontend auth flow:

1. Call `POST /auth/login` or `POST /auth/register`.
2. Store the returned bearer token.
3. Call `GET /auth/me`.
4. Use returned `role`, `employee_id`, `company`, `branch`, and `position` in the UI.

## Main Endpoints

### Auth

* `POST /auth/login`
* `POST /auth/token`
* `POST /auth/register`
* `GET /auth/me`
* `POST /auth/logout`

### Companies And Invite Flow

* `GET /companies/`
* `POST /companies/`
* `GET /companies/invite/{invite_code}`
* `POST /companies/join`
* `GET /companies/{company_id}/branches`
* `POST /companies/{company_id}/branches`
* `DELETE /companies/{company_id}`

### Positions

* `GET /positions/`
* `POST /positions/`

Positions are attached to a company through `company_id`.

The frontend sends the current manager company id when creating positions.

### Employees

* `GET /employees/`
* `POST /employees/`
* `GET /employees/{employee_id}/availability`
* `POST /employees/{employee_id}/availability`
* `GET /employees/{employee_id}/absences`
* `POST /employees/{employee_id}/absences`
* `DELETE /employees/{employee_id}/absences/{absence_id}`
* `GET /employees/{employee_id}/calendar-summary`
* `GET /employees/me/absences`
* `POST /employees/me/absences`
* `GET /employees/me/calendar-summary`
* `GET /employees/me/schedule`

### Scheduling

* `POST /schedule/requirements`
* `POST /schedule/requirements/bulk`
* `GET /schedule/requirements`
* `POST /schedule/generate`
* `GET /schedule/{schedule_id}`
* `PATCH /schedule/{schedule_id}/shifts/{shift_id}`
* `POST /schedule/{schedule_id}/publish`
* `GET /schedule/my`
* `POST /schedule/exchange-requests`
* `GET /schedule/exchange-requests`
* `PATCH /schedule/exchange-requests/{exchange_request_id}`

### Reports

* `GET /reports/employees`
* `GET /reports/me`

### Imports

* `POST /imports/requirements/xlsx`

## Company Creation Flow

Manager flow:

1. Manager registers or logs in.
2. Frontend calls `POST /companies/`.
3. Backend creates a company with `manager_user_id = current_user.id`.
4. Frontend calls `GET /auth/me`.
5. Backend returns the manager profile with attached company.
6. Manager creates branches and positions for this company.
7. Manager sends invite code to employees.

The frontend should not store manager company data in `localStorage`.

## Invite Join Flow

Employee flow:

1. Employee logs in or registers.
2. Frontend calls `GET /companies/invite/{invite_code}`.
3. Backend returns company preview with branches and positions.
4. Employee chooses branch and position.
5. Frontend calls `POST /companies/join`.
6. Backend creates or updates the employee membership in the `employees` table.
7. Frontend calls `GET /auth/me`.
8. Backend returns employee profile with company, branch, and position.

`POST /companies/join` allows employee users only.

Manager join requests are rejected with `403`.

## Absences

Absence types:

* `vacation`
* `sick_leave`
* `other`

Rules:

* manager can create, view, and delete absences for any employee
* employee can create, view, and delete only own absences
* filtering by `start_date` and `end_date` is supported
* absences are persisted but are not yet used by schedule generation

## Bulk Requirements

`POST /schedule/requirements/bulk` lets a manager create repeated requirement rows for a date range and selected weekdays.

Example use cases:

* create weekday barista requirements for a whole week
* create requirements for multiple positions in one payload
* create repeated schedule templates without manual row-by-row input

`GET /schedule/requirements` supports:

* `start_date`
* `end_date`
* `position_id`

## Calendar Summary And Workload

`GET /employees/{employee_id}/calendar-summary` and `GET /employees/me/calendar-summary` return:

* employee basic info
* weekly availability
* desired days off
* absences in the selected period
* published assigned shifts in the selected period
* workload totals:

  * `total_shifts`
  * `total_hours`

Workload counts published schedules only.

## Reports

Manager report:

```text
GET /reports/employees?start_date=...&end_date=...
```

Employee self report:

```text
GET /reports/me?start_date=...&end_date=...
```

Reports include published shifts only.

## XLSX Import

Implemented import:

* `POST /imports/requirements/xlsx`

Expected columns:

* `date`
* `position_id`
* `start_time`
* `end_time`
* `min_staff`

The endpoint returns:

* `created_count`
* row-level `errors`

Availability XLSX import is not implemented in this stage.

## Current Limitations

* schedule generation is intentionally simple and uses the first matching employee
* availability and absences are not used by generation yet
* no conflict-detection algorithm
* no automatic reassignment after exchange approval
* no refresh tokens
* no background jobs
* no real calendar synchronization
* active access tokens are stored in memory and reset after backend restart

## Tests

Run from `backend/`:

```bash
python -m compileall app
python -m pytest
```

Current tests cover:

* `/auth/login`, `/auth/token`, `/auth/me`
* manager company creation and `/auth/me` company attachment
* invite preview and join flow
* employee company / branch / position membership
* absences permissions and filters
* bulk requirements creation
* calendar summary and published workload
* reports
* XLSX import
* exchange request regression flow

## Manual Verification Flow

1. Start PostgreSQL.
2. Reset database if needed.
3. Apply schema.
4. Apply seed only if demo data is needed.
5. Start backend.
6. Open `/docs`.
7. Authorize as manager through `/auth/token`.
8. Call `GET /auth/me`.
9. Create a company with `POST /companies/`.
10. Call `GET /auth/me` again and check that company is attached.
11. Create a branch.
12. Create a position.
13. Register or login employee.
14. Preview invite code.
15. Join company by invite code.
16. Call `GET /auth/me` as employee and check company, branch, and position.
17. Create absence.
18. Create bulk requirements.
19. Generate and publish schedule.
20. Check calendar summary.
21. Check reports.

```

