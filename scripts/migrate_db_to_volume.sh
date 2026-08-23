#!/usr/bin/env bash
# Copy an existing ./db bind-mount data directory into the named Docker volume
# used by one of the Crew Bench stacks.
#
#   ./scripts/migrate_db_to_volume.sh prod    # ./db  -> crew-bench-prod-db-data
#   ./scripts/migrate_db_to_volume.sh dev     # ./db  -> crew-bench-dev-db-data
#
# The source directory is only read, never modified, so the old data stays put
# until you delete it yourself. Stop the stack before running this.
#
# Afterwards the backend reconciles the schema on startup, adding tables and
# columns that later releases introduced (see backend/manage_schema.py).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_NAME="${1:-prod}"
SOURCE_DIR="${2:-$ROOT_DIR/db}"

case "$ENV_NAME" in
  dev | prod) ;;
  *)
    echo "usage: ./scripts/migrate_db_to_volume.sh <dev|prod> [source-dir]" >&2
    exit 2
    ;;
esac

VOLUME="crew-bench-${ENV_NAME}-db-data"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "error: $SOURCE_DIR does not exist; nothing to migrate." >&2
  echo "Fresh installs need no migration: just start the stack." >&2
  exit 1
fi

if ! sudo test -f "$SOURCE_DIR/PG_VERSION"; then
  echo "error: $SOURCE_DIR does not look like a PostgreSQL data directory" >&2
  echo "(no PG_VERSION file)." >&2
  exit 1
fi

SOURCE_PG_VERSION="$(sudo cat "$SOURCE_DIR/PG_VERSION")"
echo "Source:      $SOURCE_DIR (PostgreSQL major version $SOURCE_PG_VERSION)"
echo "Destination: docker volume $VOLUME"

if [[ "$SOURCE_PG_VERSION" != "15" ]]; then
  echo "warning: the compose stack runs postgres:15 but this data directory was" >&2
  echo "written by PostgreSQL $SOURCE_PG_VERSION. Postgres will refuse to start on a" >&2
  echo "mismatched data directory; dump and restore instead of copying." >&2
  exit 1
fi

if docker compose ls --filter name="crew-bench-${ENV_NAME}" 2>/dev/null | grep -q running; then
  echo "error: the crew-bench-${ENV_NAME} stack is running. Stop it first:" >&2
  echo "  ./scripts/compose.sh $ENV_NAME down" >&2
  exit 1
fi

if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  if [[ -n "$(docker run --rm -v "$VOLUME":/target alpine:3.19 sh -c 'ls -A /target')" ]]; then
    echo "error: volume $VOLUME already contains data; refusing to overwrite." >&2
    echo "Remove it first with: ./scripts/compose.sh $ENV_NAME down -v" >&2
    exit 1
  fi
else
  docker volume create "$VOLUME" >/dev/null
fi

echo "Copying data (this preserves ownership and permissions)..."
docker run --rm \
  -v "$SOURCE_DIR":/source:ro \
  -v "$VOLUME":/target \
  alpine:3.19 sh -c 'cp -a /source/. /target/ && ls -A /target | head -n 5'

echo
echo "Done. Start the stack and let the backend reconcile the schema:"
echo "  ./scripts/compose.sh $ENV_NAME up -d --build"
echo "  ./scripts/compose.sh $ENV_NAME exec backend python manage_schema.py check"
echo
echo "$SOURCE_DIR was not modified. Keep it until you have confirmed the stack"
echo "works, then remove it (it is no longer used)."
