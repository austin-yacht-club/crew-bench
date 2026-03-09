from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, Table
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


class ExperienceLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


event_boats = Table(
    'event_boats',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('events.id'), primary_key=True),
    Column('boat_id', Integer, ForeignKey('boats.id'), primary_key=True)
)


class ContactPreference(str, enum.Enum):
    EMAIL = "email"
    PHONE = "phone"
    EITHER = "either"


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
    profile_picture = Column(Text)  # Base64 encoded profile picture
    allow_email_contact = Column(Boolean, default=True)
    allow_phone_contact = Column(Boolean, default=False)
    contact_preference = Column(String, default=ContactPreference.EMAIL.value)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    boats = relationship("Boat", back_populates="owner")
    crew_requests = relationship("CrewRequest", foreign_keys="CrewRequest.crew_id", back_populates="crew")
    available_for_events = relationship("CrewAvailability", back_populates="crew")


class Fleet(Base):
    __tablename__ = "fleets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    boats = relationship("Boat", back_populates="fleet")


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


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    location = Column(String)
    event_type = Column(String)  # race, regatta, cruise, etc.
    series = Column(String)  # If part of a racing series
    external_url = Column(String)
    imported_from = Column(String)  # Source if imported
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
    boats = relationship("Boat", secondary=event_boats, back_populates="events")
    crew_availabilities = relationship("CrewAvailability", back_populates="event")


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
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)
    
    boat = relationship("Boat", back_populates="crew_requests")
    crew = relationship("User", back_populates="crew_requests")
    event = relationship("Event")
