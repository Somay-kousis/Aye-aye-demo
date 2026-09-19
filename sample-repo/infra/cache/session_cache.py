import time

from services.auth.session import SESSION_TTL


class SessionCache:
    """Process-local read-through cache for session lookups.

    Entries expire on their own clock, derived from SESSION_TTL at insert time.
    Deleting the database row does not touch this cache.
    """

    def __init__(self):
        self._entries: dict[str, tuple[str, float]] = {}

    def put(self, session_id: str, user_id: str) -> None:
        self._entries[session_id] = (user_id, time.monotonic() + SESSION_TTL.total_seconds())

    def get(self, session_id: str):
        hit = self._entries.get(session_id)
        if hit is None:
            return None
        user_id, expires = hit
        if time.monotonic() > expires:
            del self._entries[session_id]
            return None
        return user_id
