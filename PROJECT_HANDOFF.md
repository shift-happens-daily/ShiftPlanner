# ShiftPlanner project handoff

Last checked: 2026-06-29
Workspace: `/Users/vika/ShiftPlanner`
Current branch: `mobile-android`
Remote: `origin https://github.com/shift-happens-daily/ShiftPlanner.git`

## Product summary

ShiftPlanner is a staff scheduling app. The backend owns companies, branches,
positions, employees, imports, schedule generation, reports, and JWT auth. The
mobile clients are being built separately for Android and iOS.

User roles:

- `manager`: company/employee/requirement/schedule management flow.
- `employee`: availability/schedule/profile flow.

## Current repo state

The working tree is not clean. Important current changes:

- Android auth/backend integration is in progress on `mobile-android`.
- Root `docker-compose.yml` exists in the working tree.
- `backend/` exists in the working tree and contains the FastAPI app, DB schema,
  seed data, tests, and a local `venv`; it is currently untracked by git in this
  checkout.
- Several local/generated folders are also untracked: `.DS_Store`, `.idea/`,
  `.derivedData*`, `mobile/android/.idea/`, `mobile/ios/.../.derivedData/`.
  These should normally not be committed.

Verified command:

```sh
cd /Users/vika/ShiftPlanner/mobile/android
./gradlew :app:assembleDebug
```

Result: `BUILD SUCCESSFUL` on 2026-06-29.

## Backend

Backend path: `backend/`

Stack:

- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- JWT auth via `python-jose`
- schedule solving via `ortools`
- Excel import support via `openpyxl`

Main entrypoint:

- `backend/app/main.py`

Routers:

- `/auth`
- `/companies`
- `/positions`
- `/employees`
- `/imports`
- `/schedule`
- `/reports`
- `/health`
- `/health/db`

Auth contracts:

- `POST /auth/login`
  - request: `{ "email": string, "password": string }`
  - response: `{ "access_token": string, "token_type": string, "role": "manager" | "employee" }`
- `POST /auth/register`
  - request: `{ "full_name": string, "email": string, "password": string, "role": "manager" | "employee" }`
  - password min length is 8 on backend.
- `GET /auth/me`
  - requires `Authorization: Bearer <token>`
  - returns user profile plus optional company/branch/position data.
- `POST /auth/logout`
  - requires bearer token.
- `DELETE /auth/me`
  - deletes current employee account; protected.

Local Docker startup:

```sh
cd /Users/vika/ShiftPlanner
docker compose up --build
```

Expected local URLs:

- Backend: `http://localhost:8000`
- Swagger/OpenAPI: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- Postgres: `localhost:5432`

The root compose file starts `postgres` and `backend`. It mounts:

- `backend/db/schema.sql`
- `backend/db/seed.sql`

Reset DB from schema/seed:

```sh
docker compose down -v
docker compose up --build
```

Known compose caveat from earlier work: older backend-local compose setups may
also use container name `shiftplanner_postgres`. If Docker reports that this
container name is already in use, clean up the old stack/container before
starting the root stack.

## Android client

Android path: `mobile/android/`

Stack:

- Kotlin
- Jetpack Compose
- Material 3
- Retrofit + Gson
- OkHttp logging interceptor
- AndroidX DataStore preferences
- Navigation Compose dependency is present, but current shell uses simple local
  tab state rather than full route navigation.

Current backend integration:

- `MainActivity.kt` now creates `AppContainer(applicationContext)`.
- `AppContainer.kt` wires:
  - `TokenStore`
  - `ApiClient`
  - `ApiAuthRepository`
- `AuthViewModel` uses the real repository instead of `MockAuthRepository`.
- `AuthViewModel` restores session on init via `repository.getCurrentUser()`.
- `TokenStore` persists `access_token` in DataStore.
- `ApiClient` injects `Authorization: Bearer <token>` when a token exists.
- `ShiftPlannerApi` currently includes auth endpoints only:
  - login
  - register
  - get current user
  - logout
  - delete current account

Android base URL:

```kotlin
const val DEFAULT_BASE_URL = "http://10.0.2.2:8000/"
```

This is correct for Android Emulator talking to backend on the host machine.

Important runtime check: the app uses plain HTTP. `AndroidManifest.xml` has
`INTERNET`, but does not currently set `android:usesCleartextTraffic="true"` or
a network security config. The debug APK builds, but login/register should be
tested on an emulator because HTTP may be blocked at runtime on modern Android.

Current Android UI state:

- If no user is authenticated, show auth screens.
- If authenticated:
  - manager sees placeholder tabs:
    - Company
    - Employees
    - Requirements
    - Schedule
    - Profile
  - employee sees placeholder tabs:
    - Availability
    - Schedule
    - Profile
- These post-login screens are placeholders in `presentation/AppRoot.kt`.

Current Android next tasks:

1. Run backend via root Docker compose and test login/register on Android
   Emulator.
2. If HTTP is blocked, add debug-safe cleartext config for `10.0.2.2`.
3. Add Retrofit APIs and repositories for company, employees, positions,
   availability/requirements, schedule, reports/imports as needed.
4. Replace placeholder manager/employee shell screens with real screens.
5. Align Android validation with backend password min length 8.
6. Decide whether `MockAuthRepository` remains for previews/tests or is removed.

## iOS client

iOS path: `mobile/ios/ShiftPlanner/`

Current iOS state in this checkout:

- SwiftUI app.
- Auth flow exists with:
  - `RootView`
  - `LoginView`
  - `SignUpView`
  - `AuthViewModel`
  - `AuthRepository` protocol
  - `MockAuthRepository`
- `RootView` currently instantiates `AuthViewModel(repository: MockAuthRepository())`.
- `MainView` is a simple logged-in placeholder showing welcome/email/role and
  logout.
- `AppUser` only has `id`, `email`, `name`, and `role`.

iOS backend integration status:

- In the current `mobile-android` checkout, iOS is still mock-backed.
- There is no current `APIClient.swift` or concrete API auth repository under
  `mobile/ios/ShiftPlanner/ShiftPlanner/`.
- Prior project context indicates an iOS networking fix existed around a
  `Shared/Networking/APIClient.swift` defaulting Simulator to
  `http://127.0.0.1:8000`, but that file is not present in this checkout. Check
  the iOS branch/history before assuming it exists.

Expected iOS local backend host:

- iPhone Simulator should use `http://127.0.0.1:8000`.
- Physical iPhone should use the Mac LAN IP or another reachable backend host.

Current iOS next tasks:

1. Confirm whether iOS backend integration exists on another branch.
2. If not, create a real API auth repository implementing `AuthRepository`.
3. Add URLSession-based client with bearer token storage.
4. Decode backend snake_case auth/profile payloads.
5. Restore session on launch via `/auth/me`.
6. Expand `AppUser` to include optional `employeeId`, company, branch, and
   position if the iOS app needs the same role-aware flows as Android.

## Integration notes for the next agent

- Backend role values are lowercase strings: `manager`, `employee`.
- Android maps them to enum values with `@SerializedName`.
- Backend returns snake_case fields such as `access_token`, `full_name`, and
  `employee_id`.
- Native mobile clients do not need CORS, but web/frontend does.
- Android Emulator host alias is `10.0.2.2`; iOS Simulator can use `127.0.0.1`.
- Backend `/auth/register` requires password length at least 8. iOS mock
  currently checks only 6 characters, so that will diverge when wired to backend.

## Suggested handoff prompt

Use this when starting a new agent:

```text
You are taking over ShiftPlanner in /Users/vika/ShiftPlanner on branch
mobile-android. Read PROJECT_HANDOFF.md first, then inspect git status. The
current work is Android backend auth integration against the local FastAPI
backend. Android debug build currently succeeds, but runtime login/register on
emulator still needs verification, especially HTTP cleartext to
http://10.0.2.2:8000/. iOS in this checkout is still mock-backed; do not assume
iOS networking exists here unless you find it on another branch. Backend and
root docker-compose are present in the working tree but currently untracked, so
handle git staging carefully and do not commit generated folders or local venvs.
```
