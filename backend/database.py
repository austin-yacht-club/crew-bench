import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from settings import get_database_url

logger = logging.getLogger("crew_bench.database")

DATABASE_URL = get_database_url()

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DatabaseInitializationError(RuntimeError):
    """Raised when the backend cannot safely use the configured database."""


def ensure_schema_updates() -> None:
    """Apply lightweight schema patches for columns added after initial deploy."""
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    existing = {col["name"] for col in insp.get_columns("users")}
    statements = []
    if "crew_pool_email_alerts" not in existing:
        statements.append(
            "ALTER TABLE users ADD COLUMN crew_pool_email_alerts BOOLEAN DEFAULT FALSE"
        )
    if "last_crew_pool_alert_at" not in existing:
        statements.append(
            "ALTER TABLE users ADD COLUMN last_crew_pool_alert_at TIMESTAMP"
        )
    if statements:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
        logger.info("Applied user schema updates: %s", ", ".join(statements))


def validate_database_schema() -> None:
    """Reject databases that are missing any table or column used by the models."""
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    problems = []

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            problems.append(f"missing table {table.name}")
            continue
        existing_columns = {col["name"] for col in insp.get_columns(table.name)}
        missing_columns = set(table.columns.keys()) - existing_columns
        problems.extend(
            f"missing column {table.name}.{column}"
            for column in sorted(missing_columns)
        )

    if problems:
        details = ", ".join(problems)
        raise DatabaseInitializationError(
            "Database schema is incompatible with this application version: "
            f"{details}. Run the required database migration before restarting."
        )


def initialize_database() -> None:
    """Connect, create new structures, patch known changes, and validate schema."""
    safe_url = engine.url.render_as_string(hide_password=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
        ensure_schema_updates()
        validate_database_schema()
    except DatabaseInitializationError:
        logger.critical(
            "Database initialization failed for %s due to an incompatible schema.",
            safe_url,
            exc_info=True,
        )
        raise
    except Exception as exc:
        message = (
            f"Database initialization failed for {safe_url}. Verify that PostgreSQL "
            "is reachable, the configured credentials match the existing database, "
            "and the database user can create or alter tables."
        )
        logger.critical(message, exc_info=True)
        raise DatabaseInitializationError(message) from exc


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
