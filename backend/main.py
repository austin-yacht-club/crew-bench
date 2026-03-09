import logging
import os
import time
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from database import engine, get_db, Base
from log_config import configure_logging

logger = configure_logging("crew_bench")
from models import User, Boat, Event, CrewRequest, CrewAvailability, RequestStatus, Fleet, SkipperCommitment, CrewRating, BoatRating, Notification, PushSubscription, FavoriteBoat
import schemas
from auth import (
    get_password_hash,
    verify_password,
    authenticate_user, 
    create_access_token,
    get_current_active_user,
    get_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from calendar_importer import import_austin_yacht_club_calendar, fetch_calendar_preview
import httpx

Base.metadata.create_all(bind=engine)

RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def _verify_recaptcha(token: Optional[str]) -> bool:
    """Verify reCAPTCHA v2 response token. Returns True if valid or if RECAPTCHA is not configured."""
    secret = os.getenv("RECAPTCHA_SECRET_KEY")
    if not secret:
        return True
    if not token or not token.strip():
        return False
    try:
        with httpx.Client() as client:
            r = client.post(
                RECAPTCHA_VERIFY_URL,
                data={"secret": secret, "response": token},
                timeout=10.0,
            )
            r.raise_for_status()
            data = r.json()
            return data.get("success") is True
    except Exception as e:
        logger.warning("reCAPTCHA verification failed: %s", e)
        return False

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


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log each request: method, path, status code, duration."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        path = request.url.path
        if request.query_params:
            path = f"{path}?{request.query_params}"
        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        logger.log(
            level,
            "%s %s %d %.1fms",
            request.method,
            path,
            response.status_code,
            duration_ms,
        )
        return response


app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log unhandled exceptions with traceback and return 500."""
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


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
            is_admin=True,
            must_change_password=True
        )
        db.add(admin_user)
        db.commit()
        logger.info("Created default admin user: %s", admin_email)
    db.close()


def _create_notification_and_push(
    db: Session,
    user_id: int,
    kind: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
):
    """Create in-app notification and send Web Push to user's subscriptions."""
    notification = Notification(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        link=link,
    )
    db.add(notification)
    db.flush()
    subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    vapid_private = os.getenv("VAPID_PRIVATE_KEY")
    if vapid_private and subscriptions:
        try:
            import json
            from pywebpush import webpush, WebPushException
            payload = json.dumps({"title": title, "body": body or "", "link": link or "/"})
            for sub in subscriptions:
                try:
                    webpush(
                        subscription_info={
                            "endpoint": sub.endpoint,
                            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                        },
                        data=payload,
                        vapid_private_key=vapid_private,
                        vapid_claims={"sub": "mailto:admin@crewbench.app"},
                    )
                except WebPushException as e:
                    logger.debug("Web Push failed for subscription: %s", e)
        except Exception as e:
            logger.warning("Web Push send failed: %s", e)
    return notification


# Auth Routes
@app.post("/api/auth/register", response_model=schemas.User)
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if not _verify_recaptcha(body.captcha_token):
        raise HTTPException(
            status_code=400,
            detail="CAPTCHA verification failed. Please complete the security check and try again.",
        )
    user = body  # RegisterRequest extends UserCreate; exclude captcha_token when building User
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
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "must_change_password": user.must_change_password or False
    }


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


@app.post("/api/auth/change-password")
def change_password(
    password_data: schemas.PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(password_data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully"}


# Notifications
@app.get("/api/notifications", response_model=List[schemas.Notification])
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.read_at == None)
    notifications = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return notifications


@app.get("/api/notifications/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at == None,
    ).count()
    return {"count": count}


@app.put("/api/notifications/{notification_id}/read", response_model=schemas.Notification)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return n


@app.put("/api/notifications/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at == None,
    ).update({Notification.read_at: datetime.utcnow()})
    db.commit()
    return {"message": "All notifications marked as read"}


@app.get("/api/push-subscriptions/vapid-public")
def get_vapid_public_key():
    """Return the VAPID public key for Web Push subscription (used by frontend)."""
    key = os.getenv("VAPID_PUBLIC_KEY")
    if not key:
        return {"publicKey": None}
    return {"publicKey": key}


@app.post("/api/push-subscriptions", response_model=schemas.PushSubscription)
def save_push_subscription(
    data: schemas.PushSubscriptionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    keys = data.keys
    if not keys or "p256dh" not in keys or "auth" not in keys:
        raise HTTPException(status_code=400, detail="Missing p256dh or auth key")
    existing = db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == data.endpoint,
    ).first()
    if existing:
        existing.p256dh = keys["p256dh"]
        existing.auth = keys["auth"]
        db.commit()
        db.refresh(existing)
        return existing
    sub = PushSubscription(
        user_id=current_user.id,
        endpoint=data.endpoint,
        p256dh=keys["p256dh"],
        auth=keys["auth"],
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


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


@app.get("/api/favorite-boats", response_model=List[schemas.Boat])
def list_favorite_boats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List boats the current user has favorited (for quick access when marking availability)."""
    favs = db.query(FavoriteBoat).filter(FavoriteBoat.user_id == current_user.id).all()
    boat_ids = [f.boat_id for f in favs]
    if not boat_ids:
        return []
    boats = db.query(Boat).filter(Boat.id.in_(boat_ids)).all()
    order = {bid: i for i, bid in enumerate(boat_ids)}
    boats.sort(key=lambda b: order.get(b.id, 999))
    return boats


@app.post("/api/favorite-boats", response_model=schemas.Boat)
def add_favorite_boat(
    body: schemas.FavoriteBoatAdd,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    boat = db.query(Boat).filter(Boat.id == body.boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    existing = db.query(FavoriteBoat).filter(
        FavoriteBoat.user_id == current_user.id,
        FavoriteBoat.boat_id == body.boat_id,
    ).first()
    if existing:
        return boat
    fav = FavoriteBoat(user_id=current_user.id, boat_id=body.boat_id)
    db.add(fav)
    db.commit()
    return boat


@app.delete("/api/favorite-boats/{boat_id}")
def remove_favorite_boat(
    boat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    deleted = db.query(FavoriteBoat).filter(
        FavoriteBoat.user_id == current_user.id,
        FavoriteBoat.boat_id == boat_id,
    ).delete()
    db.commit()
    return {"ok": True}


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


# Series Availability Routes
@app.post("/api/availability/series", response_model=List[schemas.CrewAvailability])
def mark_series_availability(
    availability: schemas.SeriesAvailabilityCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark availability for all events in a series at once."""
    # Find all active events in this series
    series_events = db.query(Event).filter(
        Event.series == availability.series,
        Event.is_active == True
    ).order_by(Event.date).all()
    
    if not series_events:
        raise HTTPException(status_code=404, detail=f"No events found for series: {availability.series}")
    
    created_availabilities = []
    
    # Get preferred boats and fleets if specified
    preferred_boats = []
    preferred_fleets = []
    if availability.boat_ids and availability.availability_type == "boats":
        preferred_boats = db.query(Boat).filter(Boat.id.in_(availability.boat_ids)).all()
    if availability.fleet_ids and availability.availability_type == "fleets":
        preferred_fleets = db.query(Fleet).filter(Fleet.id.in_(availability.fleet_ids)).all()
    
    for event in series_events:
        # Check if already marked for this event
        existing = db.query(CrewAvailability).filter(
            CrewAvailability.crew_id == current_user.id,
            CrewAvailability.event_id == event.id
        ).first()
        
        if existing:
            continue
        
        db_availability = CrewAvailability(
            crew_id=current_user.id,
            event_id=event.id,
            availability_type=availability.availability_type or "any",
            notes=availability.notes
        )
        db_availability.preferred_boats = preferred_boats
        db_availability.preferred_fleets = preferred_fleets
        
        db.add(db_availability)
        db.commit()
        db.refresh(db_availability)
        created_availabilities.append(db_availability)
    
    return created_availabilities


@app.get("/api/series", response_model=List[str])
def list_series(
    upcoming_only: bool = False,
    db: Session = Depends(get_db)
):
    """List all unique series names."""
    query = db.query(Event.series).filter(
        Event.series.isnot(None),
        Event.is_active == True
    ).distinct()
    
    if upcoming_only:
        query = query.filter(Event.date >= datetime.utcnow())
    
    series_names = [s[0] for s in query.all() if s[0]]
    return sorted(series_names)


@app.get("/api/series/{series_name}/events", response_model=List[schemas.Event])
def get_series_events(
    series_name: str,
    db: Session = Depends(get_db)
):
    """Get all events in a series."""
    events = db.query(Event).filter(
        Event.series == series_name,
        Event.is_active == True
    ).order_by(Event.date).all()
    return events


# Skipper Commitment Routes
@app.post("/api/skipper-commitments", response_model=schemas.SkipperCommitment)
def create_skipper_commitment(
    commitment: schemas.SkipperCommitmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Commit to sailing your own boat for an event (no crew request needed)."""
    boat = db.query(Boat).filter(Boat.id == commitment.boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    if boat.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only commit to sailing your own boats")
    
    event = db.query(Event).filter(Event.id == commitment.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    existing = db.query(SkipperCommitment).filter(
        SkipperCommitment.skipper_id == current_user.id,
        SkipperCommitment.boat_id == commitment.boat_id,
        SkipperCommitment.event_id == commitment.event_id,
        SkipperCommitment.is_active == True
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already committed to this event with this boat")
    
    db_commitment = SkipperCommitment(
        skipper_id=current_user.id,
        boat_id=commitment.boat_id,
        event_id=commitment.event_id,
        notes=commitment.notes
    )
    db.add(db_commitment)
    db.commit()
    db.refresh(db_commitment)
    return db_commitment


@app.post("/api/skipper-commitments/series", response_model=List[schemas.SkipperCommitment])
def create_skipper_commitment_for_series(
    commitment: schemas.SkipperCommitmentSeriesCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Commit to sailing your own boat for all events in a series."""
    boat = db.query(Boat).filter(Boat.id == commitment.boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    if boat.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only commit to sailing your own boats")
    
    events = db.query(Event).filter(
        Event.series == commitment.series,
        Event.is_active == True,
        Event.date >= datetime.utcnow()
    ).all()
    
    if not events:
        raise HTTPException(status_code=404, detail="No upcoming events found in this series")
    
    created = []
    for event in events:
        existing = db.query(SkipperCommitment).filter(
            SkipperCommitment.skipper_id == current_user.id,
            SkipperCommitment.boat_id == commitment.boat_id,
            SkipperCommitment.event_id == event.id,
            SkipperCommitment.is_active == True
        ).first()
        
        if not existing:
            db_commitment = SkipperCommitment(
                skipper_id=current_user.id,
                boat_id=commitment.boat_id,
                event_id=event.id,
                notes=commitment.notes
            )
            db.add(db_commitment)
            created.append(db_commitment)
    
    db.commit()
    for c in created:
        db.refresh(c)
    return created


@app.get("/api/skipper-commitments/my", response_model=List[schemas.SkipperCommitment])
def get_my_skipper_commitments(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all skipper commitments for the current user."""
    commitments = db.query(SkipperCommitment).options(
        joinedload(SkipperCommitment.boat),
        joinedload(SkipperCommitment.event)
    ).filter(
        SkipperCommitment.skipper_id == current_user.id,
        SkipperCommitment.is_active == True
    ).all()
    return commitments


@app.delete("/api/skipper-commitments/{commitment_id}")
def cancel_skipper_commitment(
    commitment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a skipper commitment."""
    commitment = db.query(SkipperCommitment).filter(
        SkipperCommitment.id == commitment_id
    ).first()
    
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")
    if commitment.skipper_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    commitment.is_active = False
    db.commit()
    return {"message": "Commitment cancelled"}


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
    db.flush()
    event = db.query(Event).filter(Event.id == request.event_id).first()
    if event and boat.owner:
        _create_notification_and_push(
            db,
            user_id=request.crew_id,
            kind="crew_request",
            title="Crew request",
            body=f"{current_user.name} invited you to crew on {boat.name} for {event.name}",
            link="/requests",
        )
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
    
    # If declined and this was a primary request, promote next waitlisted crew
    if response.status == RequestStatus.DECLINED.value and crew_request.waitlist_position is None:
        next_waitlisted = db.query(CrewRequest).filter(
            CrewRequest.boat_id == crew_request.boat_id,
            CrewRequest.event_id == crew_request.event_id,
            CrewRequest.waitlist_position != None,
            CrewRequest.status == RequestStatus.PENDING.value
        ).order_by(CrewRequest.waitlist_position).first()
        
        if next_waitlisted:
            # Promote from waitlist to primary
            next_waitlisted.waitlist_position = None
            # Reorder remaining waitlist
            remaining = db.query(CrewRequest).filter(
                CrewRequest.boat_id == crew_request.boat_id,
                CrewRequest.event_id == crew_request.event_id,
                CrewRequest.waitlist_position != None,
                CrewRequest.status == RequestStatus.PENDING.value
            ).order_by(CrewRequest.waitlist_position).all()
            for i, req in enumerate(remaining, start=1):
                req.waitlist_position = i
    
    boat = db.query(Boat).filter(Boat.id == crew_request.boat_id).first()
    event = db.query(Event).filter(Event.id == crew_request.event_id).first()
    if boat and boat.owner_id and event:
        if response.status == RequestStatus.ACCEPTED.value:
            _create_notification_and_push(
                db,
                user_id=boat.owner_id,
                kind="request_accepted",
                title="Crew request accepted",
                body=f"{current_user.name} accepted your invitation to crew on {boat.name} for {event.name}",
                link="/status",
            )
        else:
            _create_notification_and_push(
                db,
                user_id=boat.owner_id,
                kind="request_declined",
                title="Crew request declined",
                body=f"{current_user.name} declined your invitation for {event.name}",
                link="/requests",
            )
    
    db.commit()
    db.refresh(crew_request)
    return crew_request


@app.get("/api/crew-requests/waitlist/{boat_id}/{event_id}", response_model=List[schemas.CrewRequest])
def get_waitlist(
    boat_id: int,
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the waitlist for a specific boat/event combination."""
    boat = db.query(Boat).filter(Boat.id == boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    if boat.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this waitlist")
    
    waitlist = db.query(CrewRequest).options(
        joinedload(CrewRequest.crew),
        joinedload(CrewRequest.event)
    ).filter(
        CrewRequest.boat_id == boat_id,
        CrewRequest.event_id == event_id,
        CrewRequest.waitlist_position != None,
        CrewRequest.status == RequestStatus.PENDING.value
    ).order_by(CrewRequest.waitlist_position).all()
    
    return waitlist


@app.get("/api/crew-requests/next-waitlist-position/{boat_id}/{event_id}")
def get_next_waitlist_position(
    boat_id: int,
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the next available waitlist position for a boat/event."""
    max_position = db.query(CrewRequest).filter(
        CrewRequest.boat_id == boat_id,
        CrewRequest.event_id == event_id,
        CrewRequest.waitlist_position != None
    ).count()
    
    return {"next_position": max_position + 1}


# Withdrawal Routes
@app.put("/api/crew-requests/{request_id}/withdraw", response_model=schemas.CrewRequest)
def withdraw_from_request(
    request_id: int,
    withdraw_data: schemas.WithdrawRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Withdraw from an accepted crew request.
    Can be called by either the crew member or the boat owner (skipper).
    When withdrawn, the crew member is marked as available again for that event.
    """
    crew_request = db.query(CrewRequest).options(
        joinedload(CrewRequest.boat)
    ).filter(CrewRequest.id == request_id).first()
    
    if not crew_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if crew_request.status != RequestStatus.ACCEPTED.value:
        raise HTTPException(status_code=400, detail="Can only withdraw from accepted requests")
    
    # Check authorization - either the crew member or the boat owner can withdraw
    is_crew = crew_request.crew_id == current_user.id
    is_skipper = crew_request.boat and crew_request.boat.owner_id == current_user.id
    
    if not is_crew and not is_skipper and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to withdraw from this request")
    
    # Update the request status
    crew_request.status = RequestStatus.WITHDRAWN.value
    
    # Record who withdrew and why
    withdrawer = "Crew" if is_crew else "Skipper"
    reason = withdraw_data.reason or "No reason provided"
    crew_request.response_message = f"Withdrawn by {withdrawer}: {reason}"
    crew_request.responded_at = datetime.utcnow()
    
    # Mark crew as available again for this event
    availability = db.query(CrewAvailability).filter(
        CrewAvailability.crew_id == crew_request.crew_id,
        CrewAvailability.event_id == crew_request.event_id
    ).first()
    
    if availability:
        availability.is_matched = False
    
    db.commit()
    db.refresh(crew_request)
    return crew_request


# Crew Ratings (skippers rate crew; viewable by skippers)
@app.post("/api/crew-ratings", response_model=schemas.CrewRating)
def create_crew_rating(
    data: schemas.CrewRatingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Skipper rates a crew member (must have sailed with them as skipper)."""
    if not data.boat_id and not current_user.is_admin:
        raise HTTPException(status_code=400, detail="boat_id is required")
    boat = db.query(Boat).filter(Boat.id == data.boat_id).first() if data.boat_id else None
    if data.boat_id and (not boat or (boat.owner_id != current_user.id and not current_user.is_admin)):
        raise HTTPException(status_code=403, detail="You can only rate crew from your own boat")
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    if data.crew_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot rate yourself")
    # Optionally require they had an accepted request together
    existing = db.query(CrewRating).filter(
        CrewRating.rater_id == current_user.id,
        CrewRating.crew_id == data.crew_id,
        CrewRating.event_id == data.event_id,
        CrewRating.boat_id == data.boat_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already rated this crew for this event/boat")
    rating = CrewRating(
        rater_id=current_user.id,
        crew_id=data.crew_id,
        event_id=data.event_id,
        boat_id=data.boat_id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


@app.get("/api/crew-ratings/summary/{crew_id}", response_model=schemas.CrewRatingSummary)
def get_crew_rating_summary(
    crew_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get average rating and count for a crew member. Skippers and admins only."""
    if current_user.role != "skipper" and current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only skippers can view crew ratings")
    from sqlalchemy import func
    row = db.query(
        func.avg(CrewRating.rating).label("avg"),
        func.count(CrewRating.id).label("count")
    ).filter(CrewRating.crew_id == crew_id).first()
    return schemas.CrewRatingSummary(
        crew_id=crew_id,
        average_rating=round(float(row.avg or 0), 1),
        count=int(row.count or 0)
    )


@app.get("/api/crew-ratings/for-crew/{crew_id}", response_model=List[schemas.CrewRating])
def get_crew_ratings(
    crew_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List ratings for a crew member. Skippers and admins only."""
    if current_user.role != "skipper" and current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only skippers can view crew ratings")
    ratings = db.query(CrewRating).options(
        joinedload(CrewRating.rater),
        joinedload(CrewRating.event),
        joinedload(CrewRating.boat)
    ).filter(CrewRating.crew_id == crew_id).order_by(CrewRating.created_at.desc()).all()
    return ratings


@app.get("/api/crew-ratings/summaries", response_model=List[schemas.CrewRatingSummary])
def get_crew_rating_summaries(
    crew_ids: str = Query(..., description="Comma-separated crew IDs"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get rating summaries for multiple crew. Skippers and admins only."""
    if current_user.role != "skipper" and current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only skippers can view crew ratings")
    from sqlalchemy import func
    ids = [int(x) for x in crew_ids.split(",") if x.strip()]
    if not ids:
        return []
    rows = db.query(
        CrewRating.crew_id,
        func.avg(CrewRating.rating).label("avg"),
        func.count(CrewRating.id).label("count")
    ).filter(CrewRating.crew_id.in_(ids)).group_by(CrewRating.crew_id).all()
    by_id = {r.crew_id: schemas.CrewRatingSummary(crew_id=r.crew_id, average_rating=round(float(r.avg), 1), count=int(r.count)) for r in rows}
    return [by_id.get(i, schemas.CrewRatingSummary(crew_id=i, average_rating=0.0, count=0)) for i in ids]


# Boat Ratings (crew rate boats; viewable by crew)
@app.post("/api/boat-ratings", response_model=schemas.BoatRating)
def create_boat_rating(
    data: schemas.BoatRatingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Crew rates a boat (should have sailed on it)."""
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    existing = db.query(BoatRating).filter(
        BoatRating.rater_id == current_user.id,
        BoatRating.boat_id == data.boat_id,
        BoatRating.event_id == data.event_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already rated this boat for this event")
    rating = BoatRating(
        rater_id=current_user.id,
        boat_id=data.boat_id,
        event_id=data.event_id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


@app.get("/api/boat-ratings/summary/{boat_id}", response_model=schemas.BoatRatingSummary)
def get_boat_rating_summary(
    boat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get average rating and count for a boat. Crew and admins can view."""
    if current_user.role != "crew" and current_user.role != "skipper" and current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only crew can view boat ratings")
    from sqlalchemy import func
    row = db.query(
        func.avg(BoatRating.rating).label("avg"),
        func.count(BoatRating.id).label("count")
    ).filter(BoatRating.boat_id == boat_id).first()
    return schemas.BoatRatingSummary(
        boat_id=boat_id,
        average_rating=round(float(row.avg or 0), 1),
        count=int(row.count or 0)
    )


@app.get("/api/boat-ratings/for-boat/{boat_id}", response_model=List[schemas.BoatRating])
def get_boat_ratings(
    boat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List ratings for a boat. Crew and admins can view."""
    if current_user.role != "crew" and current_user.role != "skipper" and current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only crew can view boat ratings")
    ratings = db.query(BoatRating).options(
        joinedload(BoatRating.rater),
        joinedload(BoatRating.event)
    ).filter(BoatRating.boat_id == boat_id).order_by(BoatRating.created_at.desc()).all()
    return ratings


@app.get("/api/boat-ratings/summaries", response_model=List[schemas.BoatRatingSummary])
def get_boat_rating_summaries(
    boat_ids: str = Query(..., description="Comma-separated boat IDs"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get rating summaries for multiple boats. Crew and admins can view."""
    if current_user.role != "crew" and current_user.role != "skipper" and current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only crew can view boat ratings")
    from sqlalchemy import func
    ids = [int(x) for x in boat_ids.split(",") if x.strip()]
    if not ids:
        return []
    rows = db.query(
        BoatRating.boat_id,
        func.avg(BoatRating.rating).label("avg"),
        func.count(BoatRating.id).label("count")
    ).filter(BoatRating.boat_id.in_(ids)).group_by(BoatRating.boat_id).all()
    by_id = {r.boat_id: schemas.BoatRatingSummary(boat_id=r.boat_id, average_rating=round(float(r.avg), 1), count=int(r.count)) for r in rows}
    return [by_id.get(i, schemas.BoatRatingSummary(boat_id=i, average_rating=0.0, count=0)) for i in ids]


# Series Crew Request Routes
@app.post("/api/crew-requests/series", response_model=List[schemas.CrewRequest])
def create_series_crew_request(
    request: schemas.SeriesCrewRequestCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create crew requests for all events in a series at once."""
    boat = db.query(Boat).filter(Boat.id == request.boat_id).first()
    if not boat:
        raise HTTPException(status_code=404, detail="Boat not found")
    if boat.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You can only request crew for your own boat")
    
    # Find all events in the series
    series_events = db.query(Event).filter(
        Event.series == request.series,
        Event.is_active == True,
        Event.date >= datetime.utcnow()
    ).order_by(Event.date).all()
    
    if not series_events:
        raise HTTPException(status_code=404, detail=f"No upcoming events found for series: {request.series}")
    
    created_requests = []
    
    for event in series_events:
        # Check if request already exists for this event
        existing = db.query(CrewRequest).filter(
            CrewRequest.boat_id == request.boat_id,
            CrewRequest.crew_id == request.crew_id,
            CrewRequest.event_id == event.id,
            CrewRequest.status == RequestStatus.PENDING.value
        ).first()
        
        if existing:
            continue
        
        db_request = CrewRequest(
            boat_id=request.boat_id,
            crew_id=request.crew_id,
            event_id=event.id,
            message=request.message
        )
        db.add(db_request)
        db.commit()
        db.refresh(db_request)
        created_requests.append(db_request)
    
    return created_requests


@app.put("/api/crew-requests/series/respond", response_model=List[schemas.CrewRequest])
def respond_to_series_requests(
    response: schemas.SeriesCrewRequestResponse,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Respond to all pending crew requests for a series from the same boat."""
    # Find all pending requests for this crew in the specified series
    pending_requests = db.query(CrewRequest).join(Event).filter(
        CrewRequest.crew_id == current_user.id,
        CrewRequest.status == RequestStatus.PENDING.value,
        Event.series == response.series
    ).all()
    
    if not pending_requests:
        raise HTTPException(status_code=404, detail=f"No pending requests found for series: {response.series}")
    
    updated_requests = []
    
    for crew_request in pending_requests:
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
        updated_requests.append(crew_request)
    
    return updated_requests


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


@app.put("/api/admin/users/{user_id}", response_model=schemas.User)
def admin_update_user(
    user_id: int,
    user_update: schemas.AdminUserUpdate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Handle password separately - hash it before saving
    if 'new_password' in update_data:
        new_password = update_data.pop('new_password')
        if new_password:
            if len(new_password) < 8:
                raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
            user.hashed_password = get_password_hash(new_password)
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/admin/import-calendar", response_model=schemas.ImportResult)
async def import_calendar(
    url: str = Query(default="https://austinyachtclub.net/series-racing-calendar/"),
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    events_data, errors = await import_austin_yacht_club_calendar(url)
    
    imported_events = []
    skipped_count = 0
    
    for event_data in events_data:
        # Check for duplicates using multiple criteria
        # Primary check: same imported_from URL + same date + same series + same series_index
        # Secondary check: same name + same date (for manually created events)
        existing = None
        
        if event_data.get('series') and event_data.get('series_index'):
            existing = db.query(Event).filter(
                Event.imported_from == event_data.get('imported_from'),
                Event.series == event_data.get('series'),
                Event.series_index == event_data.get('series_index')
            ).first()
        
        if not existing:
            existing = db.query(Event).filter(
                Event.name == event_data['name'],
                Event.date == event_data['date']
            ).first()
        
        if existing:
            skipped_count += 1
            continue
        
        db_event = Event(
            name=event_data['name'],
            date=event_data['date'],
            event_type=event_data.get('event_type', 'race'),
            series=event_data.get('series'),
            series_index=event_data.get('series_index'),
            series_total=event_data.get('series_total'),
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
        skipped_count=skipped_count,
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
