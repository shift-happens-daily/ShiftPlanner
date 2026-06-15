You are working on the ShiftPlanner project.

The project currently has two separate parts:

1. A Stage 2 FastAPI backend mock API.
2. A PostgreSQL database schema with seed data.

Your task is to integrate the PostgreSQL database with the existing FastAPI backend.

The goal is to replace the current in-memory `MockDatabase` storage with a real PostgreSQL-backed persistence layer while preserving the existing API behavior as much as possible.

---

# Current Backend Context

The backend is a Stage 2 FastAPI API for ShiftPlanner.

It currently keeps all data in memory using a mock repository/database.

Current backend features include:

* JWT-based login
* in-memory active token tracking
* password hashing with `passlib` and `bcrypt`
* role-aware users:

  * `manager`
  * `employee`
* protected routes with Swagger `Authorize` support
* role-based access control
* companies
* positions
* employees
* employee availability
* schedule requirements
* mock schedule generation
* manual shift reassignment and removal
* schedule publishing
* employee personal schedule endpoints
* shift exchange requests
* reports derived from published schedules
* normalized `422` validation errors

Current backend stack:

* Python
* FastAPI
* Pydantic
* Uvicorn
* `python-jose`
* `passlib` + `bcrypt`
* in-memory mock repository

Current architecture:

```text
HTTP request
  -> API router
  -> auth / RBAC dependency
  -> service layer
  -> MockDatabase
  -> response schema
```

Current project layout:

```text
backend/
  app/
    api/
    repositories/
    schemas/
    services/
    main.py
  db/
    schema.sql
    seed.sql
  .env.example
  Dockerfile
  docker-compose.yml
  requirements.txt
```

---

# Current Database Context

There is now a PostgreSQL database for ShiftPlanner MVP.

The database has:

* `schema.sql` — creates database tables
* `seed.sql` — inserts demo data for local testing
* PostgreSQL is started through Docker Compose

The database stores the main entities required for automatic shift scheduling:

* companies
* branches
* users
* positions
* employees
* employee availability
* absences
* shift requirements
* generated shifts
* shift assignments

The database can be started with:

```bash
docker compose -f backend/docker-compose.yml up -d
```

Schema can be applied with:

PowerShell:

```powershell
Get-Content backend/db/schema.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Git Bash / Linux / macOS:

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/schema.sql
```

Seed can be applied with:

PowerShell:

```powershell
Get-Content backend/db/seed.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Git Bash / Linux / macOS:

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/seed.sql
```

---

# Main Goal

Integrate the existing FastAPI backend with PostgreSQL.

The backend should no longer rely on `MockDatabase` for core persistent data.

Instead, it should use PostgreSQL for:

* companies
* branches, if already present in the schema
* users
* positions
* employees
* employee availability
* absences, if already present in the schema
* shift requirements
* generated schedules / shifts
* shift assignments
* shift exchange requests, if present in the backend and/or schema
* notifications, if already implemented in the backend or schema
* reports based on published shifts

Keep the public API as close as possible to the current Stage 2 API.

Do not rewrite the whole project from scratch.

Refactor incrementally and preserve the existing routers, schemas, services, and response formats where possible.

---

# Important Requirements

## 1. Inspect the Existing Code First

Before changing anything:

* inspect the current FastAPI app structure
* inspect all routers
* inspect all Pydantic schemas
* inspect the existing service layer
* inspect the current `MockDatabase`
* inspect `schema.sql`
* inspect `seed.sql`
* inspect `docker-compose.yml`
* inspect `requirements.txt`

Understand how the current mock data maps to the PostgreSQL tables.

Do not assume table names or column names. Use the actual database schema as the source of truth.

---

## 2. Add a Proper Database Layer

Add a PostgreSQL database layer to the backend.

Use SQLAlchemy if the project does not already have a database library.

Prefer SQLAlchemy 2.x style if possible.

Add required dependencies to `requirements.txt`, for example:

```text
SQLAlchemy
psycopg2-binary
```

If Alembic is already present, use it.
If Alembic is not present, do not introduce migrations unless necessary for this step. The current `schema.sql` may remain the main schema source for now.

Create a database module, for example:

```text
backend/app/database.py
```

It should contain:

* database URL loading from environment variables
* SQLAlchemy engine
* session factory
* `get_db()` FastAPI dependency

Example desired environment variable:

```env
DATABASE_URL=postgresql+psycopg2://shiftplanner_user:shiftplanner_password@localhost:5432/shiftplanner
```

If Docker networking requires a different host inside containers, document it clearly.

Update `.env.example` with the new database configuration.

---

## 3. Create SQLAlchemy Models

Create SQLAlchemy models matching the existing `schema.sql`.

Suggested location:

```text
backend/app/models/
```

For example:

```text
backend/app/models/company.py
backend/app/models/branch.py
backend/app/models/user.py
backend/app/models/position.py
backend/app/models/employee.py
backend/app/models/availability.py
backend/app/models/absence.py
backend/app/models/schedule.py
backend/app/models/shift.py
backend/app/models/exchange_request.py
backend/app/models/notification.py
```

Only create models for tables that actually exist in `schema.sql`.

The models must match:

* table names
* column names
* primary keys
* foreign keys
* nullable fields
* unique constraints
* default values
* enum-like fields
* timestamp fields

Do not invent columns unless needed to preserve current backend behavior.
If a needed backend field is missing in the database schema, document it and either:

1. adapt the backend behavior to the existing schema, or
2. minimally update `schema.sql` with a clear explanation.

Prefer minimal changes.

---

## 4. Replace Mock Repositories with Database Repositories

The current backend likely uses something like:

```text
app/repositories/mock_db.py
```

or an in-memory repository.

Replace or supplement it with database-backed repositories.

Suggested structure:

```text
backend/app/repositories/
  company_repository.py
  position_repository.py
  employee_repository.py
  user_repository.py
  availability_repository.py
  schedule_repository.py
  exchange_request_repository.py
  notification_repository.py
  report_repository.py
```

Each repository should use a SQLAlchemy session.

Do not put raw database logic directly into API routers.

Keep this flow:

```text
HTTP request
  -> API router
  -> auth / RBAC dependency
  -> service layer
  -> PostgreSQL repository
  -> SQLAlchemy session
  -> response schema
```

---

# Endpoint Integration Requirements

Preserve the current API endpoints unless there is a strong reason to change them.

## Health

Keep:

```http
GET /health
```

Optionally add a database health check endpoint:

```http
GET /health/db
```

This endpoint should verify that the backend can connect to PostgreSQL.

---

## Authentication

Current endpoints:

```http
POST /auth/login
POST /auth/register
POST /auth/logout
```

Update authentication to use the PostgreSQL `users` table.

Login should:

1. find the user by email in PostgreSQL
2. verify the password hash using `passlib`
3. create a JWT token
4. store the active token if the active-token behavior is still required
5. return:

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer",
  "role": "manager"
}
```

Important:

* Do not store plain-text passwords.
* If `seed.sql` currently stores plain-text passwords, fix the seed strategy.
* Seeded users should have valid password hashes compatible with the backend login logic.
* Preserve demo users if possible:

```text
manager@example.com / manager123
ivan@example.com / employee123
```

Register should:

1. create a user in PostgreSQL
2. hash the password
3. assign the selected role
4. if role is `employee` and email matches an existing employee record, link the user to that employee profile

Logout should invalidate the current token.

If active tokens are still stored only in memory, document that logout invalidation is still reset on backend restart.
If you decide to persist active tokens in PostgreSQL, add the required table or use an existing one if available.

---

## Authorization and RBAC

Preserve current authorization rules.

Manager-only endpoints:

```http
POST /companies/
POST /positions/
POST /employees/
POST /schedule/requirements
POST /schedule/generate
PATCH /schedule/{id}/shifts/{shift_id}
POST /schedule/{id}/publish
GET /schedule/exchange-requests
PATCH /schedule/exchange-requests/{id}
GET /reports/employees
```

Employee-only endpoints:

```http
GET /schedule/my
GET /employees/me/schedule
POST /schedule/exchange-requests
```

Manager or employee-self endpoints:

```http
GET /employees/{id}/availability
POST /employees/{id}/availability
```

All protected routes must still return:

* `401` for missing or invalid token
* `403` for role violations

Swagger `Authorize` support must continue to work.

---

## Companies

Current endpoints:

```http
GET /companies/
POST /companies/
```

Update them to read/write from PostgreSQL.

`GET /companies/` should return companies from the database.

`POST /companies/` should insert a new company into PostgreSQL.

If the database has `invite_code`, generate one if required by the schema.

---

## Branches

The database schema includes branches.

If the current backend does not expose branch endpoints yet, do not break existing APIs.

Either:

1. add minimal branch support if it is straightforward, or
2. leave branch endpoints for a later stage and document that branches exist in the DB but are not yet exposed through the API.

If employees or requirements require `branch_id`, adapt the backend carefully.

---

## Positions

Current endpoints:

```http
GET /positions/
POST /positions/
```

Update them to read/write from PostgreSQL.

If positions are company-specific or branch-specific in the database schema, respect the actual foreign keys.

---

## Employees

Current endpoints:

```http
GET /employees/
POST /employees/
```

Update them to use PostgreSQL.

`GET /employees/` should return employees from the database, including embedded availability data if the current API already does that.

`POST /employees/` should create an employee in PostgreSQL.

Preserve request format if possible:

```json
{
  "full_name": "Anna Petrova",
  "email": "anna@example.com",
  "position_id": 2
}
```

If the database requires extra fields like `company_id` or `branch_id`, use sensible defaults from seeded data for now or update the API schema carefully.

Document any required changes.

---

## Employee Availability

Current endpoints:

```http
GET /employees/{employee_id}/availability
POST /employees/{employee_id}/availability
```

Update them to use PostgreSQL.

Current request format:

```json
{
  "weekly_availability": [
    {
      "weekday": 0,
      "start_time": "09:00:00",
      "end_time": "18:00:00"
    }
  ],
  "desired_days_off": [5, 6]
}
```

Preserve Python weekday numbering:

```text
0 = Monday
6 = Sunday
```

If the database uses different naming, for example `day_of_week`, map it correctly.

When saving availability:

* validate employee access rules
* manager can update any employee availability
* employee can update only their own availability
* replace old availability records or update them consistently
* preserve desired days off if the schema supports them
* if desired days off are stored differently or not supported, document the limitation

---

## Absences

The database includes absences.

If the backend does not currently expose absence endpoints, do one of the following:

1. add simple endpoints for absences, if it fits the current architecture, or
2. leave this for a later stage and document it clearly.

Do not let absence integration break current scheduling functionality.

---

## Schedule Requirements

Current endpoints:

```http
POST /schedule/requirements
GET /schedule/requirements?start_date=2026-06-01&end_date=2026-06-30
```

Update requirements to be stored in PostgreSQL.

Current request format:

```json
{
  "position_id": 1,
  "date": "2026-06-15",
  "min_staff": 2,
  "start_time": "10:00:00",
  "end_time": "18:00:00"
}
```

`GET /schedule/requirements` should filter by date range.

Preserve current response shape if possible.

---

## Schedule Generation

Current endpoint:

```http
POST /schedule/generate
```

Current optional request body:

```json
{
  "start_date": "2026-06-15",
  "end_date": "2026-06-21"
}
```

Update schedule generation to use PostgreSQL data.

For this stage, do not implement a complex scheduling algorithm unless already present.

Preserve the current simple mock behavior:

* read requirements from PostgreSQL
* find employees from PostgreSQL by required position
* create generated schedule / shifts in PostgreSQL
* create one shift using the first matching employee
* if no employee exists for the required position, return the requirement as unfilled
* if `min_staff > 1`, create only one shift and mark the remaining staff count as unfilled
* availability may still be stored but does not need to be used by generation in this step
* conflict detection may remain empty or basic

Response should still include:

```json
{
  "shifts": [],
  "conflicts": [],
  "unfilled_requirements": []
}
```

Make sure generated schedules and shifts persist after backend restart.

---

## Schedule Management

Current endpoints:

```http
GET /schedule/{schedule_id}
PATCH /schedule/{schedule_id}/shifts/{shift_id}
POST /schedule/{schedule_id}/publish
```

Update them to use PostgreSQL.

`GET /schedule/{schedule_id}` should read the schedule and shifts from PostgreSQL.

`PATCH /schedule/{schedule_id}/shifts/{shift_id}` should support:

Reassign:

```json
{
  "action": "reassign",
  "employee_id": 3
}
```

Remove:

```json
{
  "action": "remove"
}
```

`POST /schedule/{schedule_id}/publish` should transition a schedule from `draft` to `published`.

If the database schema separates `shifts` and `shift_assignments`, use that structure correctly.

---

## Employee Schedule View

Current endpoints:

```http
GET /schedule/my
GET /employees/me/schedule
```

Update them to read from PostgreSQL.

They should return shifts from the latest published schedule for the authenticated employee.

The authenticated employee should only see their own shifts.

---

## Shift Exchange Requests

Current endpoints:

```http
POST /schedule/exchange-requests
GET /schedule/exchange-requests
PATCH /schedule/exchange-requests/{exchange_request_id}
```

Update them to use PostgreSQL if the schema supports exchange requests.

Employee request format:

```json
{
  "shift_id": 1,
  "note": "Need a swap"
}
```

Manager update format:

```json
{
  "status": "approved"
}
```

Preserve current behavior:

* employees can create requests only for their own shifts
* manager sees pending requests
* manager can approve or reject requests
* exchange approval does not need to automatically reassign shifts yet, unless already implemented

If the database schema does not include exchange requests, add a minimal table to `schema.sql` or document that this feature still uses memory temporarily. Prefer adding a table so the feature is persistent.

---

## Notifications

If notifications are already implemented in the backend, persist them in PostgreSQL.

Current expected endpoints may include:

```http
GET /notifications
PATCH /notifications/{notification_id}/read
```

Expected behavior:

* user gets their unread notifications
* user can mark notification as read
* notifications are created when a schedule is published
* notifications are created when an exchange request is approved or rejected

If notifications are not present in the current backend version, do not add unnecessary complexity.
But if they exist in the code, make them database-backed.

---

## Reports

Current endpoint:

```http
GET /reports/employees
```

Optional query params:

```text
start_date
end_date
```

Update reports to calculate from PostgreSQL published shifts only.

Report should calculate:

* `total_shifts`
* `total_hours`

Only published schedules should be included.

The report must not use mock in-memory data anymore.

---

# Validation and Error Handling

Preserve normalized `422` validation error format:

```json
{
  "detail": [
    {
      "field": "payload_or_query_field",
      "message": "human-readable validation message"
    }
  ]
}
```

Preserve business error format:

```json
{
  "detail": "human-readable message"
}
```

Do not expose raw SQLAlchemy errors or PostgreSQL errors to API users.

Use clear HTTP exceptions.

Examples:

* user not found
* employee not found
* schedule not found
* shift not found
* invalid role
* duplicate email
* invalid exchange request status

---

# Seed Data Requirements

Make sure local development still has usable demo data.

Seeded demo data should allow this flow:

1. Login as manager:

```text
manager@example.com / manager123
```

2. Login as employee:

```text
ivan@example.com / employee123
```

3. Use the manager account to create requirements and generate a schedule.
4. Publish the schedule.
5. Use the employee account to view personal schedule.
6. Create an exchange request.
7. Approve/reject it as manager.
8. Check reports.

If `seed.sql` currently inserts users, ensure passwords are hashed correctly.

If generating password hashes inside SQL is inconvenient, create a small documented helper script or move user seeding into a Python startup/dev script.

Do not store plain text passwords in the database.

---

# Environment and Docker Requirements

Update `.env.example` with database settings:

```env
DATABASE_URL=postgresql+psycopg2://shiftplanner_user:shiftplanner_password@localhost:5432/shiftplanner
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Check `backend/docker-compose.yml`.

Make sure PostgreSQL service exposes the correct port and has matching credentials.

Document how to run:

```bash
docker compose -f backend/docker-compose.yml up -d
```

Then apply schema and seed:

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

Then run backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

---

# Testing Requirements

Add or update tests for PostgreSQL-backed behavior.

If the current project has tests, update them.

If not, create basic smoke tests.

At minimum verify:

## Auth

* manager login works
* employee login works
* invalid login fails
* protected route without token returns `401`
* employee accessing manager-only route returns `403`
* logout invalidates token

## Companies

* manager can create company
* authenticated user can list companies

## Positions

* manager can create position
* authenticated user can list positions

## Employees

* manager can create employee
* users can list employees according to current API behavior

## Availability

* manager can set employee availability
* employee can set own availability
* employee cannot set another employee availability

## Requirements

* manager can create requirement
* requirements can be filtered by date range

## Schedule

* manager can generate schedule
* generated schedule is saved in PostgreSQL
* schedule can be fetched by ID
* shift can be reassigned
* shift can be removed
* schedule can be published

## Employee Schedule

* employee can view own published shifts
* employee cannot see another employee's private schedule

## Exchange Requests

* employee can create exchange request
* manager can list pending exchange requests
* manager can approve/reject request

## Reports

* reports use only published shifts
* reports calculate total shifts
* reports calculate total hours
* date filters work

---

# Manual Verification Flow

After implementation, verify manually through Swagger UI:

```text
http://localhost:8000/docs
```

Recommended flow:

1. Start PostgreSQL.
2. Apply `schema.sql`.
3. Apply `seed.sql`.
4. Start FastAPI backend.
5. Open Swagger.
6. Login as manager.
7. Authorize with the returned bearer token.
8. Create or verify position.
9. Create or verify employee.
10. Set employee availability.
11. Create schedule requirement.
12. Generate schedule.
13. Fetch generated schedule by ID.
14. Publish schedule.
15. Logout manager.
16. Login as employee.
17. Authorize as employee.
18. Open `/schedule/my`.
19. Create shift exchange request.
20. Login again as manager.
21. Approve or reject exchange request.
22. Open `/reports/employees`.
23. Restart backend.
24. Confirm previously created database data still exists.

---

# Documentation Requirements

Update `backend/README.md`.

The README should clearly explain:

* backend now uses PostgreSQL
* how to start PostgreSQL
* how to apply schema
* how to apply seed data
* how to configure `.env`
* how to run backend
* how to login with demo users
* which data is persistent
* which limitations still exist

Update the architecture section from:

```text
HTTP request
  -> API router
  -> auth / RBAC dependency
  -> service layer
  -> MockDatabase
  -> response schema
```

to something like:

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

Also update the limitations section.

Remove or update statements like:

```text
All data is reset on process restart.
no PostgreSQL integration
no persistent storage
```

Only keep limitations that are still true, for example:

* no real advanced schedule generation algorithm
* no refresh tokens
* no real multi-tenant isolation, if still true
* no automated reassignment after exchange approval, if still true
* no background jobs or realtime notifications, if still true

---

# Implementation Constraints

Important constraints:

* Do not break existing route paths unless absolutely necessary.
* Do not remove existing Pydantic response schemas unless replacing them with compatible versions.
* Do not put DB logic directly inside routers.
* Do not store passwords as plain text.
* Do not expose raw database errors to API users.
* Do not rewrite the whole backend from scratch.
* Keep the implementation simple and maintainable.
* Prefer small focused changes over large unrelated refactors.
* Keep mock schedule generation simple for now.
* PostgreSQL persistence is the main goal of this stage.

---

# Expected Deliverables

After completing the task, provide a summary with:

1. What files were added.
2. What files were changed.
3. How the backend now connects to PostgreSQL.
4. Which former in-memory features are now persistent.
5. Which features still remain mock/simple.
6. How to run the database.
7. How to apply schema and seed data.
8. How to run the backend.
9. How to test the main demo flow.
10. Any known limitations or follow-up tasks.

Also run and report verification results, for example:

```bash
python -m compileall app
```

and, if tests exist:

```bash
pytest
```

If full tests cannot be run, explain exactly why and what was manually verified instead.
