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


def test_double_api_prefix_is_not_a_route(client):
    """Host proxies that forward /api to the backend must not require /api/api.

    The SPA default base path is /api. A leftover /api/api/... path should 404
    on the backend so misconfigured frontends are obvious.
    """
    r = client.get("/api/api/auth/me")
    assert r.status_code == 404
    r2 = client.get("/api/api/health")
    assert r2.status_code == 404


def test_main_defines_root_path_raw_before_use():
    """Regression: PR #15 referenced _ROOT_PATH_RAW before assignment (NameError on boot)."""
    import main

    assert hasattr(main, "_ROOT_PATH_RAW")
    assert main.ROOT_PATH != "/api"


def test_root_path_api_does_not_break_login_matching():
    """Regression: FastAPI(root_path='/api') strips /api before matching.

    With routes declared as /api/auth/login, root_path=/api made every API call
    404 (seen in production behind Cloudflare → frontend nginx). Crew Bench must
    leave root_path empty so /api/auth/login matches.
    """
    from starlette.routing import get_route_path
    from main import app, ROOT_PATH

    assert ROOT_PATH in ("", None) or ROOT_PATH != "/api"
    # How Starlette would match if root_path were wrongly set to /api:
    broken = get_route_path({"type": "http", "path": "/api/auth/login", "root_path": "/api"})
    assert broken == "/auth/login"
    # With empty root_path, the full route path is preserved:
    ok = get_route_path({"type": "http", "path": "/api/auth/login", "root_path": ROOT_PATH or ""})
    assert ok == "/api/auth/login"
    # And the app actually has the login route mounted:
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/api/auth/login" in paths
