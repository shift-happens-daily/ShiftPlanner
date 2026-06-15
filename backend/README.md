# ShiftPlanner Backend

FastAPI backend for ShiftPlanner with PostgreSQL persistence, SQLAlchemy repositories, JWT auth, RBAC, invite-based company joining, absences, reporting, and XLSX import for schedule requirements.

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
  -> PostgreSQL repository
  -> SQLAlchemy session
  -> PostgreSQL
  -> response schema
```

## Persistent Data

The backend now persists:

- companies and invite codes
- branches
- users and password hashes
- employee profiles
- positions
- availability and desired days off
- absences
- schedule requirements
- schedules, shifts, and assignments
- shift exchange requests
- reports based on published shifts

The only auth state that still stays in memory is the active access-token set used for logout invalidation. After backend restart, previously issued tokens are not treated as active.

## Demo Accounts

After applying `backend/db/seed.sql`:

- `manager@example.com` / `manager123`
- `ivan@example.com` / `employee123`

Seeded company data:

- company: `Coffee Bar Barnaul`
- invite code: `COFFEE123`
- branch: `Main Branch`
- positions: `Barista`, `Cashier`

## Environment

Example `.env`:

```env
DATABASE_URL=postgresql+psycopg://shiftplanner_user:shiftplanner_password@localhost:5432/shiftplanner
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

## Run PostgreSQL

From repository root:

```bash
docker compose -f backend/docker-compose.yml up -d
```

Apply schema and seed.

PowerShell:

```powershell
Get-Content backend/db/schema.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
Get-Content backend/db/seed.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Git Bash / Linux / macOS:

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/schema.sql
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/seed.sql
```

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

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI schema: `http://localhost:8000/openapi.json`
- Health: `http://localhost:8000/health`
- DB health: `http://localhost:8000/health/db`

## Auth And Swagger

Main frontend login endpoint:

- `POST /auth/login`

Swagger-compatible token endpoint:

- `POST /auth/token`

`POST /auth/login` returns token and role. The frontend should then call `GET /auth/me` with the Bearer token to get the full profile, employee id, company, branch, and position.

Swagger `Authorize` uses `/auth/token`, not `/auth/login`.

Typical frontend auth flow:

1. Call `POST /auth/login` or `POST /auth/register`.
2. Store the returned bearer token.
3. Call `GET /auth/me`.
4. Use the returned `role`, `employee_id`, `company`, `branch`, and `position` in the UI.

## Main Endpoints

Auth:

- `POST /auth/login`
- `POST /auth/token`
- `POST /auth/register`
- `GET /auth/me`
- `POST /auth/logout`

Companies and invite flow:

- `GET /companies/`
- `POST /companies/`
- `GET /companies/invite/{invite_code}`
- `POST /companies/join`

Employees:

- `GET /employees/`
- `POST /employees/`
- `GET /employees/{employee_id}/availability`
- `POST /employees/{employee_id}/availability`
- `GET /employees/{employee_id}/absences`
- `POST /employees/{employee_id}/absences`
- `DELETE /employees/{employee_id}/absences/{absence_id}`
- `GET /employees/{employee_id}/calendar-summary`
- `GET /employees/me/absences`
- `POST /employees/me/absences`
- `GET /employees/me/calendar-summary`
- `GET /employees/me/schedule`

Scheduling:

- `POST /schedule/requirements`
- `POST /schedule/requirements/bulk`
- `GET /schedule/requirements`
- `POST /schedule/generate`
- `GET /schedule/{schedule_id}`
- `PATCH /schedule/{schedule_id}/shifts/{shift_id}`
- `POST /schedule/{schedule_id}/publish`
- `GET /schedule/my`
- `POST /schedule/exchange-requests`
- `GET /schedule/exchange-requests`
- `PATCH /schedule/exchange-requests/{exchange_request_id}`

Reports:

- `GET /reports/employees`
- `GET /reports/me`

Imports:

- `POST /imports/requirements/xlsx`

## Invite Join Flow

Recommended frontend flow:

1. User logs in or registers.
2. Frontend calls `GET /companies/invite/{invite_code}`.
3. User confirms company and chooses branch and position.
4. Frontend calls `POST /companies/join`.
5. Frontend calls `GET /auth/me` again.

`POST /companies/join` currently allows employee users only. Manager join requests are rejected with `403`.

## Absences

Absence types:

- `vacation`
- `sick_leave`
- `other`

Rules:

- manager can create, view, and delete absences for any employee
- employee can create, view, and delete only own absences
- filtering by `start_date` and `end_date` is supported
- absences are persisted but not yet used by schedule generation

## Bulk Requirements

`POST /schedule/requirements/bulk` lets a manager create repeated requirement rows for a date range and selected weekdays.

Example use case:

- create weekday barista requirements for a whole week in one request
- create multiple position templates in one payload

`GET /schedule/requirements` supports:

- `start_date`
- `end_date`
- `position_id`

## Calendar Summary And Workload

`GET /employees/{employee_id}/calendar-summary` and `GET /employees/me/calendar-summary` return:

- employee basic info
- weekly availability
- desired days off
- absences in the selected period
- published assigned shifts in the selected period
- workload totals: `total_shifts`, `total_hours`

Workload counts published schedules only.

## Reports

Manager report:

- `GET /reports/employees?start_date=...&end_date=...`

Employee self report:

- `GET /reports/me?start_date=...&end_date=...`

Reports include published shifts only.

## XLSX Import

Implemented import:

- `POST /imports/requirements/xlsx`

Expected columns:

- `date`
- `position_id`
- `start_time`
- `end_time`
- `min_staff`

The endpoint returns:

- `created_count`
- row-level `errors`

Availability XLSX import is not implemented in this stage.

## Current Limitations

- schedule generation is still intentionally simple and uses the first matching employee
- availability and absences are not used by generation yet
- no conflict-detection algorithm
- no automatic reassignment after exchange approval
- no refresh tokens
- no background jobs
- no real calendar synchronization

## Tests

Run from `backend/`:

```bash
python -m compileall app
python -m pytest
```

Current tests cover:

- `/auth/login`, `/auth/token`, `/auth/me`
- invite preview and join flow
- absences permissions and filters
- bulk requirements creation
- calendar summary and published workload
- reports
- XLSX import
- exchange request regression flow

## Manual Verification Flow

1. Start PostgreSQL.
2. Apply schema and seed.
3. Start backend.
4. Open `/docs`.
5. Authorize as manager through `/auth/token`.
6. Call `GET /auth/me`.
7. Preview invite code `COFFEE123`.
8. Register or login employee.
9. Join company by invite code.
10. Call `GET /auth/me` again.
11. Create absence.
12. Create bulk requirements.
13. Generate and publish schedule using existing simple generation.
14. Check calendar summary.
15. Check reports.
