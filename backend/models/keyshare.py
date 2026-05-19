"""
KeyShare Model
==============
Data model for one Shamir share belonging to one participant.
Stored in MongoDB collection:  keyshares

This class is intentionally framework-agnostic — it converts to/from plain
Python dicts so it works with both pymongo and any future ORM without changes.

No database connection is made here; connection happens in Prompt 7.
"""

from datetime import datetime, timezone


class KeyShare:
    """
    Represents one Shamir share belonging to one participant.

    Attributes
    ----------
    share_index : int   — which share this is (1 .. n)
    share_data  : str   — base64 blob from split_secret (packed half-shares)
    k           : int   — minimum shares needed for reconstruction
    n           : int   — total shares in this split operation
    checksum    : str   — SHA-256 hex digest of the original AES key
    owner_id    : str   — identifier of the user who holds this share
    session_id  : str   — links all n shares of one split operation
    created_at  : str   — ISO 8601 UTC timestamp
    """

    def __init__(
        self,
        share_index: int,
        share_data: str,
        k: int,
        n: int,
        checksum: str,
        owner_id: str,
        session_id: str,
        created_at: str = None,
    ):
        self.share_index = share_index
        self.share_data  = share_data
        self.k           = k
        self.n           = n
        self.checksum    = checksum
        self.owner_id    = owner_id
        self.session_id  = session_id
        self.created_at  = created_at or datetime.now(timezone.utc).isoformat()

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """
        Return a MongoDB-ready dict representing this KeyShare document.

        The dict contains all fields and is suitable for passing directly to
        pymongo's insert_one() / update_one().
        """
        return {
            "share_index": self.share_index,
            "share_data":  self.share_data,
            "k":           self.k,
            "n":           self.n,
            "checksum":    self.checksum,
            "owner_id":    self.owner_id,
            "session_id":  self.session_id,
            "created_at":  self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "KeyShare":
        """
        Create a KeyShare instance from a MongoDB document dict.

        Parameters
        ----------
        data : dict — typically a pymongo find_one() result

        Returns
        -------
        KeyShare instance
        """
        return cls(
            share_index = data["share_index"],
            share_data  = data["share_data"],
            k           = data["k"],
            n           = data["n"],
            checksum    = data["checksum"],
            owner_id    = data["owner_id"],
            session_id  = data["session_id"],
            created_at  = data.get("created_at"),
        )

    def to_share_dict(self) -> dict:
        """
        Return exactly the share dict that reconstruct_secret() expects:
            { share_index, share_data, k, n, checksum }

        Usage:
            shares = [ks.to_share_dict() for ks in key_share_objects]
            secret = reconstruct_secret(shares)
        """
        return {
            "share_index": self.share_index,
            "share_data":  self.share_data,
            "k":           self.k,
            "n":           self.n,
            "checksum":    self.checksum,
        }

    # ── Dunder helpers ────────────────────────────────────────────────────────

    def __repr__(self) -> str:
        return (
            f"KeyShare(index={self.share_index}/{self.n}, "
            f"k={self.k}, session={self.session_id!r}, owner={self.owner_id!r})"
        )

    def __eq__(self, other) -> bool:
        if not isinstance(other, KeyShare):
            return NotImplemented
        return self.to_share_dict() == other.to_share_dict()
