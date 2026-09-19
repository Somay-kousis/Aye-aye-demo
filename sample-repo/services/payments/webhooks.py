import hmac
from hashlib import sha256

RETRY_SCHEDULE_SECONDS = (60, 300, 1800, 7200)


def verify_signature(secret: bytes, body: bytes, signature: str) -> bool:
    expected = hmac.new(secret, body, sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def handle_event(db, event: dict) -> None:
    if db.webhook_events.exists(id=event["id"]):
        return
    db.webhook_events.insert(id=event["id"], type=event["type"], payload=event)
