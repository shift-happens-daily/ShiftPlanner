# ShiftPlanner

<p align="center">
  <img src="pic\v1.svg" width="180" alt="ShiftPlanner Logo">
</p>

<p align="center">
  <strong>Smart employee shift scheduling platform</strong><br>
  Generate schedules in minutes, manage your workforce, and simplify shift planning.
</p>


## About

ShiftPlanner is a workforce scheduling platform designed to simplify employee shift management for businesses such as cafés, restaurants, retail stores, and other service companies.

Instead of manually assigning shifts every week, managers can define staffing requirements, employee availability, and workplace structure. The system then generates a schedule automatically while employees access their shifts through the web and mobile applications.

The project was developed as a university software engineering project following an MVP-first approach.

## Features

### 👨‍💼 Manager

- Company creation and management
- Employee management
- Branch management
- Position management
- Invite employees using invite codes
- Define shift requirements
- Import requirements from Excel (.xlsx)
- Generate schedules automatically
- Publish schedules
- View reports

### 👷 Employee

- Join company via invite code
- Select branch and position
- Set availability
- Request preferred days off
- View assigned shifts
- Access personal reports

### 🔐 Authentication

- JWT authentication
- Role-based authorization
- Secure password hashing

## Tech Stack

| Layer | Technologies |
|--------|--------------|
| **Frontend (Web)** | React |
| **Backend** | Python, FastAPI |
| **Database** | PostgreSQL |
| **Mobile (Android)** | Android Studio, Kotlin, Jetpack Compose |
| **Mobile (iOS)** | Swift |
| **Documentation** | Swagger / OpenAPI |
| **Infrastructure** | Docker, Docker Compose |

## Project Structure

```text
ShiftPlanner/
│
├── .github/     
│
├── backend/                 # FastAPI backend
│   ├── app/                 # Application source code
│   ├── db/                  # Database schema
│   ├── tests/               # Backend tests
│   ├── .env.example
│   ├── db-backend.md 
│   ├── Dockerfile
│   ├── front_back.md
│   ├── requirements.txt
│   ├── test_db.py
│   └── test_solver.py
│
├── frontend/                # React web application
│   ├── public/
│   ├── src/
│   ├── .dockerignore
│   ├── .env.development
│   ├── eslint.config.js
│   ├── index.html
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── vite.config.js
│   └── .env.example
│
├── mobile/
│   ├── android/             
│   ├── ios/           
│   └── README.md
│
├── nginx/                   # Reverse proxy configuration
│   ├── Dockerfile
│   ├── docker-entrypoint.d/
│   ├── renewal-hooks/ 
│   ├── default.conf
│   └── default.http.conf
│
├── pic/                     # Images and project assets
│
├── .gitignore
├── docker-compose.yml
├── docker-compose.override.yml
├── LICENSE
└── README.md
```

## 🚀 Quick Start

ShiftPlanner can be used in two ways:

- **Online:** Visit the production deployment at **https://shiftplanner.online**
- **Locally:** Run the project using Docker Compose.

### 1. Clone the repository

```bash
git clone https://github.com/shift-happens-daily/ShiftPlanner.git
cd ShiftPlanner
```

### 2. Configure environment variables

Create the required environment files from the provided templates:

```text
backend/.env.example  →  backend/.env
frontend/.env.example →  frontend/.env
```

Update the environment variables if necessary (database connection, JWT secret, API URL, etc.).

### 3. Start the application

Run all services with Docker Compose:

```bash
docker compose up --build
```

This will start:

- PostgreSQL database
- FastAPI backend
- React frontend
- Nginx reverse proxy

### 4. Access the application

Once the containers are running, the application will be available at:

| Service | URL |
|---------|-----|
| Web Application | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger Documentation | http://localhost:8000/docs |

### 5. Stop the application

To stop all running containers:

```bash
docker compose down
```

## 🌐 Live Demo

ShiftPlanner is publicly available and can be accessed using the links below.

| Service | Link |
|---------|------|
| 🌍 **Web Application** | https://shiftplanner.online |
| 📱 **Mobile Application** | In progress |

You can explore the application directly in your browser without setting up a local development environment.

## Team

| Name | Role | GitHub Account Link|
|------|------|------|
| Karina Krotova | Team Lead / Product Manager / Database |https://github.com/karmihkr|
| Ksenia Minaeva | Fullstack |https://github.com/ks0Vibe|
| Albina Fadeeva | Scheduling Algorithm | https://github.com/Albiiina |
| Fidan Akhmedova | Frontend | https://github.com/fifidadan | 
| Victoriya Gorbacheva | Mobile Development | https://github.com/froggyriia |

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.