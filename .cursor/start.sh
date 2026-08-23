#!/usr/bin/env bash
# Per-boot startup for the Crew Bench Cloud Agent environment.
# Starts the PostgreSQL cluster and ensures the application role/database exist.
# Must tolerate restarts (idempotent) and return once the database is ready.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f "$REPO_ROOT/.env" ]]; then
  echo "==> Generating .env with unique secrets (first boot)"
  "$REPO_ROOT/scripts/generate_secrets.sh"
fi

set -a
# shellcheck disable=SC1091
source "$REPO_ROOT/.env"
set +a

DB_USER="${POSTGRES_USER:-crewbench}"
DB_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env}"
DB_NAME="${POSTGRES_DB:-crewbench}"

if [[ ! "$DB_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "error: POSTGRES_USER contains unsafe characters" >&2
  exit 1
fi
if [[ ! "$DB_PASSWORD" =~ ^[A-Za-z0-9._~-]+$ ]]; then
  echo "error: POSTGRES_PASSWORD contains characters that cannot be applied safely here" >&2
  exit 1
fi
if [[ ! "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "error: POSTGRES_DB contains unsafe characters" >&2
  exit 1
fi

echo "==> Starting PostgreSQL cluster"
# Discover the installed cluster (version may differ across base images).
CLUSTER_LINE="$(sudo pg_lsclusters -h | head -n 1 || true)"
PG_VERSION="$(echo "$CLUSTER_LINE" | awk '{print $1}')"
PG_CLUSTER="$(echo "$CLUSTER_LINE" | awk '{print $2}')"
PG_VERSION="${PG_VERSION:-16}"
PG_CLUSTER="${PG_CLUSTER:-main}"

if ! sudo pg_lsclusters -h | grep -q online; then
  sudo pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start
fi

echo "==> Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    break
  fi
  sleep 1
done
sudo -u postgres pg_isready

echo "==> Ensuring role and database exist"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "DO \$\$ BEGIN
     IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
       CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
     ELSE
       ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
     END IF;
   END \$\$;"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "==> start.sh complete; PostgreSQL is ready"
