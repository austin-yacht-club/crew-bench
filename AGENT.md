# Agent Development Guide

This document provides instructions for AI agents and developers working on the Crew Bench application.

## Project Overview

Crew Bench is a web application that matches sailing crew with boats for racing events. It consists of:
- **Backend**: Python/FastAPI REST API with PostgreSQL database
- **Frontend**: React with Material-UI
- **Infrastructure**: Docker Compose for local development

## Development Environment

### Two stacks

There are two independent Compose stacks. Always work in `dev`; leave `prod` alone unless the task is about production.

| | `prod` | `dev` |
|---|---|---|
| Compose project | `crew-bench-prod` | `crew-bench-dev` |
| Frontend | http://localhost:3333 | http://localhost:3334 |
| Backend API | http://localhost:8000 | http://localhost:8001 |
| Postgres | `localhost:5432` | `localhost:5433` |
| Database | `crewbench` | `crewbench_dev` |
| Data volume | `crew-bench-prod-db-data` | `crew-bench-dev-db-data` |

`docker-compose.yml` is a shared base that publishes no ports; it must be paired with `docker-compose.dev.yml` or `docker-compose.prod.yml`. Use the wrapper, which selects the overlay, project name and environment file:

```bash
./scripts/compose.sh <dev|prod> <docker compose args...>
```

A bare `docker compose up` does **not** start a usable stack.

### Starting the Application

```bash
cd crew-bench
./scripts/generate_secrets.sh          # once; creates gitignored .env
./scripts/compose.sh dev up -d --build
```

### Rebuilding After Changes

```bash
# Rebuild all containers in the debug stack
./scripts/compose.sh dev up -d --build

# Rebuild a specific service
./scripts/compose.sh dev up -d --build frontend
./scripts/compose.sh dev up -d --build backend

# Live code sync instead of rebuilding (Compose watch; no bind mounts)
./scripts/compose.sh dev up -d --build --watch

# Full reset of the debug database only
./scripts/compose.sh dev down -v && ./scripts/compose.sh dev up -d --build
```

`down -v` deletes that stack's named volumes and nothing else, so resetting `dev` cannot affect `prod`.

### Viewing Logs

```bash
./scripts/compose.sh dev logs -f backend
./scripts/compose.sh dev logs -f frontend
docker logs crew-bench-dev-backend-1
```

### Admin credentials

There is no default admin password. After `./scripts/generate_secrets.sh`, use `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` (or `.env.dev` / `.env.prod` when present). The admin must change the password on first login.

## Code Structure

```
crew-bench/
├── backend/
│   ├── main.py          # FastAPI routes and application
│   ├── models.py        # SQLAlchemy ORM models
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── auth.py          # Authentication utilities
│   ├── settings.py      # Required secrets; fail-closed validation
│   ├── database.py      # Connection setup and schema reconciliation
│   ├── manage_schema.py # CLI: report or apply schema drift
│   ├── calendar_importer.py  # External calendar scraping
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main app with routing and theme
│   │   ├── components/      # Reusable components
│   │   │   └── Layout.js    # Main layout with navigation
│   │   ├── pages/           # Page components
│   │   └── services/
│   │       ├── api.js       # API client functions
│   │       └── AuthContext.js  # Authentication context
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml       # Shared base; never run on its own
├── docker-compose.dev.yml   # Debug stack (crew-bench-dev)
├── docker-compose.prod.yml  # Production stack (crew-bench-prod)
├── .env.example             # Template for required secrets (copy to .env)
├── scripts/
│   ├── compose.sh               # Run compose against one stack
│   ├── generate_secrets.sh      # Create .env / .env.dev / .env.prod
│   ├── check_schema.sh          # Report or apply schema drift
│   └── migrate_db_to_volume.sh  # Old ./db bind mount -> named volume
├── CHANGELOG.md
├── README.md
└── AGENT.md
```

## Making Changes

### Backend Changes

1. **Models** (`models.py`): SQLAlchemy ORM models for database tables
2. **Schemas** (`schemas.py`): Pydantic models for API request/response validation
3. **Routes** (`main.py`): FastAPI endpoints

When adding new database columns:
- Add column to the model in `models.py`
- Add field to relevant schemas in `schemas.py`
- Restart the backend: `./scripts/compose.sh dev up -d --build backend`

`ensure_schema_current()` in `database.py` runs at startup and adds new tables, columns and indexes to an existing database, so dropping the volume is not required. Give new columns either `nullable=True` or a scalar default, so existing rows can be backfilled — a `NOT NULL` column with no default cannot be enforced on a populated table and is added nullable instead. Verify with:

```bash
./scripts/check_schema.sh dev check
```

Renames, type changes and drops are **not** handled automatically; do those deliberately with SQL, or reset the dev database with `./scripts/compose.sh dev down -v`.

### Frontend Changes

1. **API Methods** (`services/api.js`): Add new API calls here
2. **Pages** (`pages/`): Full-page components with their own routes
3. **Components** (`components/`): Reusable UI components

### Responsive Design Guidelines

- Use MUI's responsive `sx` prop: `sx={{ fontSize: { xs: '1rem', sm: '1.5rem' } }}`
- Grid columns: `xs={12}` (full width mobile), `sm={6}` (half on tablet), `md={4}` (third on desktop)
- Make Tabs scrollable: `variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile`
- Stack layouts on mobile: `flexDirection: { xs: 'column', sm: 'row' }`

## Git Workflow

### Committing Changes

Always commit with descriptive messages. Use this format:

```bash
git add -A
git commit -m "$(cat <<'EOF'
Short summary of changes (50 chars or less)

- Bullet point describing change 1
- Bullet point describing change 2
- Bullet point describing change 3

EOF
)"
```

### Before Committing

1. **Test the application**: Ensure `./scripts/compose.sh dev up -d --build` succeeds
2. **Check for errors**: Review `./scripts/compose.sh dev logs backend`
3. **Verify frontend**: Check that http://localhost:3334 loads
4. **Run the backend tests**: `cd backend && python -m pytest tests/ -q`

## Updating the Changelog

The changelog follows [Keep a Changelog](https://keepachangelog.com/) format.

### When to Update

Update `CHANGELOG.md` when:
- Adding new features
- Fixing bugs
- Making breaking changes
- Improving performance

### Changelog Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features
```

### Version Numbering

- **Major (X.0.0)**: Breaking changes
- **Minor (X.Y.0)**: New features, backwards compatible
- **Patch (X.Y.Z)**: Bug fixes

## Common Tasks

### Adding a New API Endpoint

1. Add Pydantic schema in `backend/schemas.py`
2. Add route in `backend/main.py`
3. Add API method in `frontend/src/services/api.js`
4. Use the API in your component

### Adding a New Page

1. Create component in `frontend/src/pages/NewPage.js`
2. Import and add route in `frontend/src/App.js`
3. Add navigation link in `frontend/src/components/Layout.js`

### Adding a New Database Table

1. Add model in `backend/models.py`
2. Add schemas in `backend/schemas.py`
3. Add CRUD endpoints in `backend/main.py`
4. Restart the backend so startup reconciliation creates the table: `./scripts/compose.sh dev up -d --build backend`

## Testing

### Manual Testing

1. Register a new user
2. Login with the user
3. Test the feature you implemented
4. Test on mobile viewport (Chrome DevTools → Toggle device toolbar)

### API Testing

Use the Swagger UI at http://localhost:8000/docs to test API endpoints directly.

## Troubleshooting

### Database Issues

```bash
# Reset one stack's database completely (also needed if you rotate POSTGRES_PASSWORD)
./scripts/compose.sh dev down -v
./scripts/compose.sh dev up -d --build
```

### "column ... does not exist"

The database predates a model change. Startup reconciliation normally handles this; check what is missing and apply it without restarting:

```bash
./scripts/check_schema.sh dev check
./scripts/check_schema.sh dev apply
```

### Missing secrets / Compose will not start

```bash
# Required before the first start
./scripts/generate_secrets.sh
```

Compose errors about `POSTGRES_PASSWORD`, `SECRET_KEY`, or `ADMIN_PASSWORD` mean the environment file is missing or a required value is empty. Known-insecure defaults (for example `admin123`) are rejected by the backend even if set.

### Port Already in Use

Both stacks publish fixed ports. Stop the other stack, or override the port in your environment file (`DEV_FRONTEND_PORT`, `PROD_BACKEND_PORT`, ...):

```bash
./scripts/compose.sh dev down
./scripts/compose.sh dev ps        # confirm nothing is left running
```

### Frontend Not Updating

```bash
./scripts/compose.sh dev up -d --build frontend
```

### Backend Import Errors

Check Python syntax and imports:
```bash
./scripts/compose.sh dev logs backend
```
