# Changelog

All notable changes to the Crew Match application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-03-09

### Added

#### Core Features
- **User Authentication**: Register and login system with JWT tokens
- **User Profiles**: Support for crew and skipper roles with experience levels, certifications, and bio
- **Boat Management**: Create, edit, and delete boats with details (make, model, sail number, length, crew needed)
- **Fleet Support**: Boats can be assigned to fleets; fleets can be created inline from the boat form
- **Event Management**: Browse upcoming sailing events and regattas
- **Admin Interface**: Admin users can create events manually or import from external calendars

#### Crew Matching
- **Crew Availability**: Crew members can mark themselves as available for events
- **Availability Preferences**: When marking availability, crew can specify:
  - Available for any boat
  - Available for specific boats only
  - Available for specific fleets only
- **Crew Requests**: Skippers can browse available crew and send invitations
- **Request Management**: Crew can accept or decline requests with optional messages

#### Event Import
- **Calendar Import**: Import events from external racing calendars
- **Austin Yacht Club Support**: Built-in support for importing from Austin Yacht Club racing calendar
- **Multiple Format Parsing**: Supports table, list, and calendar grid formats

#### Technical
- **Dockerized Deployment**: Full Docker Compose setup with PostgreSQL, FastAPI backend, and React frontend
- **API Documentation**: Auto-generated OpenAPI docs at `/docs`
- **Modern UI**: Material-UI based responsive interface

### Infrastructure
- PostgreSQL 15 database
- Python 3.11 / FastAPI backend
- React 18 frontend with Material-UI
- Docker Compose orchestration
