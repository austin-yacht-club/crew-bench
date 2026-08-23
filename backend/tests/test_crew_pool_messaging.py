"""Tests for crew pool direct messaging (issue #4)."""
import requests

BASE = "http://localhost:8000/api"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE}/auth/login",
        data={"username": email, "password": password},
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_crew_pool_messaging_flow():
    skipper_email = "skipper-messaging-test@example.com"
    crew_email = "crew-messaging-test@example.com"
    password = "testpass123"

    for email, name, role in [
        (skipper_email, "Messaging Skipper", "skipper"),
        (crew_email, "Messaging Crew", "crew"),
    ]:
        requests.post(
            f"{BASE}/auth/register",
            json={
                "email": email,
                "password": password,
                "name": name,
                "role": role,
                "experience_level": "intermediate",
            },
        )

    skipper_token = _login(skipper_email, password)
    crew_token = _login(crew_email, password)

    r = requests.put(
        f"{BASE}/crew-pool",
        headers=_auth(crew_token),
        json={
            "notes": "Weekend crew",
            "patterns": ["weekends"],
            "date_ranges": [],
            "is_active": True,
        },
    )
    assert r.status_code == 200

    crew_id = requests.get(f"{BASE}/auth/me", headers=_auth(crew_token)).json()["id"]

    r = requests.post(
        f"{BASE}/conversations",
        headers=_auth(skipper_token),
        json={"crew_id": crew_id, "message": "Hello from the crew pool!"},
    )
    assert r.status_code == 201
    conv_id = r.json()["id"]

    notifs = requests.get(f"{BASE}/notifications", headers=_auth(crew_token)).json()
    assert any(n["kind"] == "crew_pool_message" for n in notifs)

    r = requests.post(
        f"{BASE}/conversations/{conv_id}/messages",
        headers=_auth(crew_token),
        json={"body": "Happy to crew!"},
    )
    assert r.status_code == 200

    for token in (skipper_token, crew_token):
        thread = requests.get(f"{BASE}/conversations/{conv_id}", headers=_auth(token)).json()
        assert len(thread["messages"]) == 2

    requests.put(
        f"{BASE}/auth/me",
        headers=_auth(crew_token),
        json={
            "allow_email_contact": False,
            "allow_phone_contact": False,
            "allow_sms_contact": False,
        },
    )
    profile = requests.get(
        f"{BASE}/crew-pool/crew/{crew_id}",
        headers=_auth(skipper_token),
    ).json()
    assert profile["email"] is None
    assert profile["phone"] is None
