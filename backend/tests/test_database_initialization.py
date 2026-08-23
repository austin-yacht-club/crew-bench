"""Fail-closed database startup checks."""
from contextlib import nullcontext

import pytest

import database
import models  # noqa: F401 - registers model tables in Base.metadata


class _SafeURL:
    def render_as_string(self, hide_password=True):
        assert hide_password is True
        return "postgresql://crewbench:***@db:5432/crewbench"


def test_schema_validation_rejects_missing_model_column(monkeypatch):
    class IncompleteInspector:
        def get_table_names(self):
            return [table.name for table in database.Base.metadata.sorted_tables]

        def get_columns(self, table_name):
            columns = database.Base.metadata.tables[table_name].columns.keys()
            if table_name == "users":
                columns = [name for name in columns if name != "must_change_password"]
            return [{"name": name} for name in columns]

    monkeypatch.setattr(database, "inspect", lambda _engine: IncompleteInspector())

    with pytest.raises(
        database.DatabaseInitializationError,
        match=r"missing column users\.must_change_password",
    ):
        database.validate_database_schema()


def test_schema_update_failure_is_not_swallowed(monkeypatch):
    class OutdatedInspector:
        def get_table_names(self):
            return ["users"]

        def get_columns(self, _table_name):
            return [{"name": "id"}]

    class FailingConnection:
        def execute(self, _statement):
            raise PermissionError("database user cannot alter tables")

    class FailingEngine:
        def begin(self):
            return nullcontext(FailingConnection())

    monkeypatch.setattr(database, "inspect", lambda _engine: OutdatedInspector())
    monkeypatch.setattr(database, "engine", FailingEngine())

    with pytest.raises(PermissionError, match="cannot alter tables"):
        database.ensure_schema_updates()


def test_connection_failure_aborts_initialization_with_actionable_message(monkeypatch):
    class UnreachableEngine:
        url = _SafeURL()

        def connect(self):
            raise ConnectionError("password authentication failed")

    monkeypatch.setattr(database, "engine", UnreachableEngine())

    with pytest.raises(
        database.DatabaseInitializationError,
        match="credentials match the existing database",
    ) as exc_info:
        database.initialize_database()

    assert "password authentication failed" not in str(exc_info.value)
    assert "***" in str(exc_info.value)
