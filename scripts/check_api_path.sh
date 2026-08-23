#!/usr/bin/env bash
# Check that a deployed Crew Bench host exposes the API path the SPA expects.
#
# Usage:
#   ./scripts/check_api_path.sh https://yourapp.com
#   ./scripts/check_api_path.sh http://localhost:3333
#   API_BASE_PATH=/api/api ./scripts/check_api_path.sh https://yourapp.com
#
# Exit 0 when /api/health (or $API_BASE_PATH/health) is healthy and auth is mounted.
set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "usage: $0 <public-base-url>" >&2
  echo "example: $0 https://crewbench.example.com" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
API_BASE_PATH="${API_BASE_PATH:-/api}"
API_BASE_PATH="/${API_BASE_PATH#/}"
API_BASE_PATH="${API_BASE_PATH%/}"

health_url="${BASE_URL}${API_BASE_PATH}/health"
me_url="${BASE_URL}${API_BASE_PATH}/auth/me"
double_url="${BASE_URL}/api/api/auth/me"

echo "=== Crew Bench API path check ==="
echo "Public base:     $BASE_URL"
echo "API_BASE_PATH:   $API_BASE_PATH"
echo "Expect health:   $health_url"
echo

code_health="$(curl -sS -o /tmp/crewbench_health.json -w "%{http_code}" "$health_url" || true)"
if [[ "$code_health" != "200" ]]; then
  echo "FAIL: $health_url → HTTP $code_health (expected 200)" >&2
  echo "  If the SPA loads but login 404s, your reverse proxy pathing does not" >&2
  echo "  match API_BASE_PATH. Preferred fix: send all traffic to the frontend" >&2
  echo "  container and keep API_BASE_PATH=/api." >&2
  echo "  Strip-once outer proxy? Set API_BASE_PATH=/api/api and recreate frontend:" >&2
  echo "    API_BASE_PATH=/api/api ./scripts/compose.sh prod up -d frontend" >&2
  exit 1
fi
if ! grep -q '"status":"healthy"' /tmp/crewbench_health.json 2>/dev/null; then
  echo "FAIL: health response was not healthy: $(cat /tmp/crewbench_health.json)" >&2
  exit 1
fi
echo "OK:   health → 200"

code_me="$(curl -sS -o /dev/null -w "%{http_code}" "$me_url" || true)"
if [[ "$code_me" == "404" ]]; then
  echo "FAIL: $me_url → 404 (auth route missing at this path)" >&2
  exit 1
fi
echo "OK:   auth/me → $code_me (expected 401 without a token)"

if [[ "$API_BASE_PATH" == "/api" ]]; then
  code_double="$(curl -sS -o /dev/null -w "%{http_code}" "$double_url" || true)"
  if [[ "$code_double" != "404" ]]; then
    echo "WARN: $double_url → $code_double (expected 404 when using /api)." >&2
    echo "      A misbuilt SPA calling /api/api would still appear to work here." >&2
  else
    echo "OK:   /api/api/auth/me → 404 (double prefix not required)"
  fi
fi

# If config.js is served, show what the container thinks
config_url="${BASE_URL}/config.js"
if curl -sf "$config_url" -o /tmp/crewbench_config.js 2>/dev/null; then
  echo "OK:   config.js present:"
  grep -E 'apiBasePath' /tmp/crewbench_config.js | head -1 | sed 's/^/      /'
fi

echo
echo "=== Path check passed. Browser login should POST ${API_BASE_PATH}/auth/login ==="
