"""
jwt_handler.py — JWT Generation and Verification
==================================================
Uses PyJWT. JWT_SECRET loaded from environment.
"""
import os
import traceback
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import g, jsonify, request


def _secret() -> str:
    return os.environ.get("JWT_SECRET", "stegochain-dev-secret-changeme")


def generate_token(user_id: str, eth_address: str) -> str:
    """Create signed JWT valid for 24 hours."""
    now = datetime.now(timezone.utc)
    payload = {
        "user_id":     user_id,
        "eth_address": eth_address.lower(),
        "iat":         now,
        "exp":         now + timedelta(hours=24),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def verify_token(token: str) -> dict:
    """
    Decode and verify JWT.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    return jwt.decode(token, _secret(), algorithms=["HS256"])


def require_auth(fn):
    """
    Flask route decorator.
    Reads Bearer token from Authorization header.
    Injects g.user_id and g.eth_address on success.
    Returns 401 JSON on failure.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # ── Pass OPTIONS preflight requests through (no auth needed) ──────
        if request.method == "OPTIONS":
            return jsonify({}), 200

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            print(f"[AUTH 401] {request.method} {request.path} — Missing/invalid Authorization header")
            return jsonify({"error": "Missing or invalid Authorization header", "status": 401}), 401
        token = auth_header[len("Bearer "):]
        masked = token[:12] + "..." + token[-6:] if len(token) > 18 else token
        try:
            payload = verify_token(token)
            g.user_id     = payload["user_id"]
            g.eth_address = payload["eth_address"]
            print(f"[AUTH  OK] {request.method} {request.path} — user_id={g.user_id}")
        except jwt.ExpiredSignatureError:
            print(f"[AUTH 401] {request.method} {request.path} — Token expired (token={masked})")
            return jsonify({"error": "Token has expired", "status": 401}), 401
        except jwt.InvalidTokenError as exc:
            print(f"[AUTH 401] {request.method} {request.path} — Invalid token ({exc}) (token={masked})")
            return jsonify({"error": f"Invalid token: {exc}", "status": 401}), 401
        return fn(*args, **kwargs)
    return wrapper
