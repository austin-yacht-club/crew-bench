from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from database import Base


class UserRole(str, enum.Enum):
    CREW = "crew"
    SKIPPER = "skipper"
    ADMIN = "admin"


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"


class ExperienceLevel(str, enum.Enum):
    NOVICE = "novice"  # Never sailed before
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


# Race committee jobs. Mark-set is who can manage the mark-set boats.
RC_ROLES = (
    "PRO",
    "Signal boat",
    "Finish boat",
    "Scorer",
    "Safety",
    "Mark-set",
)


def split_rc_roles(value):
    if not value:
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]


def normalize_rc_roles(value):
    """Comma-separated catalog roles, or None when empty.

    Raises ValueError for a role that is not in RC_ROLES.
    """
    if value is None:
        return None
    roles = []
    seen = set()
    for role in split_rc_roles(value):
        if role not in RC_ROLES:
            raise ValueError(f"Unknown race committee role: {role}")
        if role not in seen:
            seen.add(role)
            roles.append(role)
    return ", ".join(roles) or None


event_boats = Table(
    'event_boats',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('events.id'), primary_key=True),
    Column('boat_id', Integer, ForeignKey('boats.id'), primary_key=True)
)


class ContactPreference(str, enum.Enum):
    EMAIL = "email"
    PHONE = "phone"
    SMS = "sms"
    ANY = "any"


class ConversationSource(str, enum.Enum):
    CREW_POOL = "crew_pool"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String)
    role = Column(String, default=UserRole.CREW.value)
    experience_level = Column(String, default=ExperienceLevel.BEGINNER.value)
    bio = Column(Text)
    weight = Column(Integer)  # Important for sailboat balance
    certifications = Column(Text)  # Sailing certifications
    position_preferences = Column(Text)  # Comma-separated: bow, rail, trimmer, pit, helm
    profile_picture = Column(Text)  # Base64 encoded profile picture
    allow_email_contact = Column(Boolean, default=True)
    allow_phone_contact = Column(Boolean, default=False)
    allow_sms_contact = Column(Boolean, default=False)
    contact_preference = Column(String, default=ContactPreference.EMAIL.value)
    crew_pool_email_alerts = Column(Boolean, default=False)
    last_crew_pool_alert_at = Column(DateTime, nullable=True)
    rc_roles = Column(Text)  # Comma-separated RC_ROLES values
    rc_training = Column(Text)
    rc_experience = Column(Text)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    must_change_password = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    boats = relationship("Boat", back_populates="owner")
    crew_requests = relationship("CrewRequest", foreign_keys="CrewRequest.crew_id", back_populates="crew")
    available_for_events = relationship("CrewAvailability", back_populates="crew")
    favorite_boats = relationship("FavoriteBoat", back_populates="user", foreign_keys="FavoriteBoat.user_id")
    crew_interest = relationship("CrewInterest", back_populates="crew", uselist=False)


class Fleet(Base):
    __tablename__ = "fleets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    boats = relationship("Boat", back_populates="fleet")
    organizers = relationship("FleetOrganizer", back_populates="fleet")


class Boat(Base):
    __tablename__ = "boats"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    make = Column(String)  # e.g., "J/24", "Catalina 27"
    model = Column(String)
    year = Column(Integer)
    sail_number = Column(String)
    length = Column(Integer)  # in feet
    description = Column(Text)
    crew_needed = Column(Integer, default=3)
    owner_id = Column(Integer, ForeignKey("users.id"))
    fleet_id = Column(Integer, ForeignKey("fleets.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="boats")
    fleet = relationship("Fleet", back_populates="boats")
    crew_requests = relationship("CrewRequest", back_populates="boat")
    events = relationship("Event", secondary=event_boats, back_populates="boats")
    favorited_by = relationship("FavoriteBoat", back_populates="boat")


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    location = Column(String)
    event_type = Column(String)  # race, regatta, cruise, etc.
    series = Column(String, index=True)  # If part of a racing series
    series_index = Column(Integer)  # Position within series (1, 2, 3...)
    series_total = Column(Integer)  # Total events in series at time of import
    external_url = Column(String)
    imported_from = Column(String)  # Source if imported
    is_active = Column(Boolean, default=True)
    organizing_fleet_id = Column(Integer, ForeignKey("fleets.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
    boats = relationship("Boat", secondary=event_boats, back_populates="events")
    crew_availabilities = relationship("CrewAvailability", back_populates="event")
    organizing_fleet = relationship("Fleet", foreign_keys=[organizing_fleet_id])
    race_committee_assignments = relationship(
        "RaceCommitteeAssignment",
        back_populates="event",
        cascade="all, delete-orphan",
    )


class FleetOrganizer(Base):
    """A person an admin named to staff race committee for one fleet."""
    __tablename__ = "fleet_organizers"
    __table_args__ = (
        UniqueConstraint("fleet_id", "user_id", name="uq_fleet_organizer"),
    )

    id = Column(Integer, primary_key=True, index=True)
    fleet_id = Column(Integer, ForeignKey("fleets.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    fleet = relationship("Fleet", back_populates="organizers")
    user = relationship("User")


class RaceCommitteeAssignment(Base):
    """One person's race-committee offer or duty for one race."""
    __tablename__ = "race_committee_assignments"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_rc_assignment_event_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    preferred_roles = Column(Text)  # Comma-separated roles they offered
    assigned_role = Column(String, nullable=True)
    status = Column(String, default=RequestStatus.PENDING.value, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)

    event = relationship("Event", back_populates="race_committee_assignments")
    user = relationship("User")


class AvailabilityType(str, enum.Enum):
    ANY = "any"
    BOATS = "boats"
    FLEETS = "fleets"


availability_boats = Table(
    'availability_boats',
    Base.metadata,
    Column('availability_id', Integer, ForeignKey('crew_availabilities.id'), primary_key=True),
    Column('boat_id', Integer, ForeignKey('boats.id'), primary_key=True)
)


availability_fleets = Table(
    'availability_fleets',
    Base.metadata,
    Column('availability_id', Integer, ForeignKey('crew_availabilities.id'), primary_key=True),
    Column('fleet_id', Integer, ForeignKey('fleets.id'), primary_key=True)
)


class CrewInterest(Base):
    """Generic crew interest — not tied to a specific event."""
    __tablename__ = "crew_interests"

    id = Column(Integer, primary_key=True, index=True)
    crew_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    patterns = Column(Text)  # comma-separated: saturdays,sundays,weekends,weekdays,flexible
    date_ranges = Column(Text)  # JSON array of {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    crew = relationship("User", back_populates="crew_interest")


class CrewAvailability(Base):
    __tablename__ = "crew_availabilities"
    
    id = Column(Integer, primary_key=True, index=True)
    crew_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    availability_type = Column(String, default=AvailabilityType.ANY.value)
    notes = Column(Text)
    is_matched = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    crew = relationship("User", back_populates="available_for_events")
    event = relationship("Event", back_populates="crew_availabilities")
    preferred_boats = relationship("Boat", secondary=availability_boats)
    preferred_fleets = relationship("Fleet", secondary=availability_fleets)


class CrewRequest(Base):
    __tablename__ = "crew_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    boat_id = Column(Integer, ForeignKey("boats.id"), nullable=False)
    crew_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    status = Column(String, default=RequestStatus.PENDING.value)
    message = Column(Text)
    response_message = Column(Text)
    waitlist_position = Column(Integer, nullable=True)  # null = primary, 1+ = waitlist position
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)
    
    boat = relationship("Boat", back_populates="crew_requests")
    crew = relationship("User", back_populates="crew_requests")
    event = relationship("Event")


class SkipperCommitment(Base):
    __tablename__ = "skipper_commitments"
    
    id = Column(Integer, primary_key=True, index=True)
    skipper_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    boat_id = Column(Integer, ForeignKey("boats.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    skipper = relationship("User")
    boat = relationship("Boat")
    event = relationship("Event")


class CrewRating(Base):
    """Skipper rates crew (viewable by skippers)."""
    __tablename__ = "crew_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    rater_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # skipper
    crew_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    boat_id = Column(Integer, ForeignKey("boats.id"), nullable=True)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    rater = relationship("User", foreign_keys=[rater_id])
    crew = relationship("User", foreign_keys=[crew_id])
    event = relationship("Event")
    boat = relationship("Boat")


class FavoriteBoat(Base):
    """Crew's favorite boats for quick access when marking availability."""
    __tablename__ = "favorite_boats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    boat_id = Column(Integer, ForeignKey("boats.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="favorite_boats")
    boat = relationship("Boat", back_populates="favorited_by")


class BoatRating(Base):
    """Crew rates boat (viewable by crew)."""
    __tablename__ = "boat_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    rater_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # crew
    boat_id = Column(Integer, ForeignKey("boats.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    rater = relationship("User")
    boat = relationship("Boat")
    event = relationship("Event")


class Notification(Base):
    """In-app notification for a user."""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    kind = Column(String, nullable=False)  # crew_request, request_accepted, request_declined, etc.
    title = Column(String, nullable=False)
    body = Column(Text)
    link = Column(String)  # e.g. /requests, /status
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")


class PushSubscription(Base):
    """Web Push subscription for a user (mobile/desktop)."""
    __tablename__ = "push_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")


class Conversation(Base):
    """Direct-message thread between a skipper and crew member."""
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("skipper_id", "crew_id", "source", name="uq_conversation_participants_source"),
    )

    id = Column(Integer, primary_key=True, index=True)
    skipper_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    crew_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source = Column(String, default=ConversationSource.CREW_POOL.value, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    skipper = relationship("User", foreign_keys=[skipper_id])
    crew = relationship("User", foreign_keys=[crew_id])
    messages = relationship("DirectMessage", back_populates="conversation", order_by="DirectMessage.created_at")


class DirectMessage(Base):
    """A single in-app message within a conversation."""
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


class MotdLocation(str, enum.Enum):
    LANDING = "landing"
    LOGIN = "login"
    DASHBOARD = "dashboard"


class Motd(Base):
    """Admin-authored message of the day for a specific surface."""
    __tablename__ = "motds"

    id = Column(Integer, primary_key=True, index=True)
    location = Column(String, unique=True, nullable=False, index=True)
    message = Column(String(280), nullable=False, default="")
    is_active = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    updated_by = relationship("User")


class MotdDismissal(Base):
    """Per-user dismissal of a MOTD version (reappears when the MOTD is updated)."""
    __tablename__ = "motd_dismissals"
    __table_args__ = (
        UniqueConstraint("user_id", "location", name="uq_motd_dismissal_user_location"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    location = Column(String, nullable=False, index=True)
    dismissed_updated_at = Column(DateTime, nullable=False)
    dismissed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
