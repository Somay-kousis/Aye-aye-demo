from datetime import datetime, timezone

from services.auth.session import SESSION_TTL, create_session, revoke_session

# Rotate when less than a quarter of the window remains.
ROTATE_BEFORE = SESSION_TTL / 4


def maybe_rotate(db, session_row) -> str | None:
    remaining = session_row.expires_at - datetime.now(timezone.utc)
    if remaining > ROTATE_BEFORE:
        return None
    revoke_session(db, session_row.id)
    return create_session(db, session_row.user_id)
