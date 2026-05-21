"""
User Model V2
==============
MongoDB collection: users
Adds email, password_hash (bcrypt), ECC public key X/Y, and chain registration fields.
"""
import uuid
from datetime import datetime, timezone

import bcrypt


class User:
    COLLECTION = "users"

    def __init__(
        self,
        username: str,
        email: str,
        password: str,            # plaintext — hashed on init
        eth_address: str,
        public_key_x: str = "",   # ECC P-256 X as hex string
        public_key_y: str = "",   # ECC P-256 Y as hex string
        user_id: str = None,
        chain_registered: bool = False,
        chain_tx_hash: str = "",
        created_at: str = None,
        is_active: bool = True,
        # allow pre-hashed password when reconstructing from DB
        _password_hash: str = None,
    ):
        self.user_id          = user_id or str(uuid.uuid4())
        self.username         = username
        self.email            = email.lower().strip()
        self.eth_address      = eth_address.lower().strip()
        self.public_key_x     = public_key_x
        self.public_key_y     = public_key_y
        self.chain_registered = chain_registered
        self.chain_tx_hash    = chain_tx_hash
        self.created_at       = created_at or datetime.now(timezone.utc).isoformat()
        self.is_active        = is_active

        if _password_hash:
            self.password_hash = _password_hash
        else:
            # bcrypt.hashpw requires bytes
            self.password_hash = bcrypt.hashpw(
                password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

    # ── Auth ───────────────────────────────────────────────────────────────

    def verify_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8"),
        )

    # ── Serialisation ──────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """MongoDB document — never includes plaintext password."""
        return {
            "user_id":          self.user_id,
            "username":         self.username,
            "email":            self.email,
            "password_hash":    self.password_hash,
            "eth_address":      self.eth_address,
            "public_key_x":     self.public_key_x,
            "public_key_y":     self.public_key_y,
            "chain_registered": self.chain_registered,
            "chain_tx_hash":    self.chain_tx_hash,
            "created_at":       self.created_at,
            "is_active":        self.is_active,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        return cls(
            username         = data["username"],
            email            = data["email"],
            password         = "",                  # not used when _password_hash supplied
            eth_address      = data["eth_address"],
            public_key_x     = data.get("public_key_x", ""),
            public_key_y     = data.get("public_key_y", ""),
            user_id          = data.get("user_id"),
            chain_registered = data.get("chain_registered", False),
            chain_tx_hash    = data.get("chain_tx_hash", ""),
            created_at       = data.get("created_at"),
            is_active        = data.get("is_active", True),
            _password_hash   = data.get("password_hash", ""),
        )

    def to_public_profile(self) -> dict:
        """Safe subset for public endpoints."""
        return {
            "user_id":          self.user_id,
            "username":         self.username,
            "eth_address":      self.eth_address,
            "public_key_x":     self.public_key_x,
            "public_key_y":     self.public_key_y,
            "chain_registered": self.chain_registered,
        }

    def __repr__(self) -> str:
        return f"User(id={self.user_id[:8]}, username={self.username!r})"
