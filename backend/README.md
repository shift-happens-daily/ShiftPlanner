# ShiftPlanner Backend

This backend is a FastAPI API for ShiftPlanner backed by PostgreSQL. Core Stage 2 data is now persistent: users, employees, availability, requirements, schedules, shift assignments, exchange requests, and reports all read and write through SQLAlchemy repositories instead of the old in-memory `MockDatabase`.

## Stack

- Python
- FastAPI
- Pydantic
- Uvicorn
- PostgreSQL
- SQLAlchemy 2.x
- `psycopg`
- `python-jose`
- `passlib` + `bcrypt`

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

Project layout:

```text
backend/
  app/
    api/
    models/
    repositories/
    schemas/
    services/
    database.py
    main.py
  db/
    schema.sql
    seed.sql
  tests/
    test_api.py
  .env.example
  Dockerfile
  docker-compose.yml
  requirements.txt
```

## What Is Persistent

The PostgreSQL-backed backend now persists:

- companies
- branches in the database schema
- users and password hashes
- positions
- employees
- employee weekly availability
- employee desired days off
- absences in the database schema
- schedule requirements
- generated schedules
- shifts and shift assignments
- shift exchange requests
- reports derived from published shifts

The only auth state that is still in memory is the active JWT token set used for logout invalidation. After a backend restart, issued tokens are no longer considered active.

## Demo Data

After applying `seed.sql`, local development has these demo accounts:

- `manager@example.com` / `manager123`
- `ivan@example.com` / `employee123`

The seed also creates:

- company: `Coffee Bar Barnaul`
- branch: `Main Branch`
- positions: `Barista`, `Cashier`
- employee: `Ivan Barista`
- one initial shift requirement on `2026-06-15`

## Environment Variables

Example `.env`:

```env
DATABASE_URL=postgresql+psycopg://shiftplanner_user:shiftplanner_password@localhost:5432/shiftplanner
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

`FRONTEND_ORIGINS` accepts a comma-separated list.

## Run PostgreSQL

From the repository root:

```bash
docker compose -f backend/docker-compose.yml up -d
```

## Apply Schema And Seed

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

If you need a clean reset first:

```powershell
docker exec shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
```

## Run Backend

From the `backend` directory:

```bash
python -m venv .venv
```

On Windows:

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

Start the server:

```bash
uvicorn app.main:app --reload
```

## Health Endpoints

- `GET /health`
- `GET /health/db`

`/health/db` returns `200` when the API can connect to PostgreSQL and `503` when the database is unavailable.

## Main API Areas

Authentication:

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/logout`

Reference data:

- `GET /companies/`
- `POST /companies/`
- `GET /positions/`
- `POST /positions/`
- `GET /employees/`
- `POST /employees/`

Availability:

- `GET /employees/{employee_id}/availability`
- `POST /employees/{employee_id}/availability`

Scheduling:

- `POST /schedule/requirements`
- `GET /schedule/requirements`
- `POST /schedule/generate`
- `GET /schedule/{schedule_id}`
- `PATCH /schedule/{schedule_id}/shifts/{shift_id}`
- `POST /schedule/{schedule_id}/publish`
- `GET /schedule/my`
- `GET /employees/me/schedule`

Exchange requests and reports:

- `POST /schedule/exchange-requests`
- `GET /schedule/exchange-requests`
- `PATCH /schedule/exchange-requests/{exchange_request_id}`
- `GET /reports/employees`

## Recommended Demo Flow

1. Start PostgreSQL.
2. Apply `schema.sql`.
3. Apply `seed.sql`.
4. Start the backend and open `http://localhost:8000/docs`.
5. Login as `manager@example.com`.
6. Create a requirement or use the seeded one.
7. Generate a schedule.
8. Publish the schedule.
9. Login as `ivan@example.com`.
10. Open `/schedule/my`.
11. Create a shift exchange request.
12. Switch back to the manager account and approve or reject it.
13. Open `/reports/employees`.
14. Restart the backend and confirm that schedules, requirements, and exchange requests are still present.

## Tests

Smoke tests live in `tests/test_api.py` and reset the PostgreSQL schema before each test.

Run them from `backend/`:

```bash
python -m pytest tests/test_api.py
```

They cover:

- auth, logout, and RBAC
- company and position creation
- employee creation and availability access rules
- requirement creation
- schedule generation, reassignment, and publish flow
- employee personal schedule access
- exchange request creation and approval
- report calculation from published shifts

## Current Limitations

- schedule generation is still intentionally simple and uses the first matching employee per position
- availability is persisted but not yet used by the generation logic
- exchange request approval does not automatically reassign shifts
- branches and absences exist in the schema but do not yet have dedicated API endpoints
- active JWT invalidation is still memory-based and resets on backend restart
- there are no refresh tokens or background jobs

## Verification Done

The current PostgreSQL-backed implementation was verified with:

```bash
python -m compileall app
python -m pytest tests/test_api.py
```

It was also manually smoke-tested through `TestClient` for the full flow: manager login, employee login, requirement creation, schedule generation, schedule publish, employee schedule access, exchange request approval, reports, and logout invalidation.
