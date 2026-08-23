# Crew Bench

A web application for matching sailing crew to boats for racing events.

Crew Bench has **two complementary ways** to connect:

1. **Crew Pool** — general interest in crewing (no specific race required)
2. **Race Events** — availability and invitations for particular races and series

![Home page](docs/images/home.png)

## Features

- **Crew Pool**: Crew register general availability (weekends, Saturdays, date ranges, notes); skippers browse without picking an event
- **Direct messaging**: Skippers can message crew from the Crew Pool; both parties see conversation history under Messages
- **Invite from pool**: Skippers can invite Crew Pool members to a specific event or series (appears in Requests)
- **Crew Pool email alerts**: Skippers can opt in to email when new crew join or re-activate in the pool
- **User Registration**: Register as crew looking for boats or as a skipper with a boat
- **Event Management**: Browse upcoming sailing events, races, and regattas
- **Crew Availability**: Mark yourself available for specific events or an entire series
- **Crew Matching**: Skippers browse available crew for an event and send invitations
- **Request Management**: Accept or decline crew requests (including waitlists)
- **My Schedule**: See confirmed assignments as crew or skipper
- **In-app notifications**: Bell icon with unread count; list, mark read, and open linked pages
- **Web Push (mobile web)**: Optional push notifications when crew requests are sent or responded to
- **Admin Interface**: Create events manually or import from racing calendars
- **Calendar Import**: Import events from external sources like Austin Yacht Club

## Using Crew Bench

### 1. Create a profile

Register as **crew** or **skipper**, then complete your profile (experience, weight, position preferences, contact prefs).

![Profile](docs/images/profile.png)

**Crew Pool email alerts** (skippers): on Profile, enable **Email me when new crew join the Crew Pool**. Alerts fire when someone newly registers interest or re-activates a hidden profile (at most one email per hour by default). Without SMTP configured, emails are logged for local development.

![Crew Pool email alerts preference](docs/images/profile_crew_pool_alerts.png)

### 2. Crew Pool — general interest (no event required)

Use **Crew Pool** when you want to crew generally, or when skippers want to find people without selecting a race first.

**Register Interest** (crew):

1. Open **Crew Pool** in the sidebar under *General Crew*
2. On **Register Interest**, tap shortcuts such as *Every Saturday*, *Every Weekend*, *Weekdays*, or *Flexible*
3. Optionally add notes and specific date ranges
4. Click **Register interest** / **Update profile**

![Crew Pool — Register Interest](docs/images/crew_pool_register.png)

**Browse Crew Pool** (skippers):

1. Open the **Browse Crew Pool** tab
2. Search by name, experience, or notes
3. View availability shortcuts, date ranges, and notes for each person

![Crew Pool — Browse](docs/images/crew_pool_browse.png)

You can hide your profile from skippers or remove it entirely at any time.

**Message crew from the pool** (skippers):

1. On **Browse Crew Pool**, click **Send message** on a crew card
2. Compose a short note (contact preferences are respected)
3. Continue the conversation under **Messages** in *My Account*

![Send message from Crew Pool](docs/images/crew_pool_send_message.png)

![Compose message dialog](docs/images/crew_pool_message_dialog.png)

![Messages conversation](docs/images/messages_thread.png)

**Invite pool crew to a race** (skippers):

1. Add at least one boat under **My Boats**
2. On **Browse Crew Pool**, click **Invite to event** on a crew card
3. Choose your boat and an event (or invite for an entire series)
4. The invitation appears in the crew member’s **Requests** inbox

![Invite to event from Crew Pool](docs/images/crew_pool_invite_browse.png)

![Invite dialog](docs/images/crew_pool_invite_dialog.png)

![Invitation sent](docs/images/crew_pool_invite_success.png)

### 3. Race Events — specific races and series

Use **Race Events** when you care about a particular race day or series.

**Mark availability** (crew):

1. Open **Browse Events** under *Race Events*
2. Find an event (or a series) and mark yourself available
3. Optionally prefer any boat, specific boats, or fleets

![Race Events](docs/images/race_events.png)

**Find crew for an event** (skippers):

1. Open **Find Crew (Events)**
2. Select an event (or series) and your boat
3. Browse crew who marked availability for that event and send a request

![Find Crew for Events](docs/images/find_crew_events.png)

### 4. Requests and schedule

- **Requests** — accept, decline, or manage waitlisted invitations  
![Requests](docs/images/requests.png)

- **My Schedule** — see what you’re sailing (as crew or on your own boat)  
![My Schedule](docs/images/my_schedule.png)

### Navigation overview

| Sidebar section   | Purpose                                      |
|-------------------|----------------------------------------------|
| **General Crew**  | Crew Pool (interest without a specific race) |
| **Race Events**   | Browse Events, Find Crew for a race/series   |
| **My Account**    | Schedule, boats, requests, messages, contacts, profile |

## Tech Stack

- **Backend**: Python/FastAPI
- **Frontend**: React with Material-UI
- **Database**: PostgreSQL
- **Containerization**: Docker Compose

## Quick Start

### Prerequisites

- Docker, and Docker Compose v2 as the `docker compose` plugin
- Compose v2.22 or newer if you want `--watch` for live code changes in the debug stack (`docker compose version` to check)

### Already running an older version?

Two things changed that affect existing installations, so read this before starting:

- **Postgres data moved out of `./db` into a named volume.** If a `./db` directory exists in your checkout, that is your database, and starting a stack now would quietly create an empty one beside it. Moving it is a one-time manual step that startup does **not** do for you: [Migrating from the old `./db` bind mount](#migrating-from-the-old-db-bind-mount).
- **`docker compose up` on its own no longer starts the application.** `docker-compose.yml` is a shared base that publishes no ports; every start goes through `./scripts/compose.sh <dev|prod>` or names both files explicitly. Update any deploy script, systemd unit, or runbook that calls `docker compose up` or `docker-compose up` directly.

No `./db` directory means nothing to migrate — follow the steps below as normal.

Note the two unrelated things called "migration" here: moving the data directory into a volume is a manual step you run once, while bringing an old *schema* up to date happens automatically on every start ([Database schema updates](#database-schema-updates)).

### Running the Application

1. Clone the repository and navigate to the project directory:

```bash
cd crew-bench
```

2. Create secrets. **Required** — Compose will not start with missing or empty secrets, and the backend will not start with known-insecure defaults:

```bash
./scripts/generate_secrets.sh
```

This writes a gitignored `.env` with unique `POSTGRES_PASSWORD`, `SECRET_KEY`, and `ADMIN_PASSWORD`. Save the printed admin login. Alternatively, copy `.env.example` to `.env` and set those values yourself (do not leave them blank, and do not use values like `admin123` or `crewbench_secret`).

3. Start a stack. There is no default stack, so name the one you want:

```bash
./scripts/compose.sh prod up -d --build   # production
./scripts/compose.sh dev  up -d --build   # debug/development
```

The wrapper takes any `docker compose` arguments after the stack name and picks the right overlay, project name and environment file for you.

4. Access the application:

| Stack | Frontend | Backend API | API docs | Postgres |
|-------|----------|-------------|----------|----------|
| `prod` | http://localhost:3333 | http://localhost:8000 | http://localhost:8000/docs | `localhost:5432` |
| `dev`  | http://localhost:3334 | http://localhost:8001 | http://localhost:8001/docs | `localhost:5433` |

### Admin account

The initial admin user is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your environment file. There is no default password in the repository. The admin must change this password on first login.

If you already have a Postgres volume from an earlier password, either put that password in your environment file or reset that stack's volume:

```bash
./scripts/compose.sh prod down -v
```

## Debug and production stacks

`docker-compose.yml` is a shared base and is not meant to be run on its own: it publishes no ports and names no project. Pair it with exactly one overlay, which the `compose.sh` wrapper does for you.

| | `prod` | `dev` |
|---|---|---|
| Compose project | `crew-bench-prod` | `crew-bench-dev` |
| Overlay | `docker-compose.prod.yml` | `docker-compose.dev.yml` |
| Frontend port | 3333 | 3334 |
| Backend port | 8000 | 8001 |
| Postgres port | 5432 | 5433 |
| Database | `crewbench` | `crewbench_dev` |
| Data volume | `crew-bench-prod-db-data` | `crew-bench-dev-db-data` |
| Log volume | `crew-bench-prod-backend-logs` | `crew-bench-dev-backend-logs` |
| Log level | `INFO` | `DEBUG` |
| Backend reload | off | on (`--reload`) |
| Restart policy | `unless-stopped` | none |

Because the two stacks are separate Compose projects with separate volumes and ports, they can run at the same time and `down -v` on one never touches the other.

```bash
./scripts/compose.sh dev  up -d --build      # start the debug stack
./scripts/compose.sh dev  logs -f backend
./scripts/compose.sh dev  down -v            # reset the debug database only
./scripts/compose.sh prod ps
```

Override any port or database name from your environment file (see `.env.example`), e.g. `DEV_FRONTEND_PORT=4000` or `PROD_POSTGRES_DB=crewbench_live`.

The long form works too, if you prefer not to use the wrapper:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Live code changes in the debug stack

The debug overlay uses Compose watch rather than a bind mount, so nothing in the working tree is mounted into a container:

```bash
./scripts/compose.sh dev up -d --build --watch
```

Backend source is synced into the running container (which runs uvicorn with `--reload`), and changes to `requirements.txt`, the `Dockerfile`, or frontend sources trigger a rebuild. Without `--watch`, rebuild with `./scripts/compose.sh dev up -d --build` after making changes.

### Separate secrets per stack

`compose.sh` uses `.env.<env>` when it exists and falls back to `.env`. To give production and debug completely independent credentials:

```bash
./scripts/generate_secrets.sh .env.prod
./scripts/generate_secrets.sh .env.dev
```

## Data storage and volumes

All persistent state lives in named Docker volumes; no container writes into the working tree.

```bash
docker volume ls | grep crew-bench
```

- `crew-bench-<env>-db-data` — PostgreSQL data directory
- `crew-bench-<env>-backend-logs` — mounted at `/var/log/crewbench`; point `LOG_FILE` there to keep logs across container rebuilds

Back up a database without stopping the stack:

```bash
./scripts/compose.sh prod exec -T db pg_dump -U crewbench crewbench > backup.sql
```

### Migrating from the old `./db` bind mount

Earlier versions stored PostgreSQL data in a `./db` directory inside the repository. If that directory exists, migrate it before starting a stack — otherwise the stack comes up on an empty volume and your data stays behind in `./db`, untouched but unused.

```bash
./scripts/compose.sh prod down                 # stop the stack, if it is running
./scripts/migrate_db_to_volume.sh prod         # ./db -> crew-bench-prod-db-data
./scripts/compose.sh prod up -d --build
./scripts/check_schema.sh prod check           # confirm the schema matches the models
```

The script only reads `./db`. It refuses to run while the stack is up, to overwrite a non-empty volume, or to copy a data directory written by a different PostgreSQL major version (dump and restore instead). Delete `./db` once the stack is confirmed working.

A database carried forward this way is usually also behind on schema, since it was created by an older release. Startup brings it up to date automatically — see [Database schema updates](#database-schema-updates).

Note that `docker compose down -v` never deleted the old bind-mount directory, so a "full reset" left the previous database in place. With named volumes, `down -v` really does delete the data.

## Database schema updates

This project has no migration tool. `create_all` creates tables that are absent but never alters a table that already exists, so a database created by an older release would otherwise be permanently missing every column added since. Startup therefore does three things in order, before serving any request:

1. create tables that do not exist yet
2. add missing columns and indexes to tables that do, leaving existing rows in place and never dropping anything
3. validate the result, and refuse to start if any modeled table or column is still missing

Step 3 keeps the guarantee that the backend never serves traffic against a schema it does not match: additive drift repairs itself, and anything else (a renamed or retyped column, a permissions problem) is a fatal startup error naming what is wrong.

Inspect a running stack without changing it:

```bash
./scripts/check_schema.sh prod check     # read-only report, exit 1 if drifted
./scripts/check_schema.sh prod apply     # add what is missing
```

Columns with a scalar model default (for example `allow_email_contact`) are added with that SQL default, so rows that already exist get a sensible value. Columns whose default is computed per row in Python (for example `created_at`) are added empty for existing rows. Columns present in the database but no longer in the models are reported and left alone.

## User Roles

### Crew
- Register general interest in the Crew Pool (shortcuts, notes, date ranges)
- Browse events and mark availability for specific races/series
- Receive and respond to crew requests from skippers
- Manage profile with experience level and certifications

### Skipper
- Register boats with details (make, model, crew needed)
- Browse the Crew Pool for generally available crew
- Browse available crew for specific events and send invitations
- Send crew requests

### Admin
- All crew and skipper capabilities
- Create and manage events
- Import events from external racing calendars
- View all registered users

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update current user

### Crew Pool
- `GET /api/crew-pool` - List active crew interest profiles
- `GET /api/crew-pool/my` - Get current user’s crew interest
- `PUT /api/crew-pool` - Create or update crew interest
- `DELETE /api/crew-pool` - Remove crew interest profile

### Direct messaging
- `POST /api/conversations` - Start a conversation from the Crew Pool
- `GET /api/conversations` - List conversations
- `GET /api/conversations/{id}` - Get conversation with messages
- `POST /api/conversations/{id}/messages` - Send a reply

### Boats
- `GET /api/boats` - List all boats
- `GET /api/boats/my` - List user's boats
- `POST /api/boats` - Create boat
- `PUT /api/boats/{id}` - Update boat
- `DELETE /api/boats/{id}` - Delete boat

### Events
- `GET /api/events` - List events
- `GET /api/events/{id}` - Get event details
- `POST /api/events` - Create event (admin)
- `PUT /api/events/{id}` - Update event (admin)
- `DELETE /api/events/{id}` - Delete event (admin)

### Crew Availability
- `POST /api/availability` - Mark available for event
- `GET /api/availability/my` - Get my availability
- `GET /api/events/{id}/available-crew` - Get available crew for event
- `DELETE /api/availability/{id}` - Remove availability

### Crew Requests
- `POST /api/crew-requests` - Send crew request
- `GET /api/crew-requests/received` - Get received requests
- `GET /api/crew-requests/sent` - Get sent requests
- `PUT /api/crew-requests/{id}/respond` - Respond to request

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/import-calendar` - Import events from calendar URL

## Development

### Backend Development

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm start
```

### Testing locally with one port (sub-path, like production)

To simulate production (backend on a sub-path of the same host, single port in the browser):

1. **Backend** on port 8000 (e.g. `cd backend && uvicorn main:app --reload`, or use Docker for the backend + DB).
2. **Frontend** on port 3000 with the dev-server proxy (already configured in `package.json`): `cd frontend && npm start`.
3. Use the same origin for the API so requests go through the proxy:
   - Create `frontend/.env.development.local` with:
     ```bash
     REACT_APP_API_URL=
     ```
   - Or run: `REACT_APP_API_URL= npm start`
4. Open only **http://localhost:3000**. All API calls go to `/api/...` on that host and are proxied to the backend on 8000.

Optional: set `PUBLIC_URL=http://localhost:3000` when starting the backend so request logs show that URL.

## Environment Variables

Secrets are read from a project-root environment file (gitignored) or from the process environment. Copy `.env.example` to `.env` or run `./scripts/generate_secrets.sh`. `compose.sh` passes `.env.<stack>` when it exists and `.env` otherwise; Compose interpolates that file and **exits with an error** if required secrets are unset or empty.

### Backend (required)
- `POSTGRES_PASSWORD` - PostgreSQL password. Must be set before starting a stack. At least 12 characters; known defaults such as `crewbench_secret` are rejected.
- `SECRET_KEY` - JWT signing key. At least 32 characters; placeholder values such as `your-secret-key-change-in-production` are rejected.
- `ADMIN_EMAIL` - Initial admin email (created on first startup if missing).
- `ADMIN_PASSWORD` - Initial admin password. At least 12 characters; `admin123` and other known defaults are rejected.
- `DATABASE_URL` - PostgreSQL connection string. Set automatically by Compose from `POSTGRES_USER` / `POSTGRES_PASSWORD` and the stack's database name. When running the backend outside Compose, set `DATABASE_URL` or the `POSTGRES_*` variables.

### Backend (optional)
- `POSTGRES_USER` - PostgreSQL user, shared by both stacks (default: `crewbench`).
- `PROD_POSTGRES_DB` / `DEV_POSTGRES_DB` - Database name per stack (defaults: `crewbench` / `crewbench_dev`).
- `PROD_FRONTEND_PORT`, `PROD_BACKEND_PORT`, `PROD_DB_PORT` - Published production ports (defaults: 3333, 8000, 5432).
- `DEV_FRONTEND_PORT`, `DEV_BACKEND_PORT`, `DEV_DB_PORT` - Published debug ports (defaults: 3334, 8001, 5433).
- `DEV_LOG_LEVEL` - Log level for the debug stack (default: `DEBUG`).
- `RECAPTCHA_SECRET_KEY` - reCAPTCHA v2 secret key for registration CAPTCHA. If set, new users must pass CAPTCHA verification.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - Web Push VAPID keys for push notifications. Generate with e.g. `python -m py_vapid` or `npx web-push generate-vapid-keys`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS` - When `SMTP_HOST` is set, crew pool alert emails are sent via SMTP; otherwise they are logged (dev/test).
- `CREW_POOL_ALERT_COOLDOWN_SECONDS` - Per-skipper cooldown between crew pool alert emails (default: 3600). Set to `0` to disable rate limiting.
- `LOG_LEVEL` - Logging level: DEBUG, INFO, WARNING, ERROR (default: INFO).
- `LOG_FILE` - Path to log file; if set, logs are also written to a rotating file (see LOG_MAX_BYTES, LOG_BACKUP_COUNT).
- `LOG_MAX_BYTES` - Max bytes per log file when using LOG_FILE (default: 5MB).
- `LOG_BACKUP_COUNT` - Number of backup log files to keep (default: 3).
- `PUBLIC_URL` - Public URL of the app (e.g. `https://app.example.com`). When set, this is logged at startup and included in request log lines so logs reflect the reverse-proxy URL.
- `ROOT_PATH` - Root path when the API is served behind a reverse proxy at a sub-path (used for OpenAPI docs).
- `CORS_ORIGINS` - Comma-separated list of allowed CORS origins. The origin derived from `PUBLIC_URL` is automatically allowed when set.

### Frontend
- `API_BASE_PATH` - **Runtime** browser API base (preferred). Default `/api`. Set on the frontend container; takes effect on recreate — **no image rebuild**. Use `/api/api` only when an outer proxy strips one `/api` before the backend.
- `REACT_APP_API_URL` - Legacy bake-time override (avoid). Empty → `/api`; unset in local CRA → `http://localhost:8000/api`. Prefer `API_BASE_PATH` in Docker.
- `REACT_APP_RECAPTCHA_SITE_KEY` - Optional. reCAPTCHA v2 site key (must be set if backend uses `RECAPTCHA_SECRET_KEY`).

## Production behind a reverse proxy (e.g. Cloudflare Zero Trust)

Crew Bench expects the browser to call **`/api/...`** (login = `POST /api/auth/login`). That path is controlled by **`API_BASE_PATH`** (default `/api`), injected at frontend container start via `/config.js` — you can change it without rebuilding.

### Recommended topology (preferred)

Send **all** public traffic to the frontend container (prod port `3333` by default). Its nginx proxies `/api/` to the backend. Keep `API_BASE_PATH=/api`.

```
Internet → reverse proxy → frontend:80
                              ├─ /        → SPA
                              └─ /api/*   → backend:8000 (one strip, then middleware restores /api)
```

### Split-path topology

If the reverse proxy must route `/api` itself:

- Forward `/api/*` → backend **without stripping** `/api` (backend must see `/api/health`, `/api/auth/login`).
- Keep `API_BASE_PATH=/api`.

### Strip-once outer proxy (uncommon)

Only if the proxy strips exactly one `/api` before the backend:

```bash
# in .env.prod — recreate frontend, no rebuild
API_BASE_PATH=/api/api
./scripts/compose.sh prod up -d frontend
```

Do **not** bake `/api/api` into the image; that is how login 404s came back before.

### Backend

Set `PUBLIC_URL` to the public base URL (e.g. `https://yourapp.com`). Optionally set `CORS_ORIGINS`.

### Diagnose login/register 404

```bash
./scripts/check_api_path.sh https://yourapp.com
# or against the published frontend port on the Pi:
./scripts/check_api_path.sh http://rpi5-1:3333
```

In the browser Network tab, login must be `POST /api/auth/login` (or `POST {API_BASE_PATH}/auth/login`). If you see `/api/api/...` while the host expects `/api`, set `API_BASE_PATH=/api` and recreate the frontend container.

### Sanity check before deployment

Run the reverse-proxy sanity tests and a live health check against the debug stack, so production is untouched:

```bash
./scripts/sanity_check_proxy.sh
```

Optional: set `PUBLIC_URL` to your public base URL (default `https://app.example.com`) to verify CORS for that origin, or `CREW_BENCH_ENV=prod` to check the production stack instead. The script runs pytest in `backend/tests/test_proxy_sanity.py` and then curls `/api/health` on that stack's backend port.

## License

MIT
