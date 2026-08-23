"""Fail-closed secret validation (no insecure defaults)."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

from settings import (
    SecretConfigError,
    get_admin_email,
    get_admin_password,
    get_database_url,
    get_secret_key,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]

VALID_SECRET = "a" * 32 + "-unique-test-secret-key"
VALID_PASSWORD = "unique-test-admin-pw"
VALID_DB_URL = "postgresql://crewbench:unique-db-password-ok@localhost:5432/crewbench"


def test_secret_key_required():
    with pytest.raises(SecretConfigError, match="SECRET_KEY is required"):
        get_secret_key("")
    with pytest.raises(SecretConfigError, match="SECRET_KEY is required"):
        get_secret_key(None)


@pytest.mark.parametrize(
    "value",
    [
        "your-secret-key-change-in-production",
        "dev-secret-key",
        "changeme",
        "short",
    ],
)
def test_secret_key_rejects_insecure_or_short(value):
    with pytest.raises(SecretConfigError):
        get_secret_key(value)


def test_secret_key_accepts_strong_value():
    assert get_secret_key(VALID_SECRET) == VALID_SECRET


def test_admin_password_rejects_legacy_default():
    with pytest.raises(SecretConfigError, match="known-insecure"):
        get_admin_password("admin123")


def test_admin_password_required_and_min_length():
    with pytest.raises(SecretConfigError, match="ADMIN_PASSWORD is required"):
        get_admin_password("  ")
    with pytest.raises(SecretConfigError, match="at least 12"):
        get_admin_password("short-pass")


def test_admin_email_required():
    with pytest.raises(SecretConfigError, match="ADMIN_EMAIL is required"):
        get_admin_email("")
    with pytest.raises(SecretConfigError, match="valid email"):
        get_admin_email("not-an-email")
    assert get_admin_email("admin@crewbench.app") == "admin@crewbench.app"


def test_database_url_rejects_legacy_password():
    with pytest.raises(SecretConfigError, match="known-insecure"):
        get_database_url(
            "postgresql://crewbench:crewbench_secret@localhost:5432/crewbench"
        )


def test_database_url_required():
    with pytest.raises(SecretConfigError, match="DATABASE_URL is required"):
        get_database_url("")


def test_database_url_from_postgres_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_USER", "crewbench")
    monkeypatch.setenv("POSTGRES_PASSWORD", "unique-db-password-ok")
    monkeypatch.setenv("POSTGRES_DB", "crewbench")
    monkeypatch.setenv("POSTGRES_HOST", "db")
    url = get_database_url()
    assert url == "postgresql://crewbench:unique-db-password-ok@db:5432/crewbench"


def test_import_auth_fails_without_secrets():
    env = {
        key: value
        for key, value in os.environ.items()
        if key
        not in {
            "SECRET_KEY",
            "ADMIN_PASSWORD",
            "ADMIN_EMAIL",
            "DATABASE_URL",
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
            "POSTGRES_DB",
        }
    }
    env["PYTHONPATH"] = str(BACKEND_DIR)
    result = subprocess.run(
        [sys.executable, "-c", "import auth"],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    combined = result.stderr + result.stdout
    assert "DATABASE_URL" in combined or "SECRET_KEY" in combined


def test_import_auth_fails_on_legacy_defaults():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND_DIR)
    env["DATABASE_URL"] = (
        "postgresql://crewbench:crewbench_secret@localhost:5432/crewbench"
    )
    env["SECRET_KEY"] = "your-secret-key-change-in-production"
    env["ADMIN_PASSWORD"] = "admin123"
    env["ADMIN_EMAIL"] = "admin@crewbench.app"
    result = subprocess.run(
        [sys.executable, "-c", "import auth"],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    combined = result.stderr + result.stdout
    assert "known-insecure" in combined or "insecure" in combined
