"""Race committee volunteering and fleet staffing."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

import schemas
from auth import get_admin_user, get_current_active_user, get_optional_user
from database import get_db
from models import (
    RC_ROLES,
    CrewRequest,
    Event,
    Fleet,
    FleetOrganizer,
    RaceCommitteeAssignment,
    RequestStatus,
    SkipperCommitment,
    User,
    normalize_rc_roles,
    split_rc_roles,
)

router = APIRouter()

PENDING = RequestStatus.PENDING.value
ACCEPTED = RequestStatus.ACCEPTED.value
DECLINED = RequestStatus.DECLINED.value
WITHDRAWN = RequestStatus.WITHDRAWN.value


def _notify(db: Session, user_id: int, kind: str, title: str, body: str):
    from main import _create_notification_and_push

    _create_notification_and_push(
        db,
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        link="/status",
    )


def _event_or_404(db: Session, event_id: int) -> Event:
    event = (
        db.query(Event)
        .options(joinedload(Event.organizing_fleet))
        .filter(Event.id == event_id, Event.is_active == True)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _require_upcoming(event: Event):
    if event.date <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="This race has already started")


def _can_staff(db: Session, user: User, event: Event) -> bool:
    """Fleet RC leads, and the PRO accepted on this race, can staff it."""
    if event.organizing_fleet_id:
        lead = (
            db.query(FleetOrganizer)
            .filter(
                FleetOrganizer.fleet_id == event.organizing_fleet_id,
                FleetOrganizer.user_id == user.id,
            )
            .first()
        )
        if lead:
            return True
    assigned_pro = (
        db.query(RaceCommitteeAssignment)
        .filter(
            RaceCommitteeAssignment.event_id == event.id,
            RaceCommitteeAssignment.user_id == user.id,
            RaceCommitteeAssignment.assigned_role == "PRO",
            RaceCommitteeAssignment.status == ACCEPTED,
        )
        .first()
    )
    return assigned_pro is not None


def _require_staff(db: Session, user: User, event: Event):
    if not _can_staff(db, user, event):
        raise HTTPException(
            status_code=403,
            detail="Only this fleet's RC leads, or the PRO assigned to this race, can staff the committee",
        )


def _same_day_sailing(db: Session, user_id: int, event: Event) -> bool:
    target = event.date.date()
    crew = (
        db.query(CrewRequest.id)
        .join(Event, CrewRequest.event_id == Event.id)
        .filter(
            CrewRequest.crew_id == user_id,
            CrewRequest.status == ACCEPTED,
            func.date(Event.date) == target,
        )
        .first()
    )
    if crew:
        return True
    commitment = (
        db.query(SkipperCommitment.id)
        .join(Event, SkipperCommitment.event_id == Event.id)
        .filter(
            SkipperCommitment.skipper_id == user_id,
            SkipperCommitment.is_active == True,
            func.date(Event.date) == target,
        )
        .first()
    )
    return commitment is not None


def _person_payload(db: Session, row: RaceCommitteeAssignment, event: Event, include_private: bool) -> dict:
    user = row.user
    payload = {
        "id": row.id,
        "event_id": row.event_id,
        "user_id": row.user_id,
        "user_name": user.name if user else "",
        "preferred_roles": split_rc_roles(row.preferred_roles),
        "assigned_role": row.assigned_role,
        "status": row.status,
        "notes": row.notes if include_private else None,
        "rc_training": user.rc_training if include_private and user else None,
        "rc_experience": user.rc_experience if include_private and user else None,
        "profile_roles": split_rc_roles(user.rc_roles) if include_private and user else [],
        "same_day_sailing": _same_day_sailing(db, row.user_id, event) if include_private else False,
        "created_at": row.created_at,
    }
    return payload


def _load_assignments(db: Session, event_id: int) -> List[RaceCommitteeAssignment]:
    return (
        db.query(RaceCommitteeAssignment)
        .options(joinedload(RaceCommitteeAssignment.user))
        .filter(RaceCommitteeAssignment.event_id == event_id)
        .order_by(RaceCommitteeAssignment.created_at)
        .all()
    )


def _check_role(role: str) -> str:
    try:
        normalized = normalize_rc_roles(role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not normalized or normalized not in RC_ROLES:
        raise HTTPException(status_code=400, detail="Unknown race committee role")
    return normalized


def _notify_assignee(db: Session, event: Event, user: User, role: str, invited: bool):
    if invited:
        title = "Race committee request"
        body = f"{event.name}: please serve as {role}."
    else:
        title = "Race committee assignment"
        body = f"{event.name}: you are assigned as {role}."
    _notify(db, user.id, "rc_assigned", title, body)


def _notify_accepted(db: Session, event: Event, assignee: User, role: str):
    _notify(
        db,
        assignee.id,
        "rc_accepted",
        "Race committee accepted",
        f"You are on the race committee as {role} for {event.name}.",
    )
    recipient_ids = set()
    if event.organizing_fleet_id:
        leads = (
            db.query(FleetOrganizer.user_id)
            .filter(FleetOrganizer.fleet_id == event.organizing_fleet_id)
            .all()
        )
        recipient_ids.update(lead_id for (lead_id,) in leads)
    pros = (
        db.query(RaceCommitteeAssignment.user_id)
        .filter(
            RaceCommitteeAssignment.event_id == event.id,
            RaceCommitteeAssignment.assigned_role == "PRO",
            RaceCommitteeAssignment.status == ACCEPTED,
        )
        .all()
    )
    recipient_ids.update(pro_id for (pro_id,) in pros)
    recipient_ids.discard(assignee.id)
    for user_id in recipient_ids:
        _notify(
            db,
            user_id,
            "rc_accepted",
            "Race committee accepted",
            f"{assignee.name} accepted {role} for {event.name}.",
        )


@router.get("/api/events/{event_id}/race-committee", response_model=schemas.RaceCommitteeBoard)
def get_race_committee(
    event_id: int,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    event = _event_or_404(db, event_id)
    can_staff = bool(current_user and _can_staff(db, current_user, event))
    rows = _load_assignments(db, event.id)
    my_assignment = None
    visible = []
    for row in rows:
        is_mine = bool(current_user and row.user_id == current_user.id)
        if can_staff or (is_mine and row.status in (PENDING, ACCEPTED)):
            payload = _person_payload(db, row, event, include_private=can_staff or is_mine)
            visible.append(payload)
            if is_mine and row.status in (PENDING, ACCEPTED):
                my_assignment = payload
        elif row.status == ACCEPTED:
            visible.append(_person_payload(db, row, event, include_private=False))
    return {
        "event_id": event.id,
        "organizing_fleet_id": event.organizing_fleet_id,
        "organizing_fleet_name": event.organizing_fleet.name if event.organizing_fleet else None,
        "can_staff": can_staff,
        "my_assignment": my_assignment,
        "assignments": visible,
    }


@router.get("/api/race-committee/my", response_model=List[schemas.MyRaceCommitteeDuty])
def my_race_committee(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(RaceCommitteeAssignment)
        .options(
            joinedload(RaceCommitteeAssignment.event).joinedload(Event.organizing_fleet)
        )
        .filter(
            RaceCommitteeAssignment.user_id == current_user.id,
            RaceCommitteeAssignment.status.in_([PENDING, ACCEPTED]),
        )
        .all()
    )
    rows.sort(key=lambda row: row.event.date if row.event else datetime.max)
    duties = []
    for row in rows:
        event = row.event
        if not event:
            continue
        duties.append({
            "id": row.id,
            "event_id": event.id,
            "event_name": event.name,
            "event_date": event.date,
            "fleet_name": event.organizing_fleet.name if event.organizing_fleet else None,
            "preferred_roles": split_rc_roles(row.preferred_roles),
            "assigned_role": row.assigned_role,
            "status": row.status,
            "notes": row.notes,
        })
    return duties


@router.post("/api/events/{event_id}/race-committee/volunteer", response_model=schemas.RaceCommitteePerson)
def volunteer_race_committee(
    event_id: int,
    body: schemas.RaceCommitteeVolunteerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    event = _event_or_404(db, event_id)
    _require_upcoming(event)
    profile_roles = split_rc_roles(current_user.rc_roles)
    if not profile_roles or not (current_user.rc_training or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Add at least one race committee role and your training on your profile first",
        )
    chosen = []
    for role in body.preferred_roles:
        try:
            normalized = normalize_rc_roles(role)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if normalized not in profile_roles:
            raise HTTPException(
                status_code=400,
                detail=f"{normalized} is not on your race committee profile",
            )
        if normalized not in chosen:
            chosen.append(normalized)
    if not chosen:
        raise HTTPException(status_code=400, detail="Choose at least one role")

    row = (
        db.query(RaceCommitteeAssignment)
        .options(joinedload(RaceCommitteeAssignment.user))
        .filter(
            RaceCommitteeAssignment.event_id == event.id,
            RaceCommitteeAssignment.user_id == current_user.id,
        )
        .first()
    )
    if row and row.status == ACCEPTED:
        raise HTTPException(
            status_code=400,
            detail="Withdraw your assignment before volunteering again",
        )
    if row and row.status == PENDING and row.assigned_role:
        raise HTTPException(
            status_code=400,
            detail="You already have a race committee invitation for this race",
        )
    if row is None:
        row = RaceCommitteeAssignment(
            event_id=event.id,
            user_id=current_user.id,
            status=PENDING,
        )
        db.add(row)
    row.preferred_roles = ", ".join(chosen)
    row.assigned_role = None
    row.status = PENDING
    row.notes = (body.notes or "").strip() or None
    row.responded_at = None
    db.commit()
    db.refresh(row)
    row.user = current_user
    return _person_payload(db, row, event, include_private=True)


@router.post("/api/events/{event_id}/race-committee/assign", response_model=schemas.RaceCommitteePerson)
def assign_race_committee(
    event_id: int,
    body: schemas.RaceCommitteeAssign,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    event = _event_or_404(db, event_id)
    _require_upcoming(event)
    _require_staff(db, current_user, event)
    role = _check_role(body.assigned_role)
    target = db.query(User).filter(User.id == body.user_id, User.is_active == True).first()
    if not target:
        raise HTTPException(status_code=404, detail="Person not found")
    if role not in split_rc_roles(target.rc_roles):
        raise HTTPException(
            status_code=400,
            detail="That person has not listed this role on their profile",
        )

    row = (
        db.query(RaceCommitteeAssignment)
        .options(joinedload(RaceCommitteeAssignment.user))
        .filter(
            RaceCommitteeAssignment.event_id == event.id,
            RaceCommitteeAssignment.user_id == target.id,
        )
        .first()
    )
    invited = True
    if row is None:
        row = RaceCommitteeAssignment(
            event_id=event.id,
            user_id=target.id,
            preferred_roles=target.rc_roles,
            assigned_role=role,
            status=PENDING,
        )
        db.add(row)
    elif row.status == PENDING and not row.assigned_role:
        row.assigned_role = role
        row.status = ACCEPTED
        row.responded_at = datetime.utcnow()
        invited = False
    elif row.status == ACCEPTED:
        row.assigned_role = role
        invited = False
    else:
        row.assigned_role = role
        row.status = PENDING
        row.responded_at = None
        if not row.preferred_roles:
            row.preferred_roles = target.rc_roles
        invited = True
    db.commit()
    db.refresh(row)
    row.user = target
    _notify_assignee(db, event, target, role, invited=invited)
    db.commit()
    return _person_payload(db, row, event, include_private=True)


@router.get(
    "/api/events/{event_id}/race-committee/candidates",
    response_model=List[schemas.RaceCommitteeCandidate],
)
def race_committee_candidates(
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    event = _event_or_404(db, event_id)
    _require_staff(db, current_user, event)
    users = (
        db.query(User)
        .filter(User.is_active == True, User.rc_roles.isnot(None), User.rc_roles != "")
        .order_by(User.name)
        .all()
    )
    candidates = []
    for user in users:
        roles = split_rc_roles(user.rc_roles)
        if not roles:
            continue
        candidates.append({
            "id": user.id,
            "name": user.name,
            "rc_roles": roles,
            "rc_training": user.rc_training,
            "rc_experience": user.rc_experience,
            "same_day_sailing": _same_day_sailing(db, user.id, event),
        })
    return candidates


def _assignment_or_404(db: Session, assignment_id: int) -> RaceCommitteeAssignment:
    row = (
        db.query(RaceCommitteeAssignment)
        .options(
            joinedload(RaceCommitteeAssignment.user),
            joinedload(RaceCommitteeAssignment.event).joinedload(Event.organizing_fleet),
        )
        .filter(RaceCommitteeAssignment.id == assignment_id)
        .first()
    )
    if not row or not row.event or not row.event.is_active:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return row


@router.post("/api/race-committee/{assignment_id}/accept", response_model=schemas.RaceCommitteePerson)
def accept_race_committee(
    assignment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = _assignment_or_404(db, assignment_id)
    if row.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invitation is not yours")
    _require_upcoming(row.event)
    if row.status != PENDING or not row.assigned_role:
        raise HTTPException(status_code=400, detail="There is no race committee invitation to accept")
    row.status = ACCEPTED
    row.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    _notify_accepted(db, row.event, current_user, row.assigned_role)
    db.commit()
    return _person_payload(db, row, row.event, include_private=True)


@router.post("/api/race-committee/{assignment_id}/decline", response_model=schemas.RaceCommitteePerson)
def decline_race_committee(
    assignment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = _assignment_or_404(db, assignment_id)
    event = row.event
    is_assignee = row.user_id == current_user.id
    is_staff = _can_staff(db, current_user, event)
    if is_assignee and not is_staff:
        if row.status != PENDING or not row.assigned_role:
            raise HTTPException(status_code=400, detail="There is no race committee invitation to decline")
    elif is_staff:
        if row.status not in (PENDING, ACCEPTED):
            raise HTTPException(status_code=400, detail="That assignment is not active")
    else:
        raise HTTPException(status_code=403, detail="You cannot decline this assignment")
    _require_upcoming(event)
    row.status = DECLINED
    row.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _person_payload(db, row, event, include_private=is_staff or is_assignee)


@router.post("/api/race-committee/{assignment_id}/withdraw", response_model=schemas.RaceCommitteePerson)
def withdraw_race_committee(
    assignment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = _assignment_or_404(db, assignment_id)
    if row.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only withdraw your own race committee duty")
    _require_upcoming(row.event)
    if row.status not in (PENDING, ACCEPTED):
        raise HTTPException(status_code=400, detail="There is nothing to withdraw")
    row.status = WITHDRAWN
    row.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _person_payload(db, row, row.event, include_private=True)


@router.get("/api/admin/fleet-organizers", response_model=List[schemas.FleetOrganizerOut])
def list_fleet_organizers(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(FleetOrganizer)
        .options(joinedload(FleetOrganizer.fleet), joinedload(FleetOrganizer.user))
        .order_by(FleetOrganizer.id)
        .all()
    )
    return [
        {
            "id": row.id,
            "fleet_id": row.fleet_id,
            "fleet_name": row.fleet.name if row.fleet else "",
            "user_id": row.user_id,
            "user_name": row.user.name if row.user else "",
            "user_email": row.user.email if row.user else "",
        }
        for row in rows
    ]


@router.post("/api/admin/fleets/{fleet_id}/organizers", response_model=schemas.FleetOrganizerOut)
def add_fleet_organizer(
    fleet_id: int,
    body: schemas.FleetOrganizerCreate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet not found")
    user = db.query(User).filter(User.id == body.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Person not found")
    existing = (
        db.query(FleetOrganizer)
        .filter(FleetOrganizer.fleet_id == fleet.id, FleetOrganizer.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="That person is already an RC lead for this fleet")
    row = FleetOrganizer(fleet_id=fleet.id, user_id=user.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "fleet_id": fleet.id,
        "fleet_name": fleet.name,
        "user_id": user.id,
        "user_name": user.name,
        "user_email": user.email,
    }


@router.delete("/api/admin/fleets/{fleet_id}/organizers/{user_id}")
def remove_fleet_organizer(
    fleet_id: int,
    user_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(FleetOrganizer)
        .filter(FleetOrganizer.fleet_id == fleet_id, FleetOrganizer.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="RC lead not found")
    db.delete(row)
    db.commit()
    return {"message": "RC lead removed"}
