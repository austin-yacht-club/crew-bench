#!/usr/bin/env bash
# Report (or apply) schema differences between the models and a running stack's
# database. Useful after carrying an old database forward from an earlier
# release, since this project has no migration tool.
#
#   ./scripts/check_schema.sh prod          # read-only report
#   ./scripts/check_schema.sh prod apply    # add missing tables/columns/indexes
#
# The backend also reconciles the schema automatically on startup; this script
# is for inspecting a database without restarting anything.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_NAME="${1:-}"
ACTION="${2:-check}"

case "$ENV_NAME" in
  dev | prod) ;;
  *)
    echo "usage: ./scripts/check_schema.sh <dev|prod> [check|apply]" >&2
    exit 2
    ;;
esac

case "$ACTION" in
  check | apply) ;;
  *)
    echo "error: action must be 'check' or 'apply'." >&2
    exit 2
    ;;
esac

exec ./scripts/compose.sh "$ENV_NAME" exec -T backend python manage_schema.py "$ACTION"
