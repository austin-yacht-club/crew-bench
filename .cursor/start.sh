#!/usr/bin/env bash
# Per-boot startup for the Crew Bench Cloud Agent environment.
# Starts the PostgreSQL cluster and ensures the application role/database exist.
# Must tolerate restarts (idempotent) and return once the database is ready.
set -euo pipefail

DB_USER="crewbench"
DB_PASSWORD="crewbench_secret"
DB_NAME="crewbench"

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
     END IF;
   END \$\$;"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "==> start.sh complete; PostgreSQL is ready"
