#!/usr/bin/env bash
# Create a gitignored environment file with unique secrets. Refuses to overwrite.
#
#   ./scripts/generate_secrets.sh              # writes .env (shared by both stacks)
#   ./scripts/generate_secrets.sh .env.prod    # production-only secrets
#   ./scripts/generate_secrets.sh .env.dev     # debug-stack-only secrets
#
# ./scripts/compose.sh <env> prefers .env.<env> over .env, so separate files let
# the dev and prod stacks run with completely independent credentials.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGET="${1:-.env}"

case "$TARGET" in
  .env | .env.dev | .env.prod) ;;
  *)
    echo "error: unsupported target '$TARGET' (expected .env, .env.dev, or .env.prod)." >&2
    exit 2
    ;;
esac

if [[ -f "$TARGET" ]]; then
  echo "error: $TARGET already exists; refusing to overwrite." >&2
  echo "Rename or delete $TARGET if you want newly generated secrets." >&2
  echo "If this is an existing database, keep POSTGRES_PASSWORD in sync with the volume." >&2
  exit 1
fi

if [[ ! -f .env.example ]]; then
  echo "error: .env.example is missing." >&2
  exit 1
fi

TARGET="$TARGET" python3 - <<'PY'
from pathlib import Path
import os
import re
import secrets

target = Path(os.environ["TARGET"])
example = Path(".env.example").read_text()
generated = {
    "POSTGRES_PASSWORD": secrets.token_hex(32),
    "SECRET_KEY": secrets.token_hex(32),
    "ADMIN_PASSWORD": secrets.token_hex(16),
}


def replacer(match: re.Match) -> str:
    key, rest = match.group(1), match.group(2)
    if key in generated and rest.strip() == "":
        return f"{key}={generated[key]}"
    return match.group(0)


out = re.sub(r"^([A-Z][A-Z0-9_]*)=(.*)$", replacer, example, flags=re.MULTILINE)
missing = [key for key in generated if f"{key}={generated[key]}" not in out]
if missing:
    raise SystemExit(
        "error: could not fill empty values in .env.example for: " + ", ".join(missing)
    )
target.write_text(out)
PY

chmod 600 "$TARGET"

admin_email="$(grep -E '^ADMIN_EMAIL=' "$TARGET" | head -n1 | cut -d= -f2-)"
admin_password="$(grep -E '^ADMIN_PASSWORD=' "$TARGET" | head -n1 | cut -d= -f2-)"

echo "Wrote $TARGET with unique POSTGRES_PASSWORD, SECRET_KEY, and ADMIN_PASSWORD."
echo "File mode is 600. Do not commit this file."
echo
echo "Admin login (save this now; it is only in $TARGET):"
echo "  email:    ${admin_email}"
echo "  password: ${admin_password}"
echo
echo "You can now run:"
echo "  ./scripts/compose.sh dev  up -d --build   # debug stack  (frontend :3334, api :8001)"
echo "  ./scripts/compose.sh prod up -d --build   # production stack (frontend :3333, api :8000)"
echo
echo "If you already have a Postgres volume from an older password, either put"
echo "that password in $TARGET or reset that stack with:"
echo "  ./scripts/compose.sh <dev|prod> down -v"
