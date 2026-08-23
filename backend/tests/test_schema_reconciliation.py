"""Schema reconciliation for databases created by an older release.

The app has no migration tool: ``create_all`` only creates tables that are
absent, so a database that predates a model change keeps its old shape and
every query touching a newer column fails. These tests build a deliberately
outdated table, then check that startup reconciliation repairs it in place
without losing the rows that are already there.

Reconciliation is additive only. Whatever it cannot repair is caught by
``validate_database_schema``, covered in test_database_initialization.py.
"""
import pytest
from sqlalchemy import (
    Boolean,
    Column,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    inspect,
    select,
)
from sqlalchemy.schema import Table

from database import (
    Base,
    describe_schema_drift,
    engine,
    ensure_schema_updates,
    schema_drift_summary,
    validate_database_schema,
)

LEGACY_TABLE = "schema_probe_legacy"
NEW_TABLE = "schema_probe_added_later"


def _startup_sequence(metadata: MetaData) -> list:
    """The additive part of initialize_database(), scoped to one metadata set."""
    metadata.create_all(bind=engine, checkfirst=True)
    return ensure_schema_updates(metadata=metadata)


def _legacy_metadata() -> MetaData:
    """The table as an older release created it."""
    metadata = MetaData()
    Table(
        LEGACY_TABLE,
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String, nullable=False),
    )
    return metadata


def _current_metadata() -> MetaData:
    """The same table plus everything later releases added."""
    metadata = MetaData()
    Table(
        LEGACY_TABLE,
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String, nullable=False),
        Column("notes", Text),
        Column("opted_in", Boolean, default=False),
        Column("kind", String, default="crew", nullable=False),
        Column("indexed_value", String, index=True),
    )
    Table(
        NEW_TABLE,
        metadata,
        Column("id", Integer, primary_key=True),
        Column("label", String, nullable=False),
    )
    return metadata


@pytest.fixture
def legacy_database():
    """A database holding the outdated table with one pre-existing row."""
    for metadata in (_legacy_metadata(), _current_metadata()):
        metadata.drop_all(bind=engine, checkfirst=True)

    legacy = _legacy_metadata()
    legacy.create_all(bind=engine)
    table = legacy.tables[LEGACY_TABLE]
    with engine.begin() as conn:
        conn.execute(table.insert().values(name="pre-existing row"))

    yield legacy

    _current_metadata().drop_all(bind=engine, checkfirst=True)


def _columns(table_name: str) -> set:
    return {col["name"] for col in inspect(engine).get_columns(table_name)}


def test_drift_is_reported_before_anything_is_changed(legacy_database):
    current = _current_metadata()

    report = describe_schema_drift(metadata=current)

    assert report["missing_tables"] == [NEW_TABLE]
    assert report["missing_columns"][LEGACY_TABLE] == [
        "notes",
        "opted_in",
        "kind",
        "indexed_value",
    ]
    summary = schema_drift_summary(report)
    assert any("missing columns on schema_probe_legacy" in line for line in summary)

    # Reporting must not touch the database.
    assert _columns(LEGACY_TABLE) == {"id", "name"}


def test_missing_columns_and_tables_are_added(legacy_database):
    current = _current_metadata()

    applied = _startup_sequence(current)

    assert applied, "expected reconciliation to apply changes"
    assert _columns(LEGACY_TABLE) == {
        "id",
        "name",
        "notes",
        "opted_in",
        "kind",
        "indexed_value",
    }
    assert NEW_TABLE in inspect(engine).get_table_names()
    assert schema_drift_summary(describe_schema_drift(metadata=current)) == []


def test_existing_rows_survive_and_pick_up_column_defaults(legacy_database):
    current = _current_metadata()

    _startup_sequence(current)

    table = current.tables[LEGACY_TABLE]
    with engine.connect() as conn:
        rows = conn.execute(select(table)).mappings().all()

    assert len(rows) == 1
    row = rows[0]
    assert row["name"] == "pre-existing row"
    # Scalar model defaults become SQL defaults, so old rows are backfilled.
    assert row["opted_in"] is False
    assert row["kind"] == "crew"
    # Columns without a renderable default are simply empty for old rows.
    assert row["notes"] is None


def test_not_null_without_default_stays_nullable_on_a_populated_table(legacy_database):
    """A NOT NULL column with no default cannot be enforced on existing rows.

    Adding it as nullable keeps the app running instead of failing the DDL; the
    ORM still supplies the value for new rows.
    """
    metadata = MetaData()
    Table(
        LEGACY_TABLE,
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String, nullable=False),
        Column("required_later", String, nullable=False),
    )

    ensure_schema_updates(metadata=metadata)

    columns = {
        col["name"]: col for col in inspect(engine).get_columns(LEGACY_TABLE)
    }
    assert "required_later" in columns
    assert columns["required_later"]["nullable"] is True


def test_missing_index_is_created(legacy_database):
    current = _current_metadata()

    ensure_schema_updates(metadata=current)

    indexes = {index["name"] for index in inspect(engine).get_indexes(LEGACY_TABLE)}
    expected = {
        index.name
        for index in current.tables[LEGACY_TABLE].indexes
        if isinstance(index, Index)
    }
    assert expected
    assert expected <= indexes


def test_reconciliation_is_idempotent(legacy_database):
    current = _current_metadata()

    assert _startup_sequence(current)
    assert _startup_sequence(current) == []


def test_startup_sequence_leaves_the_real_schema_valid():
    """Reconciliation runs before validation, so a repairable schema is not rejected.

    validate_database_schema() fails closed on anything still missing, which is
    what keeps additive self-repair from hiding drift it cannot handle.
    """
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()

    validate_database_schema()


def test_columns_the_models_dropped_are_reported_not_deleted(legacy_database):
    """Extra database columns are never dropped automatically."""
    reduced = MetaData()
    Table(
        LEGACY_TABLE,
        reduced,
        Column("id", Integer, primary_key=True),
    )

    assert ensure_schema_updates(metadata=reduced) == []

    report = describe_schema_drift(metadata=reduced)
    assert report["unexpected_columns"][LEGACY_TABLE] == ["name"]
    assert "name" in _columns(LEGACY_TABLE)
