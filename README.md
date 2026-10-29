# SynCura

Bangladesh healthcare platform. React (Vite) frontend, Laravel API backend, and a
small Flask service for AI features, sharing one MySQL database.

## Running on a new PC

### Prerequisites

Install these first (all free):

- **PHP 8.2+** and **MySQL** — easiest via [XAMPP](https://www.apachefriends.org/), which installs both. If you install PHP/MySQL some other way, that's fine too — the scripts below look for `php`/`mysql` on your PATH before falling back to `C:\xampp`.
- **Composer** — https://getcomposer.org/download/
- **Node.js 18+** (includes npm) — https://nodejs.org/
- **Python 3.10+** — https://www.python.org/ (only needed for the AI service; everything else works without it)

If you're using XAMPP, start it and make sure **MySQL** is running (Apache is not needed — Laravel and Vite run their own dev servers).

### First-time setup

From the project root:

```
setup.bat
```

This installs backend/frontend dependencies, creates `backend/.env` and
`frontend/.env` from their `.env.example` files, creates the `syncura` MySQL
database and imports `database/syncura.sql` + `database/syncura_auth.sql`,
runs Laravel's migrations, and builds the AI service's Python virtual
environment. It's safe to re-run — it skips steps that are already done.

### Every time you want to run the app

```
run.bat
```

This starts MySQL (if needed), the AI service (`http://127.0.0.1:5000`), the
Laravel backend (`http://127.0.0.1:8000`), and the React frontend
(`http://localhost:5173`), then opens the app in your browser. Each service
runs in its own window — close a window to stop that service.

## Project layout

- `backend/` — Laravel API (`backend/.env` configures it; see `.env.example`)
- `frontend/` — React + Vite SPA (`frontend/.env` configures it; see `.env.example`)
- `ai-service/` — Flask ML service used by AI Consultation
- `database/` — SQL dumps for the core schema (imported by `setup.bat`)
- `js/`, `pages/`, `css/`, `api/`, `config/` — the original pre-migration PHP app, kept for reference (see `MIGRATION_MAP.md`)
