````md
# ShiftPlanner

ShiftPlanner is a web application for shift planning and employee schedule management.

The project includes:

- React + Vite frontend
- FastAPI backend
- PostgreSQL database
- Docker Compose setup for local development
- JWT authentication
- role-based access control for managers and employees
- company creation and invite-code joining
- branch and position management
- employee availability and absences
- schedule requirements
- schedule generation and publishing
- reports
- XLSX import for shift requirements

---

## Project Structure

```text
ShiftPlanner/
  backend/
    app/
    db/
      schema.sql
      seed.sql
    Dockerfile
    requirements.txt
    .env.example

  frontend/
    src/
    Dockerfile
    package.json
    .env.example

  docker-compose.yml
  README.md
````

---

## Tech Stack

### Frontend

* React
* Vite
* React Router DOM
* Axios
* xlsx

### Backend

* Python
* FastAPI
* PostgreSQL
* SQLAlchemy
* Pydantic
* JWT auth with `python-jose`
* password hashing with `passlib` and `bcrypt`
* XLSX processing with `openpyxl`

### Infrastructure

* Docker
* Docker Compose

---

## How To Run The Project

The recommended way is to run the whole project with Docker Compose.

This starts:

* PostgreSQL
* Backend
* Frontend

---

## 1. Clone Repository

```bash
git clone <repo-url>
cd ShiftPlanner
```

---

## 2. Create Environment Files

### Backend

Create `backend/.env` from `backend/.env.example`.

Example:

```env
DATABASE_URL=postgresql+psycopg://shiftplanner_user:shiftplanner_password@postgres:5432/shiftplanner
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

When backend is running inside Docker Compose, the database host should be:

```text
postgres
```

not `localhost`.

### Frontend

Create `frontend/.env` from `frontend/.env.example`.

Example:

```env
VITE_API_URL=http://localhost:8000
```

---

## 3. Run With Docker Compose

From the project root:

```bash
docker compose up --build
```

After startup, the services will be available at:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
Swagger:  http://localhost:8000/docs
Postgres: localhost:5432
```

---

## 4. Run In Background

```bash
docker compose up --build -d
```

View logs:

```bash
docker compose logs -f
```

View logs for one service:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

---

## 5. Stop Project

```bash
docker compose down
```

Stop project and delete database data:

```bash
docker compose down -v
```

Use `down -v` carefully because it removes the PostgreSQL volume.

---

## 6. Reset Database

If the database schema changed, reset the database:

```bash
docker compose down -v
docker compose up --build
```

This recreates PostgreSQL and applies the initialization SQL files again.

If you want to reset the database manually while the PostgreSQL container is running:

```bash
docker exec shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
```

Then apply schema:

### PowerShell

```powershell
Get-Content backend/db/schema.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Apply seed data if demo accounts are needed:

```powershell
Get-Content backend/db/seed.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

### Git Bash / Linux / macOS

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/schema.sql
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/seed.sql
```

---

## Demo Accounts

Demo accounts are available only if `backend/db/seed.sql` was applied.

```text
Manager:
manager@example.com / manager123

Employee:
ivan@example.com / employee123
```

Demo company:

```text
Company: Coffee Bar Barnaul
Invite code: COFFEE123
Branch: Main Branch
Positions: Barista, Cashier
```

If seed data is not applied, create a new manager, company, branch, position, and employee manually through the UI.

---

## Main User Flows

### Manager Flow

1. Register or log in as manager.
2. Create a company.
3. Copy the invite code.
4. Create a branch.
5. Create positions.
6. Add employees or ask employees to join by invite code.
7. Create shift requirements.
8. Generate schedule.
9. Publish schedule.
10. Check reports.

### Employee Flow

1. Register or log in as employee.
2. Open the Company tab.
3. Enter invite code.
4. Choose branch and position.
5. Join company.
6. Fill availability and desired days off.
7. Check personal schedule.
8. Create shift exchange requests if needed.
9. Check personal reports.

---

## Data Source Rules

The backend is the source of truth for company data.

The frontend does not restore company membership from `localStorage`.

Current user data is loaded from:

```text
GET /auth/me
```

For managers:

```text
company is attached through companies.manager_user_id
```

For employees:

```text
company, branch, and position are attached through employees table
```

If `/auth/me` does not return a company, the frontend shows that the user is not attached to a company.

---

## Useful Commands

Check running containers:

```bash
docker ps
```

Check all containers:

```bash
docker ps -a
```

Open PostgreSQL shell:

```bash
docker exec -it shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Check companies:

```sql
SELECT id, name, invite_code, manager_user_id FROM companies ORDER BY id;
```

Exit PostgreSQL:

```sql
\q
```

---

## Local Development Without Full Docker Compose

You can also run only PostgreSQL in Docker and start backend/frontend locally.

### Start PostgreSQL

```bash
docker compose -f backend/docker-compose.yml up -d
```

### Start Backend Locally

```bash
cd backend
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run backend:

```bash
uvicorn app.main:app --reload
```

### Start Frontend Locally

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

---

## Verification

Backend health check:

```text
http://localhost:8000/health
```

Swagger:

```text
http://localhost:8000/docs
```

Frontend:

```text
http://localhost:5173
```

Recommended manual check:

1. Open frontend.
2. Register or log in as manager.
3. Create company.
4. Create branch.
5. Create position.
6. Register or log in as employee.
7. Join company by invite code.
8. Reload the page.
9. Check that company data does not disappear.
10. Create requirements.
11. Generate and publish schedule.
12. Check reports.

---

## Troubleshooting

### Docker is not running

If you see an error like:

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

Start Docker Desktop and wait until Docker Engine is running.

Then run:

```bash
docker compose up --build
```

### Container name conflict

If you see:

```text
The container name "/shiftplanner_postgres" is already in use
```

Remove the old container:

```bash
docker rm -f shiftplanner_postgres
```

Then start again:

```bash
docker compose up --build
```

### Database schema is outdated

Reset the database:

```bash
docker compose down -v
docker compose up --build
```

### Frontend cannot reach backend

Check `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Check that backend is running:

```text
http://localhost:8000/health
```

### Backend cannot reach database

If backend runs inside Docker Compose, `DATABASE_URL` should use:

```text
postgres:5432
```

If backend runs locally, `DATABASE_URL` should use:

```text
localhost:5432
```

---

## Current Limitations

* Schedule generation is intentionally simple.
* Availability and absences are stored but are not fully used by the generation algorithm yet.
* No advanced conflict detection.
* No automatic reassignment after shift exchange approval.
* No refresh tokens.
* Active access tokens are stored in memory and reset after backend restart.

```
```
