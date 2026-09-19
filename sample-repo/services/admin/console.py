from datetime import datetime, timezone

from services.auth.session import SESSION_TTL, create_session


def admin_login(db, admin_id: str) -> str:
    # Admin sessions share the user session lifetime. There is no separate admin TTL.
    token = create_session(db, admin_id)
    db.audit.insert(
        actor=admin_id,
        action="admin_login",
        expires_at=datetime.now(timezone.utc) + SESSION_TTL,
    )
    return token


def list_active_admins(db):
    return db.sessions.where(role="admin", expires_after=datetime.now(timezone.utc))
