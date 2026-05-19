"""
Transaction Model
==================
MongoDB collection: transactions
One Transaction represents one complete send operation:
    stego embed → AES encrypt → IPFS upload → blockchain register
"""

import uuid
from datetime import datetime, timezone


class Transaction:
    """MongoDB-ready Transaction document model."""

    COLLECTION = "transactions"

    def __init__(
        self,
        sender_id: str,
        receiver_id: str,
        sender_eth: str,
        receiver_eth: str,
        file_type: str,
        original_filename: str,
        # Set after IPFS upload
        ipfs_cid: str = "",
        ipfs_gateway_url: str = "",
        # Set after AES encryption
        nonce: str = "",
        tag: str = "",
        # Set after blockchain registration
        merkle_root: str = "",
        blockchain_record_id: int = -1,
        tx_hash: str = "",
        block_number: int = -1,
        # Shamir params
        k: int = 3,
        n: int = 5,
        # Lifecycle
        status: str = "pending",
        # Auto-filled
        session_id: str = None,
        created_at: str = None,
        completed_at: str = None,
    ):
        self.session_id           = session_id or str(uuid.uuid4())
        self.sender_id            = sender_id
        self.receiver_id          = receiver_id
        self.sender_eth           = sender_eth
        self.receiver_eth         = receiver_eth
        self.file_type            = file_type
        self.original_filename    = original_filename
        self.ipfs_cid             = ipfs_cid
        self.ipfs_gateway_url     = ipfs_gateway_url
        self.nonce                = nonce
        self.tag                  = tag
        self.merkle_root          = merkle_root
        self.blockchain_record_id = blockchain_record_id
        self.tx_hash              = tx_hash
        self.block_number         = block_number
        self.k                    = k
        self.n                    = n
        self.status               = status
        self.created_at           = created_at or datetime.now(timezone.utc).isoformat()
        self.completed_at         = completed_at

    # ── Serialisation ─────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Return a MongoDB-ready dictionary with all fields."""
        return {
            "session_id":           self.session_id,
            "sender_id":            self.sender_id,
            "receiver_id":          self.receiver_id,
            "sender_eth":           self.sender_eth,
            "receiver_eth":         self.receiver_eth,
            "file_type":            self.file_type,
            "original_filename":    self.original_filename,
            "ipfs_cid":             self.ipfs_cid,
            "ipfs_gateway_url":     self.ipfs_gateway_url,
            "nonce":                self.nonce,
            "tag":                  self.tag,
            "merkle_root":          self.merkle_root,
            "blockchain_record_id": self.blockchain_record_id,
            "tx_hash":              self.tx_hash,
            "block_number":         self.block_number,
            "k":                    self.k,
            "n":                    self.n,
            "status":               self.status,
            "created_at":           self.created_at,
            "completed_at":         self.completed_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Transaction":
        """Reconstruct a Transaction from a MongoDB document."""
        return cls(
            sender_id            = data["sender_id"],
            receiver_id          = data["receiver_id"],
            sender_eth           = data.get("sender_eth", ""),
            receiver_eth         = data.get("receiver_eth", ""),
            file_type            = data.get("file_type", "image"),
            original_filename    = data.get("original_filename", ""),
            ipfs_cid             = data.get("ipfs_cid", ""),
            ipfs_gateway_url     = data.get("ipfs_gateway_url", ""),
            nonce                = data.get("nonce", ""),
            tag                  = data.get("tag", ""),
            merkle_root          = data.get("merkle_root", ""),
            blockchain_record_id = data.get("blockchain_record_id", -1),
            tx_hash              = data.get("tx_hash", ""),
            block_number         = data.get("block_number", -1),
            k                    = data.get("k", 3),
            n                    = data.get("n", 5),
            status               = data.get("status", "pending"),
            session_id           = data.get("session_id"),
            created_at           = data.get("created_at"),
            completed_at         = data.get("completed_at"),
        )

    def to_summary(self) -> dict:
        """
        Return the API-safe summary subset.
        Excludes nonce, tag, and other sensitive/internal fields.
        """
        return {
            "session_id":           self.session_id,
            "sender_id":            self.sender_id,
            "receiver_id":          self.receiver_id,
            "file_type":            self.file_type,
            "ipfs_cid":             self.ipfs_cid,
            "ipfs_gateway_url":     self.ipfs_gateway_url,
            "merkle_root":          self.merkle_root,
            "blockchain_record_id": self.blockchain_record_id,
            "tx_hash":              self.tx_hash,
            "status":               self.status,
            "created_at":           self.created_at,
        }

    def __repr__(self) -> str:
        return (
            f"Transaction(session={self.session_id[:8]}, "
            f"status={self.status!r}, cid={self.ipfs_cid[:16]}...)"
        )
