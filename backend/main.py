import os
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from database import engine, get_db, Base
from models import User, Boat, Event, CrewRequest, CrewAvailability, RequestStatus, Fleet
import schemas
from auth import (
    get_password_hash, 
    authenticate_user, 
    create_access_token,
    get_current_active_user,
    get_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from calendar_importer import import_austin_yacht_club_calendar, fetch_calendar_preview

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Crew Bench",
    description="Match sailing crew to boats for racing events",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Create default admin user on startup if it doesn't exist."""
    db = next(get_db())
    admin_email = os.getenv("ADMIN_EMAIL", "admin@crewbench.app")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    
    existing_admin = db.query(User).filter(User.email == admin_email).first()
    if not existing_admin:
        admin_user = User(
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            name="Admin",
            role="admin",
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        print(f"Created default admin user: {admin_email}")
    db.close()


# Auth Routes
@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        name=user.name,
        phone=user.phone,
        role=user.role,
        experience_level=user.experience_level,
        bio=user.bio,
        weight=user.weight,
        certifications=user.certifications
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=schemas.User)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return current_user


@app.put("/api/auth/me", response_model=schemas.User)
def update_current_user(
    user_update: schemas.UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# Boat Routes
@app.post("/api/boats", response_model=schemas.Boat)
def create_boat(
    boat: schemas.BoatCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_boat = Boat(**boat.model_dump(), owner_id=current_user.id)
    db.add(db_boat)
    db.commit()
    db.refresh(db_boat)
    return db_boat


@app.get("/api/boats", response_model=List[schemas.Boat])
def list_boats(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    boats = db.query(Boat).offset(skip).limit(limit).all()
    return boats


@app.get("/api/boats/my", response_model=List[schemas.Boat])
def list_my_boats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    boats = db.query(Boat).filter(Boat.owner_id == current_user.id).all()
    return boats


@app.get("/api/boats/{boat_id}", response_model=schemas.Boat)
def get_boat(boat_id: int, db: Session = Depends(get_db)):
    boat = db.query(Boat).filter(Boat.id == boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    return boat


@app.put("/api/boats/{boat_id}", response_model=schemas.Boat)
def update_boat(
    boat_id: int,
    boat_update: schemas.BoatUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    boat = db.query(Boat).filter(Boat.id == boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    if boat.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = boat_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(boat, field, value)
    db.commit()
    db.refresh(boat)
    return boat


@app.delete("/api/boats/{boat_id}")
def delete_boat(
    boat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    boat = db.query(Boat).filter(Boat.id == boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    if boat.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(boat)
    db.commit()
    return {"message": "Boat deleted"}


# Fleet Routes
@app.get("/api/fleets", response_model=List[schemas.Fleet])
def list_fleets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    fleets = db.query(Fleet).order_by(Fleet.name).offset(skip).limit(limit).all()
    return fleets


@app.post("/api/fleets", response_model=schemas.Fleet)
def create_fleet(
    fleet: schemas.FleetCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Fleet).filter(Fleet.name == fleet.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Fleet with this name already exists")
    
    db_fleet = Fleet(**fleet.model_dump())
    db.add(db_fleet)
    db.commit()
    db.refresh(db_fleet)
    return db_fleet


@app.get("/api/fleets/{fleet_id}", response_model=schemas.Fleet)
def get_fleet(fleet_id: int, db: Session = Depends(get_db)):
    fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet not found")
    return fleet


# Event Routes
@app.post("/api/events", response_model=schemas.Event)
def create_event(
    event: schemas.EventCreate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    db_event = Event(**event.model_dump(), created_by_id=current_user.id)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@app.get("/api/events", response_model=List[schemas.Event])
def list_events(
    skip: int = 0,
    limit: int = 100,
    upcoming_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Event).filter(Event.is_active == True)
    if upcoming_only:
        query = query.filter(Event.date >= datetime.utcnow())
    events = query.order_by(Event.date).offset(skip).limit(limit).all()
    return events


@app.get("/api/events/{event_id}", response_model=schemas.Event)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@app.put("/api/events/{event_id}", response_model=schemas.Event)
def update_event(
    event_id: int,
    event_update: schemas.EventUpdate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@app.delete("/api/events/{event_id}")
def delete_event(
    event_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}


# Crew Availability Routes
@app.post("/api/availability", response_model=schemas.CrewAvailability)
def mark_availability(
    availability: schemas.CrewAvailabilityCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    existing = db.query(CrewAvailability).filter(
        CrewAvailability.crew_id == current_user.id,
        CrewAvailability.event_id == availability.event_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already marked as available for this event")
    
    db_availability = CrewAvailability(
        crew_id=current_user.id,
        event_id=availability.event_id,
        availability_type=availability.availability_type or "any",
        notes=availability.notes
    )
    
    # Add preferred boats if specified
    if availability.boat_ids and availability.availability_type == "boats":
        boats = db.query(Boat).filter(Boat.id.in_(availability.boat_ids)).all()
        db_availability.preferred_boats = boats
    
    # Add preferred fleets if specified
    if availability.fleet_ids and availability.availability_type == "fleets":
        fleets = db.query(Fleet).filter(Fleet.id.in_(availability.fleet_ids)).all()
        db_availability.preferred_fleets = fleets
    
    db.add(db_availability)
    db.commit()
    db.refresh(db_availability)
    return db_availability


@app.get("/api/availability/my", response_model=List[schemas.CrewAvailability])
def get_my_availability(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    availabilities = db.query(CrewAvailability).filter(
        CrewAvailability.crew_id == current_user.id
    ).all()
    return availabilities


@app.get("/api/events/{event_id}/available-crew", response_model=List[schemas.CrewAvailability])
def get_available_crew_for_event(
    event_id: int,
    db: Session = Depends(get_db)
):
    availabilities = db.query(CrewAvailability).filter(
        CrewAvailability.event_id == event_id,
        CrewAvailability.is_matched == False
    ).all()
    return availabilities


@app.delete("/api/availability/{availability_id}")
def remove_availability(
    availability_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    availability = db.query(CrewAvailability).filter(
        CrewAvailability.id == availability_id
    ).first()
    
    if not availability:
        raise HTTPException(status_code=404, detail="Availability not found")
    if availability.crew_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(availability)
    db.commit()
    return {"message": "Availability removed"}


# Crew Request Routes
@app.post("/api/crew-requests", response_model=schemas.CrewRequest)
def create_crew_request(
    request: schemas.CrewRequestCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    boat = db.query(Boat).filter(Boat.id == request.boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    if boat.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You can only request crew for your own boat")
    
    existing = db.query(CrewRequest).filter(
        CrewRequest.boat_id == request.boat_id,
        CrewRequest.crew_id == request.crew_id,
        CrewRequest.event_id == request.event_id,
        CrewRequest.status == RequestStatus.PENDING.value
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Request already exists")
    
    db_request = CrewRequest(**request.model_dump())
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request


@app.get("/api/crew-requests/received", response_model=List[schemas.CrewRequest])
def get_received_requests(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    requests = db.query(CrewRequest).options(
        joinedload(CrewRequest.boat).joinedload(Boat.owner),
        joinedload(CrewRequest.event),
        joinedload(CrewRequest.crew)
    ).filter(
        CrewRequest.crew_id == current_user.id
    ).order_by(CrewRequest.created_at.desc()).all()
    return requests


@app.get("/api/crew-requests/sent", response_model=List[schemas.CrewRequest])
def get_sent_requests(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    boats = db.query(Boat).filter(Boat.owner_id == current_user.id).all()
    boat_ids = [b.id for b in boats]
    
    requests = db.query(CrewRequest).options(
        joinedload(CrewRequest.boat),
        joinedload(CrewRequest.event),
        joinedload(CrewRequest.crew)
    ).filter(
        CrewRequest.boat_id.in_(boat_ids)
    ).order_by(CrewRequest.created_at.desc()).all()
    return requests


@app.put("/api/crew-requests/{request_id}/respond", response_model=schemas.CrewRequest)
def respond_to_request(
    request_id: int,
    response: schemas.CrewRequestResponse,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    crew_request = db.query(CrewRequest).filter(CrewRequest.id == request_id).first()
    if not crew_request:
        raise HTTPException(status_code=404, detail="Request not found")
    if crew_request.crew_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    crew_request.status = response.status
    crew_request.response_message = response.response_message
    crew_request.responded_at = datetime.utcnow()
    
    if response.status == RequestStatus.ACCEPTED.value:
        availability = db.query(CrewAvailability).filter(
            CrewAvailability.crew_id == current_user.id,
            CrewAvailability.event_id == crew_request.event_id
        ).first()
        if availability:
            availability.is_matched = True
    
    db.commit()
    db.refresh(crew_request)
    return crew_request


# Admin Routes
@app.get("/api/admin/users", response_model=List[schemas.User])
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@app.post("/api/admin/import-calendar", response_model=schemas.ImportResult)
async def import_calendar(
    url: str = Query(default="https://austinyachtclub.net/series-racing-calendar/"),
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    events_data, errors = await import_austin_yacht_club_calendar(url)
    
    imported_events = []
    for event_data in events_data:
        existing = db.query(Event).filter(
            Event.name == event_data['name'],
            Event.date == event_data['date']
        ).first()
        
        if not existing:
            db_event = Event(
                name=event_data['name'],
                date=event_data['date'],
                event_type=event_data.get('event_type', 'race'),
                series=event_data.get('series'),
                external_url=event_data.get('external_url'),
                imported_from=event_data.get('imported_from'),
                created_by_id=current_user.id
            )
            db.add(db_event)
            db.commit()
            db.refresh(db_event)
            imported_events.append(db_event)
    
    return schemas.ImportResult(
        imported_count=len(imported_events),
        events=imported_events,
        errors=errors
    )


@app.get("/api/admin/calendar-preview")
async def preview_calendar(
    url: str = Query(default="https://austinyachtclub.net/series-racing-calendar/"),
    current_user: User = Depends(get_admin_user)
):
    return await fetch_calendar_preview(url)


# Health check
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
