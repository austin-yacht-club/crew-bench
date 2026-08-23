import logging
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("crew_bench.database")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://crewbench:crewbench_secret@localhost:5432/crewbench")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema_updates() -> None:
    """Apply lightweight schema patches for columns added after initial deploy."""
    try:
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
    except Exception as exc:
        logger.warning("Schema update check failed (non-fatal): %s", exc)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
