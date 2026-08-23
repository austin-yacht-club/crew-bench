#!/usr/bin/env bash
# Run Docker Compose against one Crew Bench environment.
#
#   ./scripts/compose.sh dev  up -d --build
#   ./scripts/compose.sh prod up -d --build
#   ./scripts/compose.sh dev  logs -f backend
#   ./scripts/compose.sh dev  down -v          # only touches the dev stack
#
# The environment name selects the overlay (docker-compose.<env>.yml), the
# Compose project (crew-bench-<env>), the host ports, the database and the
# named volumes. Environment files are resolved in this order:
#   .env.<env>  (per-environment secrets, if present)
#   .env        (shared secrets)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat >&2 <<'EOF'
usage: ./scripts/compose.sh <dev|prod> [docker compose args...]

examples:
  ./scripts/compose.sh dev  up -d --build      # start the debug stack
  ./scripts/compose.sh dev  up -d --build --watch  # plus live code sync
  ./scripts/compose.sh prod up -d --build      # start the production stack
  ./scripts/compose.sh prod logs -f backend
  ./scripts/compose.sh dev  down -v            # reset the dev database only
  ./scripts/compose.sh prod ps
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

ENV_NAME="$1"
shift

case "$ENV_NAME" in
  dev | prod) ;;
  -h | --help | help)
    usage
    exit 0
    ;;
  *)
    echo "error: unknown environment '$ENV_NAME' (expected 'dev' or 'prod')." >&2
    usage
    exit 2
    ;;
esac

OVERLAY="docker-compose.${ENV_NAME}.yml"
if [[ ! -f "$OVERLAY" ]]; then
  echo "error: $OVERLAY is missing." >&2
  exit 1
fi

ENV_FILE=""
if [[ -f ".env.${ENV_NAME}" ]]; then
  ENV_FILE=".env.${ENV_NAME}"
elif [[ -f ".env" ]]; then
  ENV_FILE=".env"
else
  echo "error: no environment file found (.env.${ENV_NAME} or .env)." >&2
  echo "Run ./scripts/generate_secrets.sh (optionally with .env.${ENV_NAME}) first." >&2
  exit 1
fi

# Prefer the Compose plugin; fall back to the standalone docker-compose binary.
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "error: neither 'docker compose' nor 'docker-compose' is available." >&2
  exit 1
fi

echo "==> crew-bench-${ENV_NAME} (env file: ${ENV_FILE})" >&2
exec "${COMPOSE[@]}" \
  --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f "$OVERLAY" \
  "$@"
