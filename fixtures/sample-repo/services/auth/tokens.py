import hmac
import os
from base64 import urlsafe_b64encode
from datetime import datetime
from hashlib import sha256

_SECRET = os.environ.get("SESSION_SIGNING_KEY", "").encode()


def sign_session_token(session_id: str, expires_at: datetime) -> str:
    payload = f"{session_id}.{int(expires_at.timestamp())}".encode()
    sig = hmac.new(_SECRET, payload, sha256).digest()
    return urlsafe_b64encode(payload + b"." + sig).decode()


def rotate_signing_key(new_key: bytes) -> None:
    global _SECRET
    _SECRET = new_key
