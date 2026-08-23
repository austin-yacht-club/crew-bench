"""Inspect or reconcile the database schema against the current models.

    python manage_schema.py check   # read-only report, exit 1 if drifted
    python manage_schema.py apply   # add missing tables, columns and indexes

Run inside the backend container so DATABASE_URL points at the right stack:

    ./scripts/compose.sh prod exec backend python manage_schema.py check
"""
import argparse
import sys

from database import (
    DATABASE_URL,
    Base,
    DatabaseInitializationError,
    describe_schema_drift,
    engine,
    ensure_schema_updates,
    schema_drift_summary,
    validate_database_schema,
)
import models  # noqa: F401  (registers every table on Base.metadata)


def _redacted_url(url: str) -> str:
    """Hide the password in a SQLAlchemy URL before printing it."""
    if "@" not in url or "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    credentials, host = rest.rsplit("@", 1)
    user = credentials.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("check", "apply"))
    args = parser.parse_args()

    print(f"database: {_redacted_url(DATABASE_URL)}")

    if args.command == "check":
        lines = schema_drift_summary(describe_schema_drift())
        if not lines:
            print("schema is up to date with the models")
            return 0
        print("schema drift detected:")
        for line in lines:
            print(f"  - {line}")
        print("\nRun 'python manage_schema.py apply' to add what is missing.")
        return 1

    # Same sequence the backend runs at startup.
    Base.metadata.create_all(bind=engine)
    applied = ensure_schema_updates()
    if not applied:
        print("no columns or indexes to add")
    else:
        print(f"applied {len(applied)} change(s):")
        for statement in applied:
            print(f"  - {statement}")

    try:
        validate_database_schema()
    except DatabaseInitializationError as exc:
        print(f"\n{exc}")
        return 1
    print("schema is up to date with the models")
    return 0


if __name__ == "__main__":
    sys.exit(main())
