# ShiftPlanner Database

PostgreSQL database schema for ShiftPlanner MVP.

## Purpose

This database stores the main entities required for automatic shift scheduling:

- companies
- branches
- users
- positions
- employees
- employee availability
- absences
- shift requirements
- generated shifts
- shift assignments

## Files

- `schema.sql` — creates database tables.
- `seed.sql` — inserts demo data for local testing.
- `README.md` — explains how to run and test the database.

## Run PostgreSQL

From the project root:

```bash
docker compose -f backend/docker-compose.yml up -d
```

## Apply schema

PowerShell:

```powershell
Get-Content backend/db/schema.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Git Bash / Linux / macOS:

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/schema.sql
```

## Apply seed data

PowerShell:

```powershell
Get-Content backend/db/seed.sql | docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Git Bash / Linux / macOS:

```bash
docker exec -i shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner < backend/db/seed.sql
```

## Check tables

```bash
docker exec -it shiftplanner_postgres psql -U shiftplanner_user -d shiftplanner
```

Inside `psql`:

```sql
\dt
```

Exit from `psql`:

```sql
\q
```

## Check demo data

```sql
SELECT * FROM companies;
SELECT * FROM users;
SELECT * FROM employees;
```

## Why seed.sql exists

`seed.sql` is used only for local development and testing.

It helps developers quickly create demo data without using the app interface manually every time.

Real user data will not be written through `seed.sql`.

In the actual application flow:

1. A user enters data in the web or mobile app.
2. The frontend sends a request to the backend API.
3. The backend validates the data.
4. The backend saves it into PostgreSQL using SQL queries or an ORM.
5. The app reads the saved data from PostgreSQL through the backend API.

Example flow:

```text
Manager creates a company in the app
        ↓
Frontend sends POST /companies
        ↓
Backend receives company name
        ↓
Backend inserts data into companies table
        ↓
PostgreSQL stores the company
```

Example SQL query for creating a company:

```sql
INSERT INTO companies (name, invite_code)
VALUES ('Coffee Bar Barnaul', 'COFFEE123');
```

Example SQL query for saving employee availability:

```sql
INSERT INTO employee_availability (employee_id, day_of_week, start_time, end_time)
VALUES (1, 1, '10:00', '18:00');
```

## Stop PostgreSQL

```bash
docker compose -f backend/docker-compose.yml down
```

## Stop PostgreSQL and remove local database data

Use this only if you want to fully reset the local database:

```bash
docker compose -f backend/docker-compose.yml down -v
```
