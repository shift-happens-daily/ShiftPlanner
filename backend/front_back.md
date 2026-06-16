Вот промпт для Codex на этап **интеграции frontend ↔ backend**. Его можно вставлять целиком.

You are working on the ShiftPlanner project.

The project has:

1. A React + Vite frontend.
2. A FastAPI + PostgreSQL backend.

Your task is to integrate the existing frontend with the real backend API.

Do not rewrite the frontend from scratch.
Do not redesign the backend.
Do not implement advanced scheduling algorithms.
Do not add unrelated UI redesign.

Focus on replacing mocked frontend state/data with real backend API calls.

---

# Project Context

## Frontend

The frontend is located in:

```text
frontend/
```

Stack:

* React 19
* Vite
* React Router DOM
* Axios
* date-fns
* xlsx

Current frontend state:

* `frontend/src/context/AuthContext.jsx` currently mocks login, register, and logout.
* `frontend/src/services/` is empty and should contain API wrappers.
* Auth page and role-based dashboard routes already exist.
* Employee and manager dashboards exist.
* Many screens currently use hard-coded mock data.
* The app supports role-based pages:

  * `/employee`
  * `/manager`

Frontend environment variable:

```env
VITE_API_URL=http://localhost:8000
```

The frontend should use this as the backend base URL.

Run frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend local URL:

```text
http://localhost:5173
```

---

## Backend

The backend is located in:

```text
backend/
```

Stack:

* FastAPI
* PostgreSQL
* SQLAlchemy 2.x
* Pydantic
* JWT auth
* RBAC
* invite-based company joining
* absences
* reports
* XLSX import for schedule requirements

Backend local URL:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

Backend environment example:

```env
DATABASE_URL=postgresql+psycopg://shiftplanner_user:shiftplanner_password@localhost:5432/shiftplanner
FRONTEND_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Backend demo accounts after applying seed:

```text
manager@example.com / manager123
ivan@example.com / employee123
```

Seeded company:

```text
company: Coffee Bar Barnaul
invite code: COFFEE123
branch: Main Branch
positions: Barista, Cashier
```

---

# Main Integration Goal

Connect the frontend to the backend API.

Replace mock auth and mock data with real API calls.

The frontend must:

1. Login/register through backend.
2. Store bearer token.
3. Attach token to protected requests.
4. Load current user profile from `GET /auth/me`.
5. Route users based on backend role.
6. Display real company/profile data.
7. Support invite-code company joining.
8. Display and edit availability and absences.
9. Display employee shifts and calendar summary.
10. Allow manager to view employees, requirements, schedules, reports.
11. Allow manager to create bulk requirements.
12. Allow manager to import schedule requirements from XLSX.
13. Handle 401/403/errors cleanly.

---

# Important Backend Contract

## Auth

Backend endpoints:

```http
POST /auth/login
POST /auth/token
POST /auth/register
GET /auth/me
POST /auth/logout
```

Frontend should use:

```http
POST /auth/login
```

for normal app login.

Request:

```json
{
  "email": "manager@example.com",
  "password": "manager123"
}
```

Response:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "role": "manager"
}
```

After login, frontend must call:

```http
GET /auth/me
```

with:

```text
Authorization: Bearer <token>
```

`/auth/me` returns full user context:

```json
{
  "id": 1,
  "full_name": "Ivan Barista",
  "email": "ivan@example.com",
  "role": "employee",
  "employee_id": 1,
  "company": {
    "id": 1,
    "name": "Coffee Bar Barnaul",
    "invite_code": "COFFEE123"
  },
  "branch": {
    "id": 1,
    "name": "Main Branch"
  },
  "position": {
    "id": 1,
    "name": "Barista"
  }
}
```

Important:

* Do not try to extract profile information from the JWT token.
* JWT is only for authentication and authorization.
* Use `/auth/me` as the source of truth for user data.

---

# Task 1: Inspect Frontend First

Before making changes, inspect:

```text
frontend/src/
frontend/src/context/AuthContext.jsx
frontend/src/pages/
frontend/src/components/
frontend/src/routes/
frontend/src/services/
frontend/package.json
frontend/.env or .env.example if present
```

Find:

* where login/register are implemented
* how role routing works
* where mock user data is stored
* where employees mock data is used
* where schedule mock data is used
* where reports mock data is used
* where profile/company data is displayed
* where XLSX import UI exists, if any

Do not make blind changes.

---

# Task 2: Add API Service Layer

Create a clean API service layer.

Suggested files:

```text
frontend/src/services/api.js
frontend/src/services/authService.js
frontend/src/services/companyService.js
frontend/src/services/employeeService.js
frontend/src/services/scheduleService.js
frontend/src/services/reportService.js
frontend/src/services/importService.js
```

At minimum, create `api.js` with Axios instance.

`api.js` should:

* read base URL from `import.meta.env.VITE_API_URL`
* default to `http://localhost:8000` if env var is missing
* attach `Authorization: Bearer <token>` to requests if token exists
* handle `401` globally by clearing auth state or exposing the error clearly
* avoid duplicating axios configuration in components

Example idea:

```js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("shiftplanner_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

If the project already has a different storage key, use the existing one consistently.

---

# Task 3: Replace Mock AuthContext With Real Backend Auth

Update:

```text
frontend/src/context/AuthContext.jsx
```

Current mock login/register/logout must be replaced with real API calls.

AuthContext should provide:

```js
user
token
role
employeeId
isAuthenticated
isLoading
login(email, password)
register(payload)
logout()
refreshUser()
```

Behavior:

## Login

1. Call:

```http
POST /auth/login
```

with:

```json
{
  "email": "...",
  "password": "..."
}
```

2. Save `access_token` in localStorage.
3. Call `GET /auth/me`.
4. Store returned profile in context.
5. Redirect based on role:

   * manager -> `/manager`
   * employee -> `/employee`

## Register

Backend register expects `full_name`, not necessarily `name`.

The current frontend may use `name`.

Map frontend payload correctly:

Frontend form may have:

```js
{
  name,
  email,
  password,
  role
}
```

Backend expects:

```json
{
  "full_name": "Anna Petrova",
  "email": "anna@example.com",
  "password": "employee123",
  "role": "employee"
}
```

If backend `/auth/register` does not return token, after successful register either:

* automatically login using email/password, or
* redirect to login page with success message.

Prefer automatic login if it works cleanly.

## Logout

1. Try to call:

```http
POST /auth/logout
```

2. Clear local token and user state even if backend logout fails.
3. Redirect to auth/login page.

Important backend limitation:

* active token set is in memory
* after backend restart, old tokens become invalid
* frontend must handle `401` by clearing local token and asking user to login again

## Initial load

On app startup:

1. Read token from localStorage.
2. If token exists, call `GET /auth/me`.
3. If success, restore user.
4. If fails with 401, clear token and user.

---

# Task 4: Fix Role-Based Routing

Use backend `/auth/me` response as source of truth.

Rules:

* If no user/token -> show auth page or redirect to login.
* If user.role === "manager" -> allow manager dashboard.
* If user.role === "employee" -> allow employee dashboard.
* If employee has no company yet -> show company invite/join flow or profile page state.
* Prevent employee from opening manager-only pages.
* Prevent manager from opening employee-only pages unless existing UX intentionally allows it.

Do not rely on mocked role in localStorage.

---

# Task 5: Implement Company Invite Flow In Frontend

Backend endpoints:

```http
GET /companies/invite/{invite_code}
POST /companies/join
GET /auth/me
```

Add or integrate UI for invite flow.

Expected flow:

1. User logs in or registers.
2. User enters invite code.
3. Frontend calls:

```http
GET /companies/invite/COFFEE123
```

4. Show:

   * company name
   * branches
   * positions
5. User chooses branch and position.
6. Frontend calls:

```http
POST /companies/join
```

Request:

```json
{
  "invite_code": "COFFEE123",
  "branch_id": 1,
  "position_id": 1
}
```

7. Call `GET /auth/me` again.
8. Update AuthContext user.

Manager join is rejected by backend with `403`.

Handle:

* invalid invite code -> show user-friendly error
* manager trying to join -> show meaningful error
* missing branch/position -> validation message
* backend 401 -> logout / ask to login again

---

# Task 6: Connect Profile And Company Screens

Replace mock profile/company info with `/auth/me`.

Display:

* full name
* email
* role
* employee_id if exists
* company name
* invite code if visible
* branch name
* position name

For employee:

* show joined company and position
* if no company, show invite code join flow

For manager:

* show role and account info
* show available companies through:

```http
GET /companies/
```

If current backend does not link manager to company, do not fake it. Show what backend returns.

---

# Task 7: Connect Employees Screen For Manager

Backend endpoints:

```http
GET /employees/
POST /employees/
GET /employees/{employee_id}/availability
POST /employees/{employee_id}/availability
GET /employees/{employee_id}/absences
POST /employees/{employee_id}/absences
DELETE /employees/{employee_id}/absences/{absence_id}
GET /employees/{employee_id}/calendar-summary
```

Manager dashboard should use real employees from:

```http
GET /employees/
```

For each employee, display as much as available:

* id
* full name
* email if returned
* position
* availability
* absences
* workload if available from calendar summary or reports

Create employee form should call:

```http
POST /employees/
```

Availability form should call:

```http
POST /employees/{employee_id}/availability
```

Absence form should call:

```http
POST /employees/{employee_id}/absences
```

Delete absence should call:

```http
DELETE /employees/{employee_id}/absences/{absence_id}
```

Do not keep using hard-coded employee lists.

If response field names differ from current UI expectations, add small mapper functions in service layer rather than spreading mapping logic across components.

---

# Task 8: Connect Employee Self Screens

For employee dashboard, use:

```http
GET /auth/me
GET /employees/me/calendar-summary
GET /employees/me/absences
POST /employees/me/absences
GET /employees/me/schedule
GET /schedule/my
GET /reports/me
```

Employee should see:

* profile
* company
* position
* own availability if available through calendar summary
* own absences
* own published shifts
* own workload report

Employee should be able to:

* create own absence
* view own schedule
* create shift exchange request for own shift if UI exists

For shift exchange request:

```http
POST /schedule/exchange-requests
```

Request:

```json
{
  "shift_id": 1,
  "note": "Need a swap"
}
```

Handle backend errors if the shift does not belong to the employee.

---

# Task 9: Connect Schedule Requirements UI

Backend endpoints:

```http
GET /schedule/requirements
POST /schedule/requirements
POST /schedule/requirements/bulk
```

Manager should be able to:

1. View requirements by date range.
2. Create single requirement.
3. Create bulk requirements for period and weekdays.

Single requirement request:

```json
{
  "position_id": 1,
  "date": "2026-06-15",
  "min_staff": 2,
  "start_time": "10:00:00",
  "end_time": "18:00:00"
}
```

Bulk request:

```json
{
  "start_date": "2026-06-15",
  "end_date": "2026-06-21",
  "weekdays": [0, 1, 2, 3, 4],
  "requirements": [
    {
      "position_id": 1,
      "min_staff": 2,
      "start_time": "10:00:00",
      "end_time": "18:00:00"
    }
  ]
}
```

Make sure frontend weekday numbering matches backend:

```text
0 = Monday
6 = Sunday
```

Do not implement scheduling algorithm frontend-side.

---

# Task 10: Connect Schedule Generation And Publishing

Backend endpoints:

```http
POST /schedule/generate
GET /schedule/{schedule_id}
PATCH /schedule/{schedule_id}/shifts/{shift_id}
POST /schedule/{schedule_id}/publish
GET /schedule/my
GET /employees/me/schedule
```

Manager flow:

1. Create or load requirements.
2. Call:

```http
POST /schedule/generate
```

Request:

```json
{
  "start_date": "2026-06-15",
  "end_date": "2026-06-21"
}
```

3. Display returned schedule/shifts.
4. Allow publish:

```http
POST /schedule/{schedule_id}/publish
```

5. If UI supports it, allow reassign/remove shift:

```http
PATCH /schedule/{schedule_id}/shifts/{shift_id}
```

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

Employee flow:

* show published personal shifts through:

```http
GET /schedule/my
```

or:

```http
GET /employees/me/schedule
```

---

# Task 11: Connect Reports

Backend endpoints:

```http
GET /reports/employees
GET /reports/me
```

Manager reports screen:

```http
GET /reports/employees?start_date=2026-06-01&end_date=2026-06-30
```

Employee reports/self workload screen:

```http
GET /reports/me?start_date=2026-06-01&end_date=2026-06-30
```

Display:

* employee name
* position if returned
* total shifts
* total hours

Make sure reports count only published shifts because this is backend behavior.

Do not calculate official report totals in frontend if backend already returns them.

---

# Task 12: Connect XLSX Import For Requirements

Backend endpoint:

```http
POST /imports/requirements/xlsx
```

Method:

* multipart/form-data
* field name: `file`

Expected columns:

```text
date
position_id
start_time
end_time
min_staff
```

Frontend behavior:

1. Manager selects `.xlsx` file.
2. Frontend sends it using `FormData`.
3. Backend returns:

```json
{
  "created_count": 5,
  "errors": []
}
```

4. Show created count.
5. Show row-level errors if present.
6. Refresh requirements list.

If there is already a frontend xlsx parser, do not duplicate backend import logic. Prefer sending the file to backend. Frontend can only validate file extension and show preview if already implemented.

---

# Task 13: Error Handling

Implement consistent user-friendly error handling.

Handle:

* `401 Unauthorized`

  * token expired/invalid/backend restarted
  * clear token and redirect to login
* `403 Forbidden`

  * show “You do not have permission for this action”
* `404 Not Found`

  * show entity-specific message, for example invalid invite code
* `422 Validation Error`

  * backend returns normalized validation errors
  * display field-level or general messages
* network error

  * show “Backend is unavailable”

Do not crash UI on failed requests.

Avoid raw `[object Object]` errors.

Add helper function to extract API error message from Axios error.

---

# Task 14: Data Mapping

Frontend and backend names may differ.

Carefully map fields.

Examples:

Frontend may use:

```js
name
```

Backend register expects:

```js
full_name
```

Backend position may return:

```js
name
```

but old frontend may expect:

```js
title
```

Backend requirements may use:

```js
date
min_staff
```

or database-shaped fields like:

```js
shift_date
required_employees
```

Inspect actual API responses through Swagger or existing schemas.

Add mapper functions if needed.

Do not scatter one-off transformations across components.

Suggested file:

```text
frontend/src/services/mappers.js
```

---

# Task 15: Remove Mock Data Carefully

Replace mock usage gradually.

Search for mock data:

```bash
grep -R "mock" frontend/src
grep -R "Mock" frontend/src
grep -R "hard-coded" frontend/src
```

PowerShell:

```powershell
Select-String -Path frontend/src/**/*.jsx -Pattern "mock"
Select-String -Path frontend/src/**/*.js -Pattern "mock"
```

For each screen:

* replace mock with API call
* keep temporary fallback only if necessary
* clearly mark any remaining mock as TODO
* do not delete UI components just because they use mock data
* preserve current layout and styling as much as possible

---

# Task 16: Loading States

Add loading and empty states where API data is fetched.

Each page should handle:

* loading
* error
* empty data
* success data

Examples:

* no company joined yet
* no absences yet
* no shifts yet
* no reports for selected period
* no requirements yet

Do not leave blank screens.

---

# Task 17: Validation In Forms

Add basic frontend validation before API calls:

* required email/password
* required invite code
* required date range
* end date >= start date
* weekday values
* min staff > 0
* file must be `.xlsx`
* absence end date >= start date

Backend remains source of truth, but frontend should prevent obvious invalid requests.

---

# Task 18: Keep CORS Compatibility

Backend expects:

```env
FRONTEND_ORIGINS=http://localhost:5173
```

Make sure frontend runs on:

```text
http://localhost:5173
```

If API calls fail because of CORS:

* check backend `.env`
* check frontend `VITE_API_URL`
* do not work around CORS by disabling browser security
* document the fix

---

# Task 19: Manual End-to-End Flow To Support

After integration, this full flow should work through the UI:

## Manager flow

1. Open frontend.
2. Login as:

```text
manager@example.com / manager123
```

3. Manager dashboard opens.
4. Profile shows manager info from `/auth/me`.
5. Company page loads companies.
6. Employees page loads employees from backend.
7. Manager creates or views employee absence.
8. Manager creates bulk schedule requirements.
9. Manager generates schedule.
10. Manager publishes schedule.
11. Manager opens reports and sees published workload.

## Employee flow

1. Logout manager.
2. Login as:

```text
ivan@example.com / employee123
```

3. Employee dashboard opens.
4. Profile shows employee info from `/auth/me`.
5. Company page shows `Coffee Bar Barnaul`, `Main Branch`, `Barista`.
6. Employee opens schedule and sees own published shifts.
7. Employee creates own absence.
8. Employee opens calendar summary.
9. Employee opens own report.

## Invite flow

1. Register a new employee.
2. Enter invite code:

```text
COFFEE123
```

3. Preview company info.
4. Choose branch and position.
5. Join company.
6. `/auth/me` refreshes.
7. UI now shows joined company and selected position.

---

# Task 20: Tests / Verification

After implementation, run:

```bash
cd frontend
npm install
npm run build
```

If the project has lint:

```bash
npm run lint
```

If tests exist:

```bash
npm test
```

Also run backend separately:

```bash
cd backend
python -m compileall app
python -m pytest
uvicorn app.main:app --reload
```

Run PostgreSQL:

```bash
docker compose -f backend/docker-compose.yml up -d
```

Manual test both apps together:

* backend at `http://localhost:8000`
* frontend at `http://localhost:5173`

---

# Task 21: README Update

Update `frontend/README.md`.

Document:

* how to configure `VITE_API_URL`
* how to run frontend
* required backend URL
* login demo accounts
* what pages are integrated
* what data is still mock, if any
* known limitations

If any mock data remains, explicitly list it.

Do not claim full integration if some screens are still mocked.

---

# Do Not Do

Do not:

* rewrite the app from scratch
* redesign all UI
* implement backend algorithms
* change backend route paths without strong reason
* store passwords in frontend
* store full user profile as a replacement for backend `/auth/me`
* decode JWT to get business data
* ignore 401/403 errors
* leave broken mock references
* hard-code backend URL instead of using `VITE_API_URL`
* commit `.env` with secrets
* add refresh tokens unless backend supports them

---

# Expected Deliverables

After finishing, provide a concise summary:

1. Files added.
2. Files changed.
3. Which mock flows were replaced.
4. How auth now works.
5. How token storage works.
6. How `/auth/me` is used.
7. Which pages are connected to backend.
8. Which endpoints are called by each page.
9. Which mock data remains, if any.
10. How errors are handled.
11. How to run frontend and backend together.
12. Build/test results.
13. Known limitations and follow-up tasks.

Also report exact commands run, for example:

```bash
cd frontend
npm install
npm run build
```

and if applicable:

```bash
npm run lint
```

Manual verification should include:

```text
Manager login -> manager dashboard -> employees -> requirements -> generate -> publish -> reports

Employee login -> employee dashboard -> profile -> company -> schedule -> absences -> calendar summary -> reports/me

New employee register -> invite code preview -> join company -> /auth/me refresh
```
