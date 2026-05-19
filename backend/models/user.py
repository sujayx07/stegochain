"""
User Model
===========
MongoDB collection: users
Represents a platform participant who can send/receive steganographic messages.
"""

import uuid
from datetime import datetime, timezone


class User:
    """MongoDB-ready User document model."""

    COLLECTION = "users"

    def __init__(
        self,
        username: str,
        eth_address: str,
        public_key_pem: str,
        user_id: str = None,
        created_at: str = None,
        is_active: bool = True,
    ):
        self.user_id        = user_id or str(uuid.uuid4())
        self.username       = username
        self.eth_address    = eth_address
        self.public_key_pem = public_key_pem
        self.created_at     = created_at or datetime.now(timezone.utc).isoformat()
        self.is_active      = is_active

    # ── Serialisation ─────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Return a MongoDB-ready dictionary with all fields."""
        return {
            "user_id":        self.user_id,
            "username":       self.username,
            "eth_address":    self.eth_address,
            "public_key_pem": self.public_key_pem,
            "created_at":     self.created_at,
            "is_active":      self.is_active,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        """Reconstruct a User from a MongoDB document."""
        return cls(
            username       = data["username"],
            eth_address    = data["eth_address"],
            public_key_pem = data["public_key_pem"],
            user_id        = data.get("user_id"),
            created_at     = data.get("created_at"),
            is_active      = data.get("is_active", True),
        )

    def to_public_profile(self) -> dict:
        """
        Return the public-safe profile subset.
        Never includes internal or sensitive fields.
        """
        return {
            "user_id":        self.user_id,
            "username":       self.username,
            "eth_address":    self.eth_address,
            "public_key_pem": self.public_key_pem,
        }

    def __repr__(self) -> str:
        return f"User(id={self.user_id[:8]}, username={self.username!r})"
