"""Tests for crew pool email alerts (issue #6)."""
import os
from typing import List

import pytest
from starlette.testclient import TestClient

from database import Base, SessionLocal, engine, ensure_schema_updates
from email_service import EmailBackend, reset_email_backend, set_email_backend
from models import CrewInterest, User
from auth import get_password_hash


class CapturingEmailBackend(EmailBackend):
    def __init__(self):
        self.messages: List[dict] = []

    def send_email(self, to, subject, body_text, body_html=None):
        self.messages.append(
            {
                "to": to,
                "subject": subject,
                "body_text": body_text,
                "body_html": body_html,
            }
        )


@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def email_backend():
    backend = CapturingEmailBackend()
    reset_email_backend()
    set_email_backend(backend)
    yield backend
    reset_email_backend()


@pytest.fixture
def client(email_backend):
    from main import app

    return TestClient(app)


def _register_and_token(client, email, name, role="crew", password="testpass123"):
    r = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": name,
            "role": role,
        },
    )
    assert r.status_code == 200, r.text
    login = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _create_skipper_with_alerts(db_session, email, alerts_enabled=True):
    user = User(
        email=email,
        hashed_password=get_password_hash("testpass123"),
        name=f"Skipper {email.split('@')[0]}",
        role="skipper",
        crew_pool_email_alerts=alerts_enabled,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_new_crew_interest_sends_email_to_opted_in_skipper(client, email_backend, db_session):
    skipper = _create_skipper_with_alerts(db_session, "skipper-alerts@example.com", True)
    _create_skipper_with_alerts(db_session, "skipper-no-alerts@example.com", False)

    crew_token = _register_and_token(client, "crew-new@example.com", "New Crew")

    r = client.put(
        "/api/crew-pool",
        headers=_auth_headers(crew_token),
        json={
            "notes": "Available most weekends for racing.",
            "patterns": ["weekends", "saturdays"],
            "is_active": True,
        },
    )
    assert r.status_code == 200, r.text

    recipients = {m["to"] for m in email_backend.messages}
    assert skipper.email in recipients
    assert "skipper-no-alerts@example.com" not in recipients

    msg = next(m for m in email_backend.messages if m["to"] == skipper.email)
    assert "New Crew" in msg["subject"]
    assert "weekends" in msg["body_text"].lower() or "Weekend" in msg["body_text"]
    assert "Available most weekends" in msg["body_text"]
    assert "/crew-pool" in msg["body_text"]


def test_reactivation_sends_email(client, email_backend, db_session):
    skipper = _create_skipper_with_alerts(db_session, "skipper-reactivate@example.com", True)
    crew_token = _register_and_token(client, "crew-reactivate@example.com", "Returning Crew")

    r = client.put(
        "/api/crew-pool",
        headers=_auth_headers(crew_token),
        json={"notes": "Taking a break", "patterns": ["flexible"], "is_active": False},
    )
    assert r.status_code == 200
    email_backend.messages.clear()

    r = client.put(
        "/api/crew-pool",
        headers=_auth_headers(crew_token),
        json={"notes": "Back and ready to sail!", "patterns": ["sundays"], "is_active": True},
    )
    assert r.status_code == 200, r.text

    assert any(m["to"] == skipper.email for m in email_backend.messages)
    msg = next(m for m in email_backend.messages if m["to"] == skipper.email)
    assert "re-joined" in msg["body_text"].lower() or "re-joined" in (msg["body_html"] or "").lower()
    assert "Back and ready" in msg["body_text"]


def test_update_while_active_does_not_resend(client, email_backend, db_session):
    skipper = _create_skipper_with_alerts(db_session, "skipper-no-resend@example.com", True)
    crew_token = _register_and_token(client, "crew-update@example.com", "Active Crew")

    r = client.put(
        "/api/crew-pool",
        headers=_auth_headers(crew_token),
        json={"notes": "Initial notes", "patterns": ["weekdays"], "is_active": True},
    )
    assert r.status_code == 200
    assert len(email_backend.messages) == 1

    email_backend.messages.clear()
    r = client.put(
        "/api/crew-pool",
        headers=_auth_headers(crew_token),
        json={"notes": "Updated notes only", "patterns": ["weekdays"], "is_active": True},
    )
    assert r.status_code == 200
    assert len(email_backend.messages) == 0


def test_cooldown_limits_alerts(client, email_backend, db_session, monkeypatch):
    monkeypatch.setenv("CREW_POOL_ALERT_COOLDOWN_SECONDS", "3600")
    skipper = _create_skipper_with_alerts(db_session, "skipper-cooldown@example.com", True)

    crew1_token = _register_and_token(client, "crew-cooldown1@example.com", "Crew One")
    crew2_token = _register_and_token(client, "crew-cooldown2@example.com", "Crew Two")

    r = client.put(
        "/api/crew-pool",
        headers=_auth_headers(crew1_token),
        json={"notes": "First crew", "patterns": ["saturdays"], "is_active": True},
    )
    assert r.status_code == 200
    assert len(email_backend.messages) == 1

    email_backend.messages.clear()
    r = client.put(
        "/api/crew-pool",
        headers=_auth_headers(crew2_token),
        json={"notes": "Second crew", "patterns": ["sundays"], "is_active": True},
    )
    assert r.status_code == 200
    assert len(email_backend.messages) == 0

    db_session.refresh(skipper)
    assert skipper.last_crew_pool_alert_at is not None


def test_profile_toggle_persists(client, db_session):
    token = _register_and_token(client, "skipper-toggle@example.com", "Toggle Skipper", role="skipper")

    r = client.put(
        "/api/auth/me",
        headers=_auth_headers(token),
        json={"crew_pool_email_alerts": True},
    )
    assert r.status_code == 200
    assert r.json()["crew_pool_email_alerts"] is True

    r = client.get("/api/auth/me", headers=_auth_headers(token))
    assert r.status_code == 200
    assert r.json()["crew_pool_email_alerts"] is True

    user = db_session.query(User).filter(User.email == "skipper-toggle@example.com").one()
    assert user.crew_pool_email_alerts is True
