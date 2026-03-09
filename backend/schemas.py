from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from models import UserRole, ExperienceLevel, RequestStatus


class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: Optional[str] = UserRole.CREW.value
    experience_level: Optional[str] = ExperienceLevel.BEGINNER.value
    bio: Optional[str] = None
    weight: Optional[int] = None
    certifications: Optional[str] = None
    position_preferences: Optional[str] = None
    profile_picture: Optional[str] = None
    allow_email_contact: Optional[bool] = True
    allow_phone_contact: Optional[bool] = False
    allow_sms_contact: Optional[bool] = False
    contact_preference: Optional[str] = "email"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    experience_level: Optional[str] = None
    bio: Optional[str] = None
    weight: Optional[int] = None
    certifications: Optional[str] = None
    position_preferences: Optional[str] = None
    profile_picture: Optional[str] = None
    allow_email_contact: Optional[bool] = None
    allow_phone_contact: Optional[bool] = None
    allow_sms_contact: Optional[bool] = None
    contact_preference: Optional[str] = None


class AdminUserUpdate(UserUpdate):
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    new_password: Optional[str] = None
    must_change_password: Optional[bool] = None


class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    must_change_password: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class FleetBase(BaseModel):
    name: str
    description: Optional[str] = None


class FleetCreate(FleetBase):
    pass


class Fleet(FleetBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class BoatBase(BaseModel):
    name: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    sail_number: Optional[str] = None
    length: Optional[int] = None
    description: Optional[str] = None
    crew_needed: Optional[int] = 3
    fleet_id: Optional[int] = None


class BoatCreate(BoatBase):
    pass


class BoatUpdate(BaseModel):
    name: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    sail_number: Optional[str] = None
    length: Optional[int] = None
    description: Optional[str] = None
    crew_needed: Optional[int] = None
    fleet_id: Optional[int] = None


class Boat(BoatBase):
    id: int
    owner_id: int
    created_at: datetime
    owner: Optional[User] = None
    fleet: Optional[Fleet] = None
    
    class Config:
        from_attributes = True


class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    date: datetime
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    event_type: Optional[str] = None
    series: Optional[str] = None
    series_index: Optional[int] = None
    series_total: Optional[int] = None
    external_url: Optional[str] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    event_type: Optional[str] = None
    series: Optional[str] = None
    series_index: Optional[int] = None
    series_total: Optional[int] = None
    external_url: Optional[str] = None
    is_active: Optional[bool] = None


class Event(EventBase):
    id: int
    is_active: bool
    created_at: datetime
    imported_from: Optional[str] = None
    
    class Config:
        from_attributes = True


class CrewAvailabilityBase(BaseModel):
    event_id: int
    availability_type: Optional[str] = "any"
    notes: Optional[str] = None


class CrewAvailabilityCreate(CrewAvailabilityBase):
    boat_ids: Optional[List[int]] = None
    fleet_ids: Optional[List[int]] = None


class SeriesAvailabilityCreate(BaseModel):
    series: str
    availability_type: Optional[str] = "any"
    boat_ids: Optional[List[int]] = None
    fleet_ids: Optional[List[int]] = None
    notes: Optional[str] = None


class CrewAvailability(CrewAvailabilityBase):
    id: int
    crew_id: int
    is_matched: bool
    created_at: datetime
    crew: Optional[User] = None
    event: Optional[Event] = None
    preferred_boats: Optional[List[Boat]] = []
    preferred_fleets: Optional[List[Fleet]] = []
    
    class Config:
        from_attributes = True


class CrewRequestBase(BaseModel):
    boat_id: int
    crew_id: int
    event_id: int
    message: Optional[str] = None


class CrewRequestCreate(CrewRequestBase):
    waitlist_position: Optional[int] = None  # null = primary, 1+ = waitlist


class SeriesCrewRequestCreate(BaseModel):
    boat_id: int
    crew_id: int
    series: str
    message: Optional[str] = None
    waitlist_position: Optional[int] = None


class CrewRequestResponse(BaseModel):
    status: str
    response_message: Optional[str] = None


class SeriesCrewRequestResponse(BaseModel):
    status: str
    series: str
    response_message: Optional[str] = None


class WithdrawRequest(BaseModel):
    reason: Optional[str] = None


class CrewRequest(CrewRequestBase):
    id: int
    status: str
    response_message: Optional[str] = None
    waitlist_position: Optional[int] = None
    created_at: datetime
    responded_at: Optional[datetime] = None
    boat: Optional[Boat] = None
    crew: Optional[User] = None
    event: Optional[Event] = None
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    must_change_password: bool = False


class TokenData(BaseModel):
    email: Optional[str] = None


class ImportResult(BaseModel):
    imported_count: int
    skipped_count: int = 0
    events: List[Event]
    errors: List[str] = []


class SkipperCommitmentBase(BaseModel):
    boat_id: int
    event_id: int
    notes: Optional[str] = None


class SkipperCommitmentCreate(SkipperCommitmentBase):
    pass


class SkipperCommitmentSeriesCreate(BaseModel):
    boat_id: int
    series: str
    notes: Optional[str] = None


class SkipperCommitment(SkipperCommitmentBase):
    id: int
    skipper_id: int
    is_active: bool
    created_at: datetime
    skipper: Optional[User] = None
    boat: Optional[Boat] = None
    event: Optional[Event] = None
    
    class Config:
        from_attributes = True


class CrewRatingCreate(BaseModel):
    crew_id: int
    event_id: Optional[int] = None
    boat_id: Optional[int] = None
    rating: int  # 1-5
    comment: Optional[str] = None


class CrewRating(CrewRatingCreate):
    id: int
    rater_id: int
    created_at: datetime
    rater: Optional[User] = None
    crew: Optional[User] = None
    event: Optional[Event] = None
    boat: Optional[Boat] = None
    
    class Config:
        from_attributes = True


class CrewRatingSummary(BaseModel):
    crew_id: int
    average_rating: float
    count: int


class BoatRatingCreate(BaseModel):
    boat_id: int
    event_id: Optional[int] = None
    rating: int  # 1-5
    comment: Optional[str] = None


class BoatRating(BoatRatingCreate):
    id: int
    rater_id: int
    created_at: datetime
    rater: Optional[User] = None
    boat: Optional[Boat] = None
    event: Optional[Event] = None
    
    class Config:
        from_attributes = True


class BoatRatingSummary(BaseModel):
    boat_id: int
    average_rating: float
    count: int
