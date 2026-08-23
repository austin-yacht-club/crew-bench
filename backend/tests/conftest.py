"""Set required secrets before any app import. Values are test-only, not production defaults."""
import os

os.environ.setdefault(
    "SECRET_KEY",
    "pytest-only-secret-key-not-for-production-use",
)
os.environ.setdefault(
    "ADMIN_PASSWORD",
    "pytest-only-admin-password",
)
os.environ.setdefault("ADMIN_EMAIL", "admin@example.test")
