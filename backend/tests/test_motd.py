"""Tests for admin MOTD banners on landing, login, and dashboard."""
import uuid

from starlette.testclient import TestClient

from database import SessionLocal
from main import app
from models import User, Motd, MotdDismissal


client = TestClient(app)


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _register_and_login(email: str, name: str, role: str = "crew", password: str = "testpass123"):
    register = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": name,
            "role": role,
        },
    )
    assert register.status_code == 200, register.text
    login = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


def _auth_headers(token: str) -> dict:
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


def _clear_motds() -> None:
    db = SessionLocal()
    try:
        db.query(MotdDismissal).delete()
        db.query(Motd).delete()
        db.commit()
    finally:
        db.close()


def test_public_motd_starts_empty():
    _clear_motds()
    response = client.get("/api/motd")
    assert response.status_code == 200
    data = response.json()
    assert data["landing"] is None
    assert data["login"] is None
    assert data["dashboard"] is None


def test_non_admin_cannot_update_motd():
    token = _register_and_login(_unique_email("crew"), "Regular Crew")
    response = client.put(
        "/api/admin/motd/landing",
        headers=_auth_headers(token),
        json={"message": "Should not work", "is_active": True},
    )
    assert response.status_code == 403


def test_admin_motd_lifecycle_and_dismissal():
    _clear_motds()
    admin_email = _unique_email("admin")
    admin_token = _register_and_login(admin_email, "MOTD Admin", role="skipper")
    _promote_admin(admin_email)
    crew_token = _register_and_login(_unique_email("crew"), "MOTD Crew")

    listed = client.get("/api/admin/motd", headers=_auth_headers(admin_token))
    assert listed.status_code == 200
    locations = {item["location"] for item in listed.json()}
    assert locations == {"landing", "login", "dashboard"}

    created = client.put(
        "/api/admin/motd/dashboard",
        headers=_auth_headers(admin_token),
        json={"message": "Spring series starts Saturday at 1pm.", "is_active": True},
    )
    assert created.status_code == 200, created.text
    assert created.json()["is_active"] is True
    assert created.json()["message"] == "Spring series starts Saturday at 1pm."

    public = client.get("/api/motd").json()
    assert public["dashboard"]["message"] == "Spring series starts Saturday at 1pm."
    assert public["landing"] is None

    authenticated = client.get("/api/motd", headers=_auth_headers(crew_token)).json()
    assert authenticated["dashboard"]["message"] == "Spring series starts Saturday at 1pm."

    dismissed = client.post(
        "/api/motd/dashboard/dismiss",
        headers=_auth_headers(crew_token),
    )
    assert dismissed.status_code == 200

    after_dismiss = client.get("/api/motd", headers=_auth_headers(crew_token)).json()
    assert after_dismiss["dashboard"] is None

    still_public = client.get("/api/motd").json()
    assert still_public["dashboard"]["message"] == "Spring series starts Saturday at 1pm."

    updated = client.put(
        "/api/admin/motd/dashboard",
        headers=_auth_headers(admin_token),
        json={"message": "Race postponed to Sunday.", "is_active": True},
    )
    assert updated.status_code == 200

    after_update = client.get("/api/motd", headers=_auth_headers(crew_token)).json()
    assert after_update["dashboard"]["message"] == "Race postponed to Sunday."

    deactivated = client.put(
        "/api/admin/motd/dashboard",
        headers=_auth_headers(admin_token),
        json={"message": "", "is_active": True},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    assert client.get("/api/motd").json()["dashboard"] is None


def test_invalid_location_and_message_length():
    admin_email = _unique_email("admin")
    admin_token = _register_and_login(admin_email, "MOTD Admin 2", role="skipper")
    _promote_admin(admin_email)

    missing = client.put(
        "/api/admin/motd/nowhere",
        headers=_auth_headers(admin_token),
        json={"message": "Nope", "is_active": True},
    )
    assert missing.status_code == 422

    too_long = client.put(
        "/api/admin/motd/login",
        headers=_auth_headers(admin_token),
        json={"message": "x" * 281, "is_active": True},
    )
    assert too_long.status_code == 422

    unauthenticated_dismiss = client.post("/api/motd/login/dismiss")
    assert unauthenticated_dismiss.status_code == 401

    invalid_token = client.get(
        "/api/motd",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert invalid_token.status_code == 200
