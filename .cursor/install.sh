#!/usr/bin/env bash
# Idempotent dependency setup for the Crew Bench Cloud Agent environment.
# Installs system packages (PostgreSQL, Python venv tooling), backend Python
# dependencies, and frontend npm dependencies. Safe to run repeatedly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Installing system packages (PostgreSQL, Python venv)"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
# --fix-missing tolerates the occasional flaky Ubuntu mirror response.
sudo apt-get install -y --fix-missing \
  postgresql postgresql-contrib \
  python3-venv python3-dev

echo "==> Setting up backend virtualenv and Python dependencies"
cd "$REPO_ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
deactivate

echo "==> Installing frontend dependencies"
cd "$REPO_ROOT/frontend"
npm install

echo "==> install.sh complete"
