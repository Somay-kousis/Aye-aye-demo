from datetime import datetime, timedelta, timezone
from uuid import uuid4

from infra.cache.session_cache import SessionCache
from services.auth.tokens import sign_session_token

SESSION_TTL = timedelta(minutes=30)

_cache = SessionCache()


def create_session(db, user_id: str) -> str:
    session_id = uuid4().hex
    expires_at = datetime.now(timezone.utc) + SESSION_TTL
    db.sessions.insert(id=session_id, user_id=user_id, expires_at=expires_at)
    _cache.put(session_id, user_id)
    return sign_session_token(session_id, expires_at)


def revoke_session(db, session_id: str) -> None:
    db.sessions.delete(id=session_id)


def is_active(db, session_id: str) -> bool:
    cached = _cache.get(session_id)
    if cached is not None:
        return True
    row = db.sessions.get(id=session_id)
    return row is not None and row.expires_at > datetime.now(timezone.utc)
