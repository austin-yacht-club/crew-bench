"""
Sanity checks for reverse-proxy / sub-path deployment (e.g. Cloudflare Zero Trust).

Run with PUBLIC_URL set to verify CORS and logging behavior:
  PUBLIC_URL=https://app.example.com pytest backend/tests/test_proxy_sanity.py -v

Requires DATABASE_URL (e.g. start db + backend via docker-compose first).
"""
import os
import pytest
from starlette.testclient import TestClient


# Import app after env may be set by test runner; app reads PUBLIC_URL/ROOT_PATH at import time
from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_at_subpath(client):
    """Backend must respond at /api/health for sub-path deployment."""
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data


def test_health_returns_json(client):
    """Health response is JSON with correct content-type."""
    r = client.get("/api/health")
    assert r.headers.get("content-type", "").startswith("application/json")
    assert r.json()["status"] == "healthy"


def test_openapi_available_at_subpath(client):
    """OpenAPI schema is reachable (root_path / docs work behind proxy)."""
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert data.get("info", {}).get("title") == "Crew Bench"
    assert "/api/health" in data.get("paths", {})


def test_cors_allow_origin_from_public_url(client):
    """
    When PUBLIC_URL is set, the origin derived from it must be allowed by CORS.
    Run with: PUBLIC_URL=https://app.example.com pytest ...
    """
    public_url = os.getenv("PUBLIC_URL", "").strip()
    if not public_url:
        pytest.skip("PUBLIC_URL not set; set it to test CORS for proxy deployment")
    # Origin is scheme + netloc only
    from urllib.parse import urlparse
    p = urlparse(public_url)
    origin = f"{p.scheme}://{p.netloc}" if p.scheme and p.netloc else public_url
    if not origin:
        pytest.skip("PUBLIC_URL could not be parsed to an origin")
    r = client.get("/api/health", headers={"Origin": origin})
    assert r.status_code == 200
    allow_origin = r.headers.get("access-control-allow-origin")
    assert allow_origin == origin, (
        f"Expected Access-Control-Allow-Origin {origin!r}, got {allow_origin!r}"
    )


def test_cors_allow_localhost(client):
    """Localhost origins (dev proxy) are always allowed."""
    for origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
        r = client.get("/api/health", headers={"Origin": origin})
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == origin


def test_api_auth_routes_exist(client):
    """Auth routes are mounted under /api (sub-path)."""
    # Unauthenticated request to protected route -> 401, not 404
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    # Wrong path would be 404
    r2 = client.get("/api/nonexistent")
    assert r2.status_code == 404
