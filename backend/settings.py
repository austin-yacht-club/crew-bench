"""Required secrets and fail-closed validation.

No insecure defaults: the process refuses to start if secrets are missing,
too short, or match known leaked/placeholder values.
"""
from __future__ import annotations

import os
from typing import Optional
from urllib.parse import unquote, urlparse

_SETUP_HINT = (
    "Copy .env.example to .env and run ./scripts/generate_secrets.sh "
    "(or export the variable) before starting the app."
)

# Values previously shipped in docker-compose.yml / source defaults, plus
# common placeholders that would leave a deployment trivially attackable.
INSECURE_SECRET_KEYS = frozenset(
    {
        "your-secret-key-change-in-production",
        "dev-secret-key",
        "secret",
        "secret-key",
        "changeme",
        "change-me",
        "password",
    }
)

INSECURE_PASSWORDS = frozenset(
    {
        "admin123",
        "password",
        "changeme",
        "change-me",
        "secret",
        "crewbench_secret",
        "postgres",
        "pass",
    }
)

# Matched against the value with dashes/underscores/spaces removed.
_PLACEHOLDER_FRAGMENTS = (
    "changeme",
    "changeinproduction",
    "yoursecret",
    "placeholder",
    "examplekey",
    "defaultsecret",
    "devsecret",
)

MIN_SECRET_KEY_LENGTH = 32
MIN_PASSWORD_LENGTH = 12


class SecretConfigError(RuntimeError):
    """Raised when a required secret is missing or known-insecure."""


def _missing_message(name: str) -> str:
    return f"{name} is required. {_SETUP_HINT}"


def _insecure_message(name: str) -> str:
    return (
        f"{name} is a known-insecure or placeholder value and cannot be used. "
        f"{_SETUP_HINT}"
    )


def _normalize_for_fragment_check(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def reject_insecure_secret(
    name: str,
    value: Optional[str],
    *,
    min_length: int,
    denylist: frozenset[str],
) -> str:
    """Return a stripped secret or raise SecretConfigError."""
    if value is None or not str(value).strip():
        raise SecretConfigError(_missing_message(name))
    cleaned = str(value).strip()
    denylist_lower = {item.lower() for item in denylist}
    if cleaned.lower() in denylist_lower:
        raise SecretConfigError(_insecure_message(name))
    collapsed = _normalize_for_fragment_check(cleaned)
    if any(fragment in collapsed for fragment in _PLACEHOLDER_FRAGMENTS):
        raise SecretConfigError(_insecure_message(name))
    if len(cleaned) < min_length:
        raise SecretConfigError(
            f"{name} must be at least {min_length} characters. {_SETUP_HINT}"
        )
    return cleaned


def get_secret_key(value: Optional[str] = None) -> str:
    raw = os.getenv("SECRET_KEY") if value is None else value
    return reject_insecure_secret(
        "SECRET_KEY",
        raw,
        min_length=MIN_SECRET_KEY_LENGTH,
        denylist=INSECURE_SECRET_KEYS,
    )


def get_admin_password(value: Optional[str] = None) -> str:
    raw = os.getenv("ADMIN_PASSWORD") if value is None else value
    return reject_insecure_secret(
        "ADMIN_PASSWORD",
        raw,
        min_length=MIN_PASSWORD_LENGTH,
        denylist=INSECURE_PASSWORDS,
    )


def get_admin_email(value: Optional[str] = None) -> str:
    raw = os.getenv("ADMIN_EMAIL") if value is None else value
    if raw is None or not str(raw).strip():
        raise SecretConfigError(_missing_message("ADMIN_EMAIL"))
    email = str(raw).strip()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise SecretConfigError("ADMIN_EMAIL must be a valid email address.")
    return email


def get_admin_credentials() -> tuple[str, str]:
    return get_admin_email(), get_admin_password()


def get_database_url(value: Optional[str] = None) -> str:
    """Require DATABASE_URL, or build it from POSTGRES_* variables."""
    raw = os.getenv("DATABASE_URL") if value is None else value
    if raw is None or not str(raw).strip():
        if value is not None:
            raise SecretConfigError(_missing_message("DATABASE_URL"))
        user = (os.getenv("POSTGRES_USER") or "").strip()
        password = (os.getenv("POSTGRES_PASSWORD") or "").strip()
        db_name = (os.getenv("POSTGRES_DB") or "").strip()
        host = (os.getenv("POSTGRES_HOST") or "localhost").strip()
        port = (os.getenv("POSTGRES_PORT") or "5432").strip()
        if user and password and db_name:
            from urllib.parse import quote_plus

            reject_insecure_secret(
                "POSTGRES_PASSWORD",
                password,
                min_length=MIN_PASSWORD_LENGTH,
                denylist=INSECURE_PASSWORDS,
            )
            raw = (
                f"postgresql://{quote_plus(user)}:{quote_plus(password)}"
                f"@{host}:{port}/{db_name}"
            )
        else:
            raise SecretConfigError(
                "DATABASE_URL is required (or set POSTGRES_USER, "
                f"POSTGRES_PASSWORD, and POSTGRES_DB). {_SETUP_HINT}"
            )
    url = str(raw).strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("postgresql", "postgres"):
        raise SecretConfigError(
            "DATABASE_URL must be a postgresql:// (or postgres://) URL."
        )
    password = unquote(parsed.password or "")
    reject_insecure_secret(
        "DATABASE_URL password",
        password,
        min_length=MIN_PASSWORD_LENGTH,
        denylist=INSECURE_PASSWORDS,
    )
    return url
