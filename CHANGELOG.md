# Changelog

All notable changes to the Crew Bench application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] - 2026-03-09

### Added

#### Series Support
- **Auto-detect series from calendar imports**: Events with "Series" in the title are automatically grouped and enumerated (e.g., "Spring Series #1", "Spring Series #2")
- **Series availability**: Mark yourself available for all events in a series at once
- **Series crew requests**: Skippers can invite crew for an entire series in one action
- **Series response**: Crew can accept or decline all requests for a series at once
- **Series view**: Events page now has "By Series" tab to view events grouped by series

#### Withdrawal Feature
- **Withdraw from events**: Both crew and skippers can withdraw from accepted crew positions
- **Automatic availability restoration**: When withdrawing, the crew member is marked as available again for that event
- **Withdrawal tracking**: Withdrawals are recorded with who withdrew (crew or skipper) and optional reason

#### Responsive Design
- **Mobile-optimized UI**: All pages now render properly on phones and tablets
- **Responsive navigation**: Hamburger menu on mobile with slide-out drawer
- **Scrollable tabs**: Tab bars scroll horizontally on small screens
- **Stacking layouts**: Headers and buttons stack vertically on mobile
- **Touch-friendly**: Adequate sizing and spacing for touch interaction

#### Search Filters
- **Events search**: Filter events by name, series, location, or description
- **Schedule search**: Filter confirmed assignments by event, series, boat, or crew name
- **Requests search**: Filter incoming/outgoing requests by event, series, boat, or person name
- **Dynamic counts**: Tab labels update to show filtered result counts

#### Skipper Commitments
- **Sailing your own boat**: When skippers mark availability for their own boats, they're automatically committed as skipper (no crew request needed)
- **Separate tracking**: Skipper commitments are tracked separately from crew positions
- **My Schedule updates**: New "Sailing My Boat" tab shows events where you're sailing your own boat
- **Summary cards**: Updated to show breakdown of events as crew, sailing own boat, and with crew

#### Password Management
- **Change password**: Users can change their password from the Profile page
- **Required password change**: Admin users must change their password on first login
- **Password validation**: Minimum 8 character requirement with confirmation field

### Improved

#### Calendar Import
- **Duplicate prevention**: Re-importing the same calendar URL won't create duplicate events
- **Import tracking**: Shows count of skipped duplicates when importing

### Fixed

#### Calendar Import
- **Series deduplication**: Fixed duplicate series events when calendar page has redundant data

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
