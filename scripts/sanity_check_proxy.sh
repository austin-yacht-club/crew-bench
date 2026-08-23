#!/usr/bin/env bash
# Sanity-check reverse-proxy / sub-path behavior before deployment.
# Brings up the debug stack's db and backend, runs pytest with PUBLIC_URL set,
# then curls /api/health. Runs against crew-bench-dev so production is untouched.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

ENV_NAME="${CREW_BENCH_ENV:-dev}"
COMPOSE=("$ROOT_DIR/scripts/compose.sh" "$ENV_NAME")
ENV_FILE=".env.${ENV_NAME}"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE=".env"
fi

if [[ -f "$ROOT_DIR/$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/$ENV_FILE"
  set +a
fi

if [[ -z "${POSTGRES_PASSWORD:-}" || -z "${SECRET_KEY:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "error: required secrets are not set." >&2
  echo "Run ./scripts/generate_secrets.sh (or copy .env.example to .env and fill it in) first." >&2
  exit 1
fi

if [[ "$ENV_NAME" == "dev" ]]; then
  BACKEND_PORT="${DEV_BACKEND_PORT:-8001}"
  FRONTEND_PORT="${DEV_FRONTEND_PORT:-3334}"
  DB_NAME="${DEV_POSTGRES_DB:-crewbench_dev}"
else
  BACKEND_PORT="${PROD_BACKEND_PORT:-8000}"
  FRONTEND_PORT="${PROD_FRONTEND_PORT:-3333}"
  DB_NAME="${PROD_POSTGRES_DB:-crewbench}"
fi

PUBLIC_URL="${PUBLIC_URL:-https://app.example.com}"

echo "=== Sanity check: reverse-proxy / sub-path (stack=crew-bench-$ENV_NAME, PUBLIC_URL=$PUBLIC_URL) ==="

# 1) Start DB (and backend so we can curl it at the end)
echo "Starting db and backend..."
"${COMPOSE[@]}" up -d db
echo "Waiting for Postgres..."
for i in {1..30}; do
  if "${COMPOSE[@]}" exec -T db pg_isready -U "${POSTGRES_USER:-crewbench}" -d "$DB_NAME" -q 2>/dev/null; then
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
"${COMPOSE[@]}" run --rm -e PUBLIC_URL="$PUBLIC_URL" backend python3 -m pytest tests/test_proxy_sanity.py -v
echo "Pytest passed."

# 3) Start backend and hit /api/health
"${COMPOSE[@]}" up -d backend
echo "Waiting for backend..."
for i in {1..30}; do
  if curl -sf "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Backend did not become ready in time."
    "${COMPOSE[@]}" logs backend
    exit 1
  fi
  sleep 1
done

# 4) Curl health and assert
echo "Curl /api/health on port ${BACKEND_PORT}..."
HEALTH="$(curl -sf "http://localhost:${BACKEND_PORT}/api/health")"
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
  echo "Health check OK: $HEALTH"
else
  echo "Health check failed or unexpected response: $HEALTH"
  exit 1
fi

echo "=== All sanity checks passed. ==="
echo "Tip: after the frontend is up, also run:"
echo "  ./scripts/check_api_path.sh http://localhost:${FRONTEND_PORT}"
