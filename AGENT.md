# Agent Development Guide

This document provides instructions for AI agents and developers working on the Crew Bench application.

## Project Overview

Crew Bench is a web application that matches sailing crew with boats for racing events. It consists of:
- **Backend**: Python/FastAPI REST API with PostgreSQL database
- **Frontend**: React with Material-UI
- **Infrastructure**: Docker Compose for local development

## Development Environment

### Starting the Application

```bash
cd crew-bench
docker-compose up -d
```

### Rebuilding After Changes

```bash
# Rebuild all containers
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build frontend
docker-compose up -d --build backend

# Full reset (clears database)
docker-compose down -v && docker-compose up -d --build
```

### Viewing Logs

```bash
docker logs crew-bench-backend-1
docker logs crew-bench-frontend-1
```

### Accessing the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Default Admin Credentials

- Email: `admin@crewbench.app`
- Password: `admin123`

## Code Structure

```
crew-bench/
├── backend/
│   ├── main.py          # FastAPI routes and application
│   ├── models.py        # SQLAlchemy ORM models
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── auth.py          # Authentication utilities
│   ├── database.py      # Database connection setup
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
├── docker-compose.yml
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
- Run `docker-compose down -v && docker-compose up -d --build` to recreate tables

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

1. **Test the application**: Ensure `docker-compose up -d --build` succeeds
2. **Check for errors**: Review `docker logs crew-bench-backend-1`
3. **Verify frontend**: Check that http://localhost:3000 loads

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
4. Reset database: `docker-compose down -v && docker-compose up -d --build`

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
# Reset database completely
docker-compose down -v
docker-compose up -d --build
```

### Port Already in Use

```bash
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker-compose up -d
```

### Frontend Not Updating

```bash
docker-compose up -d --build frontend
```

### Backend Import Errors

Check Python syntax and imports:
```bash
docker logs crew-bench-backend-1
```
