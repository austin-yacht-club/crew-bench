#!/usr/bin/env bash
# Verify "Sailing my boat" shows instead of "Mark Available" when skipper is committed.
# Prereqs: stack running (docker compose up -d, or backend on :8000 + frontend on :3000).
# Uses API to log in, ensure an event and boat exist, create a skipper commitment, then prints verification steps.
set -e

API="${API_BASE:-http://localhost:8000}"
EVENTS_URL="$API/api/events"
AUTH_URL="$API/api/auth"
BOATS_URL="$API/api/boats"
COMMITMENTS_URL="$API/api/skipper-commitments"

echo "=== Verify 'Sailing my boat' (no 'Mark Available' when committed) ==="
echo "API base: $API"
echo ""

# Login as admin
TOKEN=$(curl -s -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@crewbench.app&password=admin123" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
if [ -z "$TOKEN" ]; then
  echo "Failed to get token. Is the backend running and admin account present?"
  exit 1
fi
echo "Logged in."

# Get or create a boat owned by admin
BOATS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BOATS_URL/my")
BOAT_ID=$(echo "$BOATS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d:
    print('')
else:
    print(str(d[0]['id']))
" 2>/dev/null || echo "")

if [ -z "$BOAT_ID" ]; then
  echo "Creating a boat for admin..."
  BOAT_RESP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"name":"Test Boat","make":"Test","model":"Verify","sail_number":"T1","length_ft":22,"crew_needed":2}' "$BOATS_URL")
  BOAT_ID=$(echo "$BOAT_RESP" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['id']))")
  echo "Created boat id $BOAT_ID"
else
  echo "Using existing boat id $BOAT_ID"
fi

# Get first upcoming event
EVENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$EVENTS_URL?upcoming_only=true" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d:
    print('')
else:
    print(str(d[0]['id']))
" 2>/dev/null || echo "")

if [ -z "$EVENT_ID" ]; then
  echo "No upcoming events. Creating one..."
  TOMORROW=$(python3 -c "from datetime import datetime, timedelta; print((datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%dT12:00:00'))")
  EVENT_RESP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"name\":\"Verify Sailing My Boat Test\",\"date\":\"$TOMORROW\",\"event_type\":\"race\"}" "$EVENTS_URL")
  EVENT_ID=$(echo "$EVENT_RESP" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['id']))")
  echo "Created event id $EVENT_ID"
else
  echo "Using upcoming event id $EVENT_ID"
fi

# Create skipper commitment for this event
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"boat_id\":$BOAT_ID,\"event_id\":$EVENT_ID}" "$COMMITMENTS_URL" > /dev/null
echo "Created skipper commitment for event $EVENT_ID (sailing your boat)."
echo ""
echo "--- Verification steps ---"
echo "1. Open the app:  http://localhost:3333  (or http://localhost:3000 if using npm start)"
echo "2. Log in as admin@crewbench.app / admin123"
echo "3. Go to the Events page"
echo "4. Find the event (e.g. 'Verify Sailing My Boat Test' or the first upcoming event)"
echo "5. You should see 'Sailing my boat' (disabled) instead of 'Mark Available'"
echo "6. In the Calendar tab, that event should show in blue; clicking it should not open the Mark Available dialog"
echo ""
