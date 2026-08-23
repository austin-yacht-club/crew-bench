import logging
from typing import List, Optional, Tuple

from sqlalchemy import MetaData, create_engine, inspect, literal, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import Column, CreateIndex, Table

from settings import get_database_url

logger = logging.getLogger("crew_bench.database")

DATABASE_URL = get_database_url()

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DatabaseInitializationError(RuntimeError):
    """Raised when the backend cannot safely use the configured database."""


class SchemaUpdateError(DatabaseInitializationError):
    """A required schema change could not be applied to the existing database."""


def _render_literal(value, dialect) -> Optional[str]:
    """Render a Python scalar as inline SQL, or None if it cannot be rendered."""
    try:
        return str(
            literal(value).compile(
                dialect=dialect, compile_kwargs={"literal_binds": True}
            )
        )
    except SQLAlchemyError:
        return None


def _column_default_sql(column: Column, dialect) -> Optional[str]:
    """SQL for a column's DEFAULT clause, or None when there is nothing to render.

    Server-side defaults are used verbatim. Python-side defaults are only usable
    when they are plain scalars: callables such as ``datetime.utcnow`` are
    evaluated by the ORM per row and have no SQL equivalent, so existing rows
    keep NULL for those columns.
    """
    if column.server_default is not None:
        arg = getattr(column.server_default, "arg", None)
        if arg is not None:
            return str(arg)
    default = column.default
    if default is not None and getattr(default, "is_scalar", False):
        return _render_literal(default.arg, dialect)
    return None


def _add_column_sql(table: Table, column: Column, dialect, table_is_empty: bool) -> str:
    """Build the ALTER TABLE ... ADD COLUMN statement for one missing column.

    NOT NULL is only emitted when it cannot fail: the table must either be empty
    or the column must supply a default for the rows that already exist.
    """
    preparer = dialect.identifier_preparer
    parts = [
        f"ALTER TABLE {preparer.format_table(table)}",
        f"ADD COLUMN {preparer.format_column(column)}",
        column.type.compile(dialect),
    ]
    default_sql = _column_default_sql(column, dialect)
    if default_sql is not None:
        parts.append(f"DEFAULT {default_sql}")
    if not column.nullable and (table_is_empty or default_sql is not None):
        parts.append("NOT NULL")
    return " ".join(parts)


def _missing_columns(inspector, table: Table) -> List[Column]:
    present = {col["name"] for col in inspector.get_columns(table.name)}
    return [column for column in table.columns if column.name not in present]


def _missing_indexes(inspector, table: Table) -> List:
    present = {index["name"] for index in inspector.get_indexes(table.name)}
    return [
        index
        for index in table.indexes
        if index.name is not None and index.name not in present
    ]


def _already_exists(exc: Exception) -> bool:
    """True when DDL failed only because the object is already there.

    Two backend replicas starting at once can both try to add the same column.
    """
    message = str(exc).lower()
    return "already exists" in message or "duplicate column" in message


def describe_schema_drift(
    metadata: Optional[MetaData] = None, bind: Optional[Engine] = None
) -> dict:
    """Compare the mapped models against the live database, without changing it.

    Reports tables, columns and indexes the models expect but the database does
    not have, plus columns the database has that the models no longer mention
    (those are never dropped automatically).
    """
    metadata = Base.metadata if metadata is None else metadata
    bind = engine if bind is None else bind

    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    report: dict = {
        "missing_tables": [],
        "missing_columns": {},
        "missing_indexes": {},
        "unexpected_columns": {},
    }

    for table in metadata.sorted_tables:
        if table.name not in existing_tables:
            report["missing_tables"].append(table.name)
            continue
        missing = [column.name for column in _missing_columns(inspector, table)]
        if missing:
            report["missing_columns"][table.name] = missing
        missing_indexes = [index.name for index in _missing_indexes(inspector, table)]
        if missing_indexes:
            report["missing_indexes"][table.name] = missing_indexes
        mapped = {column.name for column in table.columns}
        extra = [
            col["name"]
            for col in inspector.get_columns(table.name)
            if col["name"] not in mapped
        ]
        if extra:
            report["unexpected_columns"][table.name] = extra

    return report


def schema_drift_summary(report: dict) -> List[str]:
    """Human-readable lines for a drift report; empty when the schema is current."""
    lines = []
    for name in report["missing_tables"]:
        lines.append(f"missing table: {name}")
    for name, columns in report["missing_columns"].items():
        lines.append(f"missing columns on {name}: {', '.join(columns)}")
    for name, indexes in report["missing_indexes"].items():
        lines.append(f"missing indexes on {name}: {', '.join(indexes)}")
    for name, columns in report["unexpected_columns"].items():
        lines.append(
            f"columns on {name} that the models no longer define "
            f"(left untouched): {', '.join(columns)}"
        )
    return lines


def ensure_schema_updates(
    metadata: Optional[MetaData] = None, bind: Optional[Engine] = None
) -> List[str]:
    """Add the columns and indexes that later releases introduced.

    ``create_all`` only creates tables that are absent — it never alters a table
    that already exists — so without this step a database created by an older
    release keeps its original shape and the first query touching a newer column
    fails. Run this after ``create_all``; tables that are still missing are left
    for :func:`validate_database_schema` to report.

    Only additive changes are made; nothing is dropped or retyped. Returns the
    statements that were applied, and raises :class:`SchemaUpdateError` if a
    required column could not be added, because the app cannot serve requests
    against a stale schema.
    """
    metadata = Base.metadata if metadata is None else metadata
    bind = engine if bind is None else bind

    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())
    applied: List[str] = []

    for table in metadata.sorted_tables:
        if table.name not in existing_tables:
            continue

        missing = _missing_columns(inspector, table)
        pending: List[Tuple[str, str]] = []
        if missing:
            # Counts rows without naming columns; the mapped ones are not all there yet.
            probe = select(literal(1)).select_from(table).limit(1)
            with bind.begin() as conn:
                table_is_empty = conn.execute(probe).first() is None
            pending = [
                (
                    column.name,
                    _add_column_sql(table, column, bind.dialect, table_is_empty),
                )
                for column in missing
            ]

        for column_name, statement in pending:
            try:
                with bind.begin() as conn:
                    conn.execute(text(statement))
            except SQLAlchemyError as exc:
                if _already_exists(exc):
                    logger.info(
                        "Column %s.%s was already added by another process",
                        table.name,
                        column_name,
                    )
                    continue
                raise SchemaUpdateError(
                    f"Could not add column {table.name}.{column_name} to the "
                    f"existing database. Statement: {statement}"
                ) from exc
            applied.append(statement)
            logger.info("Applied schema update: %s", statement)

        for index in _missing_indexes(inspector, table):
            try:
                with bind.begin() as conn:
                    conn.execute(CreateIndex(index))
            except SQLAlchemyError as exc:
                if not _already_exists(exc):
                    # A duplicate-value conflict on a unique index is a data
                    # problem a restart cannot fix, so report it and keep going;
                    # validate_database_schema decides whether to abort.
                    logger.warning(
                        "Could not create index %s on %s: %s",
                        index.name,
                        table.name,
                        exc,
                    )
                continue
            applied.append(f"CREATE INDEX {index.name} ON {table.name}")
            logger.info("Created missing index %s on %s", index.name, table.name)

    if applied:
        logger.info("Schema reconciliation applied %d change(s)", len(applied))
    return applied


def validate_database_schema() -> None:
    """Reject databases that are missing any table or column used by the models.

    The last gate before serving traffic: reconciliation is additive only, so
    anything it cannot repair (a renamed or retyped column, a table it could not
    create) must stop startup rather than surface as a query error later.
    Deliberately narrower than :func:`describe_schema_drift`, which also reports
    indexes and columns the models dropped — neither blocks serving requests.
    """
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
    """Connect, create new structures, reconcile the schema, and validate it."""
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
