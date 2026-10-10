"""Race committee volunteering, fleet leads, and the assigned PRO."""
import uuid
from datetime import datetime, timedelta

from starlette.testclient import TestClient

from database import SessionLocal
from main import app
from models import Notification, User

client = TestClient(app)


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _register_and_login(email: str, name: str, role: str = "crew", password: str = "testpass123"):
    register = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": name, "role": role},
    )
    assert register.status_code == 200, register.text
    login = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _promote_admin(email: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        user.is_admin = True
        db.commit()
    finally:
        db.close()


def _me(token: str) -> dict:
    response = client.get("/api/auth/me", headers=_headers(token))
    assert response.status_code == 200, response.text
    return response.json()


def _set_skills(token: str, roles: str, training: str = "Race Committee Fundamentals", experience: str = ""):
    response = client.put(
        "/api/auth/me",
        headers=_headers(token),
        json={"rc_roles": roles, "rc_training": training, "rc_experience": experience},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _future_event(admin_token: str, fleet_id=None, name="Wednesday Race"):
    when = (datetime.utcnow() + timedelta(days=14)).replace(microsecond=0)
    payload = {
        "name": name,
        "date": when.isoformat(),
        "event_type": "race",
    }
    if fleet_id is not None:
        payload["organizing_fleet_id"] = fleet_id
    response = client.post("/api/events", headers=_headers(admin_token), json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def _notification_kinds(user_id: int):
    db = SessionLocal()
    try:
        rows = (
            db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.id)
            .all()
        )
        return [(row.kind, row.link) for row in rows]
    finally:
        db.close()


def test_profile_rejects_unknown_race_committee_roles():
    token = _register_and_login(_email("skills"), "Skill Sailor")
    for bad in ("Mark boat", "mark/set bots", "bots"):
        response = client.put(
            "/api/auth/me",
            headers=_headers(token),
            json={"rc_roles": bad},
        )
        assert response.status_code == 422, response.text
    saved = _set_skills(token, "Finish boat, Mark-set", experience="Club finish boat")
    assert saved["rc_roles"] == "Finish boat, Mark-set"
    assert saved["certifications"] in (None, "")
    assert saved["position_preferences"] in (None, "")


def test_volunteer_staff_and_schedule_flow():
    admin_token = _register_and_login(_email("admin"), "Admin")
    _promote_admin(_email_from_token(admin_token))
    lead_token = _register_and_login(_email("lead"), "Fleet Lead")
    volunteer_token = _register_and_login(_email("vol"), "Volunteer")
    pro_only_token = _register_and_login(_email("pro"), "Skilled PRO")
    signal_token = _register_and_login(_email("sig"), "Signal Person")

    _set_skills(volunteer_token, "Signal boat, Safety", experience="Two club races")
    _set_skills(pro_only_token, "PRO")
    _set_skills(signal_token, "Signal boat")

    fleet = client.post("/api/fleets", headers=_headers(admin_token), json={"name": f"Fleet {uuid.uuid4().hex[:6]}"})
    assert fleet.status_code == 200, fleet.text
    fleet_id = fleet.json()["id"]
    lead = _me(lead_token)
    added = client.post(
        f"/api/admin/fleets/{fleet_id}/organizers",
        headers=_headers(admin_token),
        json={"user_id": lead["id"]},
    )
    assert added.status_code == 200, added.text
    stranger = client.post(
        f"/api/admin/fleets/{fleet_id}/organizers",
        headers=_headers(volunteer_token),
        json={"user_id": lead["id"]},
    )
    assert stranger.status_code == 403

    event = _future_event(admin_token, fleet_id, name=f"Race {uuid.uuid4().hex[:6]}")
    other = _future_event(admin_token, fleet_id, name=f"Other {uuid.uuid4().hex[:6]}")

    untrained = client.post(
        f"/api/events/{event['id']}/race-committee/volunteer",
        headers=_headers(lead_token),
        json={"preferred_roles": ["PRO"]},
    )
    assert untrained.status_code == 400

    offer = client.post(
        f"/api/events/{event['id']}/race-committee/volunteer",
        headers=_headers(volunteer_token),
        json={"preferred_roles": ["Signal boat"], "notes": "Can do flags"},
    )
    assert offer.status_code == 200, offer.text
    assert offer.json()["status"] == "pending"
    assert offer.json()["assigned_role"] is None

    blocked = client.post(
        f"/api/events/{event['id']}/race-committee/assign",
        headers=_headers(pro_only_token),
        json={"user_id": _me(volunteer_token)["id"], "assigned_role": "Signal boat"},
    )
    assert blocked.status_code == 403

    assigned = client.post(
        f"/api/events/{event['id']}/race-committee/assign",
        headers=_headers(lead_token),
        json={"user_id": _me(volunteer_token)["id"], "assigned_role": "Signal boat"},
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["status"] == "accepted"
    assert assigned.json()["assigned_role"] == "Signal boat"
    assert ("rc_assigned", "/status") in _notification_kinds(_me(volunteer_token)["id"])

    still_open = client.post(
        f"/api/events/{event['id']}/race-committee/volunteer",
        headers=_headers(signal_token),
        json={"preferred_roles": ["Signal boat"]},
    )
    assert still_open.status_code == 200, still_open.text

    pro_user = _me(pro_only_token)
    invited = client.post(
        f"/api/events/{event['id']}/race-committee/assign",
        headers=_headers(lead_token),
        json={"user_id": pro_user["id"], "assigned_role": "PRO"},
    )
    assert invited.status_code == 200, invited.text
    assert invited.json()["status"] == "pending"
    assert ("rc_assigned", "/status") in _notification_kinds(pro_user["id"])

    not_yet = client.post(
        f"/api/events/{other['id']}/race-committee/assign",
        headers=_headers(pro_only_token),
        json={"user_id": _me(signal_token)["id"], "assigned_role": "Signal boat"},
    )
    assert not_yet.status_code == 403

    accepted = client.post(
        f"/api/race-committee/{invited.json()['id']}/accept",
        headers=_headers(pro_only_token),
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"
    assert ("rc_accepted", "/status") in _notification_kinds(pro_user["id"])
    assert ("rc_accepted", "/status") in _notification_kinds(lead["id"])

    declined = client.post(
        f"/api/race-committee/{still_open.json()['id']}/decline",
        headers=_headers(pro_only_token),
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["status"] == "declined"

    other_attempt = client.post(
        f"/api/events/{other['id']}/race-committee/assign",
        headers=_headers(pro_only_token),
        json={"user_id": _me(signal_token)["id"], "assigned_role": "Signal boat"},
    )
    assert other_attempt.status_code == 403

    schedule = client.get("/api/race-committee/my", headers=_headers(volunteer_token))
    assert schedule.status_code == 200, schedule.text
    mine = schedule.json()
    assert any(row["event_id"] == event["id"] and row["assigned_role"] == "Signal boat" and row["status"] == "accepted" for row in mine)
    assert any(row["fleet_name"] == fleet.json()["name"] for row in mine)

    board = client.get(f"/api/events/{event['id']}/race-committee")
    assert board.status_code == 200, board.text
    assert any(row["assigned_role"] == "PRO" and row["status"] == "accepted" for row in board.json()["assignments"])
    assert board.json()["can_staff"] is False


def _email_from_token(token: str) -> str:
    return _me(token)["email"]
