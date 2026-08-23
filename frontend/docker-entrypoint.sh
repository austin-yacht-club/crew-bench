#!/bin/sh
# Generate runtime frontend config from env, then start nginx.
# API_BASE_PATH is the axios base path the browser calls (not a bake-time CRA var).
#   /api       — default; host proxies /api → backend without stripping, OR all traffic via this nginx
#   /api/api   — only when an outer proxy strips exactly one /api before the backend
#   https://host:8000/api — API on another origin
set -e

API_BASE_PATH="${API_BASE_PATH:-/api}"
# Trim trailing slashes
API_BASE_PATH=$(printf '%s' "$API_BASE_PATH" | sed 's|/*$||')
if [ -z "$API_BASE_PATH" ]; then
  API_BASE_PATH="/api"
fi

# Escape for JS string literal
escaped=$(printf '%s' "$API_BASE_PATH" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/config.js <<EOF
/* Generated at container start from API_BASE_PATH — do not edit. */
window.__CREW_BENCH_CONFIG__ = { apiBasePath: "${escaped}" };
EOF

echo "Crew Bench frontend: API_BASE_PATH=${API_BASE_PATH}"

exec nginx -g "daemon off;"
