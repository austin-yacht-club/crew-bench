"""Email alerts when crew join or re-activate in the Crew Pool.

Rate limiting: immediate alerts with a per-skipper cooldown (default 1 hour).
If multiple crew join within the cooldown window, only the first alert is sent;
skippers can browse the Crew Pool for the full list. Set CREW_POOL_ALERT_COOLDOWN_SECONDS=0
to disable cooldown.
"""
import logging
import os
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from email_service import get_email_backend
from models import CrewInterest, User

logger = logging.getLogger("crew_bench.crew_pool_notifications")

VALID_PATTERNS = {"saturdays", "sundays", "weekends", "weekdays", "flexible"}

PATTERN_LABELS = {
    "saturdays": "Every Saturday",
    "sundays": "Every Sunday",
    "weekends": "Every Weekend",
    "weekdays": "Weekdays",
    "flexible": "Flexible / Any time",
}


def _cooldown_seconds() -> int:
    raw = (os.getenv("CREW_POOL_ALERT_COOLDOWN_SECONDS") or "3600").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 3600


def _public_app_url() -> str:
    url = (os.getenv("PUBLIC_URL") or "http://localhost:3333").strip().rstrip("/")
    return url


def _crew_pool_link() -> str:
    return f"{_public_app_url()}/crew-pool"


def _format_patterns(raw: Optional[str]) -> str:
    if not raw:
        return "Not specified"
    labels = []
    for part in raw.split(","):
        key = part.strip().lower()
        if key in VALID_PATTERNS:
            labels.append(PATTERN_LABELS.get(key, key))
    return ", ".join(labels) if labels else "Not specified"


def _notes_snippet(notes: Optional[str], max_len: int = 200) -> str:
    if not notes or not notes.strip():
        return "(No notes provided)"
    text = notes.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def _build_email_bodies(
    crew_name: str,
    patterns_text: str,
    notes_text: str,
    is_reactivation: bool,
) -> tuple[str, str, str]:
    action = "re-joined" if is_reactivation else "joined"
    subject = f"New crew in the Crew Pool: {crew_name}"
    link = _crew_pool_link()
    body_text = (
        f"A crew member has {action} the Crew Pool on Crew Bench.\n\n"
        f"Crew: {crew_name}\n"
        f"Availability: {patterns_text}\n"
        f"Notes: {notes_text}\n\n"
        f"Browse the Crew Pool: {link}\n"
    )
    body_html = (
        f"<p>A crew member has <strong>{action}</strong> the Crew Pool on Crew Bench.</p>"
        f"<ul>"
        f"<li><strong>Crew:</strong> {crew_name}</li>"
        f"<li><strong>Availability:</strong> {patterns_text}</li>"
        f"<li><strong>Notes:</strong> {notes_text}</li>"
        f"</ul>"
        f'<p><a href="{link}">Browse the Crew Pool</a></p>'
    )
    return subject, body_text, body_html


def _eligible_skippers(db: Session) -> List[User]:
    return (
        db.query(User)
        .filter(
            User.is_active == True,
            User.crew_pool_email_alerts == True,
            User.role.in_(["skipper", "admin"]),
        )
        .all()
    )


def _within_cooldown(skipper: User, now: datetime, cooldown: int) -> bool:
    if cooldown <= 0:
        return False
    if not skipper.last_crew_pool_alert_at:
        return False
    return (now - skipper.last_crew_pool_alert_at).total_seconds() < cooldown


def notify_skippers_of_crew_pool_activity(
    db: Session,
    interest: CrewInterest,
    *,
    is_reactivation: bool = False,
) -> int:
    """Send crew pool alert emails to opted-in skippers. Returns count sent."""
    if not interest.is_active:
        return 0

    crew_user = interest.crew
    if not crew_user or not crew_user.is_active:
        crew_user = db.query(User).filter(User.id == interest.crew_id).first()
    if not crew_user or not crew_user.is_active:
        return 0

    skippers = _eligible_skippers(db)
    if not skippers:
        return 0

    patterns_text = _format_patterns(interest.patterns)
    notes_text = _notes_snippet(interest.notes)
    subject, body_text, body_html = _build_email_bodies(
        crew_user.name,
        patterns_text,
        notes_text,
        is_reactivation,
    )

    backend = get_email_backend()
    now = datetime.utcnow()
    cooldown = _cooldown_seconds()
    sent = 0

    for skipper in skippers:
        if skipper.id == crew_user.id:
            continue
        if _within_cooldown(skipper, now, cooldown):
            logger.debug(
                "Skipping crew pool alert for skipper %s (cooldown active)",
                skipper.email,
            )
            continue
        try:
            backend.send_email(skipper.email, subject, body_text, body_html)
            skipper.last_crew_pool_alert_at = now
            sent += 1
        except Exception as exc:
            logger.warning(
                "Failed to send crew pool alert to %s: %s",
                skipper.email,
                exc,
            )

    if sent:
        db.flush()
    return sent
