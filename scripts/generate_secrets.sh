#!/usr/bin/env bash
# Create a gitignored .env with unique secrets. Refuses to overwrite.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  echo "error: .env already exists; refusing to overwrite." >&2
  echo "Rename or delete .env if you want newly generated secrets." >&2
  echo "If this is an existing database, keep POSTGRES_PASSWORD in sync with the volume." >&2
  exit 1
fi

if [[ ! -f .env.example ]]; then
  echo "error: .env.example is missing." >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re
import secrets

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
Path(".env").write_text(out)
PY

chmod 600 .env

admin_email="$(grep -E '^ADMIN_EMAIL=' .env | head -n1 | cut -d= -f2-)"
admin_password="$(grep -E '^ADMIN_PASSWORD=' .env | head -n1 | cut -d= -f2-)"

echo "Wrote .env with unique POSTGRES_PASSWORD, SECRET_KEY, and ADMIN_PASSWORD."
echo "File mode is 600. Do not commit this file."
echo
echo "Admin login (save this now; it is only in .env):"
echo "  email:    ${admin_email}"
echo "  password: ${admin_password}"
echo
echo "You can now run: docker compose up --build"
echo "If you already have a Postgres volume from an older password, either put"
echo "that password in .env or reset with: docker compose down -v"
