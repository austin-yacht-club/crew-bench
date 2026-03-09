# Crew Bench - Development TODO

This document tracks planned features, improvements, and known issues.

## Completed Features ✓

### Core Features
- [x] User authentication (register, login, JWT tokens)
- [x] User profiles (crew/skipper roles, experience levels, bio)
- [x] Boat management (CRUD operations)
- [x] Fleet support (assign boats to fleets)
- [x] Event management (browse, create, edit)
- [x] Admin interface

### Crew Matching
- [x] Mark availability for events
- [x] Availability preferences (any boat, specific boats, specific fleets)
- [x] Crew requests (skippers invite crew)
- [x] Accept/decline requests with messages
- [x] Show contact info after request accepted

### Series Support
- [x] Auto-detect series from calendar imports
- [x] Enumerate series events (e.g., "Spring Series #1")
- [x] Mark availability for entire series
- [x] Send crew requests for entire series
- [x] Accept/decline series requests at once
- [x] "By Series" view on events page

### Calendar Import
- [x] Import from Austin Yacht Club calendar
- [x] Support multiple page formats (table, list, calendar)
- [x] Duplicate prevention on re-import

### User Experience
- [x] Profile pictures (with client-side compression)
- [x] Contact preferences (email, phone, SMS)
- [x] My Schedule page (view confirmed assignments)
- [x] Withdrawal from accepted requests
- [x] Mobile responsive design
- [x] Search filters for events, schedule, and requests
- [x] Skipper commitments (sailing own boat without crew request)

### v1.2.0 Additions
- [x] Password change from profile; required admin password change on first login
- [x] Admin: edit events and users; admin can set/reset user passwords
- [x] "Show past events" filter (Events and Requests pages)
- [x] Waitlist for crew requests (auto-promote when primary declines)
- [x] Position preferences for crew (Bow, Rail, Trimmer, Pit, Helm, Tactician, Any)
- [x] Crew ratings (skipper-viewable, 1–5 stars); boat ratings (crew-viewable); rate from My Schedule
- [x] Availability calendar view (month view on Events page with availability indicators)
- [x] Experience level "Never sailed before" (novice)

---

## Planned Features

### High Priority

#### Notifications
- [ ] Email notifications for new crew requests
- [ ] Email notifications when requests are accepted/declined
- [ ] In-app notification system
- [ ] Push notifications (mobile web)

#### Event Management
- [ ] Recurring events (weekly/monthly series)
- [ ] Event reminders before race day
- [ ] Weather integration (show forecast for event dates)
- [ ] Event check-in on race day

#### Crew Features
- [x] Crew ratings/reviews after events (and boat ratings by crew)
- [ ] Favorite boats (quick access to preferred boats)
- [x] Availability calendar view
- [x] Position preferences (bow, rail, trimmer, etc.)

### Medium Priority

#### Skipper Features
- [ ] Crew roster history (who has sailed before)
- [ ] Quick re-invite previous crew for new events
- [ ] Crew weight calculator for optimal balance
- [x] Waitlist for when preferred crew declines

#### Search & Discovery
- [x] Search/filter events by name, series, location
- [x] Search/filter schedule by event, boat, crew
- [x] Search/filter requests by event, boat, person
- [ ] Search/filter events by date range
- [ ] Filter crew by experience level
- [ ] Filter by certifications
- [ ] Geographic location filtering

#### Social Features
- [ ] Direct messaging between users
- [ ] Comments on events
- [ ] Share events to social media
- [ ] Club/organization pages

### Low Priority

#### Analytics
- [ ] Skipper dashboard (crew acceptance rates, popular events)
- [ ] Crew statistics (events participated, boats sailed)
- [ ] Admin analytics (user growth, event activity)

#### Integration
- [ ] Google Calendar sync
- [ ] iCal export for confirmed events
- [ ] Additional calendar sources (other yacht clubs)
- [ ] Regatta Network integration

#### Advanced Features
- [ ] Multiple crew positions per boat (define roles)
- [ ] Boat sharing between skippers
- [ ] Race results tracking
- [ ] Photo galleries for events

---

## Known Issues

### Bugs
- [ ] None currently tracked

### Technical Debt
- [ ] Add database migrations (Alembic) instead of recreating tables
- [ ] Add unit tests for backend API
- [ ] Add integration tests for frontend
- [ ] Add error boundary components in React
- [ ] Implement proper logging system

### Performance
- [ ] Add pagination to list endpoints
- [ ] Optimize database queries with proper indexing
- [ ] Add caching for frequently accessed data
- [ ] Lazy load images

---

## Ideas / Backlog

These are ideas that haven't been prioritized yet:

- Team/crew management for regular racing teams
- Handicap/rating tracking for boats
- Practice session coordination (non-race events)
- Equipment sharing (sails, gear)
- Safety certification tracking
- Emergency contact management
- Multi-language support
- Dark mode theme
- Offline support (PWA)
- Native mobile apps

---

## Contributing

When working on a feature:
1. Move item from "Planned" to a new "In Progress" section
2. Update status when complete
3. Add any new ideas discovered during development to "Ideas / Backlog"
4. Update CHANGELOG.md when feature is committed
