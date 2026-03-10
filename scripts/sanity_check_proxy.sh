#!/usr/bin/env bash
# Sanity-check reverse-proxy / sub-path behavior before deployment.
# Brings up db (+ optional backend), runs pytest with PUBLIC_URL set, then curls /api/health.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PUBLIC_URL="${PUBLIC_URL:-https://app.example.com}"

echo "=== Sanity check: reverse-proxy / sub-path (PUBLIC_URL=$PUBLIC_URL) ==="

# 1) Start DB (and backend so we can curl it at the end)
echo "Starting db and backend..."
docker-compose up -d db
echo "Waiting for Postgres..."
for i in {1..30}; do
  if docker-compose exec -T db pg_isready -U crewbench -q 2>/dev/null; then
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Postgres did not become ready in time."
    exit 1
  fi
  sleep 1
done

# 2) Run pytest inside backend container (uses db from compose network)
echo "Running proxy sanity tests (pytest)..."
docker-compose run --rm -e PUBLIC_URL="$PUBLIC_URL" backend python3 -m pytest tests/test_proxy_sanity.py -v
echo "Pytest passed."

# 3) Start backend and hit /api/health
docker-compose up -d backend
echo "Waiting for backend..."
for i in {1..30}; do
  if curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Backend did not become ready in time."
    docker-compose logs backend
    exit 1
  fi
  sleep 1
done

# 4) Curl health and assert
echo "Curl /api/health..."
HEALTH="$(curl -sf http://localhost:8000/api/health)"
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
  echo "Health check OK: $HEALTH"
else
  echo "Health check failed or unexpected response: $HEALTH"
  exit 1
fi

echo "=== All sanity checks passed. ==="
