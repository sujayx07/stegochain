"""
ECC Key Exchange Module (P-256 / ECDH / ECDSA)
================================================
Provides Elliptic Curve Diffie-Hellman (ECDH) key agreement and
ECDSA digital signatures using the NIST P-256 curve via PyCryptodome.

Key agreement workflow:
    Alice and Bob each call generate_ecc_keypair().
    Alice calls derive_shared_key(alice_priv, bob_pub)  -> 32 bytes
    Bob   calls derive_shared_key(bob_priv, alice_pub)  -> same 32 bytes
    Both can now use that 32-byte value as an AES-256 key.

Dependencies: pycryptodome (Crypto.*)
"""

import base64
import hashlib

from Crypto.Hash      import SHA256
from Crypto.PublicKey import ECC
from Crypto.Signature import DSS


# ── Curve constant ────────────────────────────────────────────────────────────
_CURVE = "P-256"


# ── Public API ────────────────────────────────────────────────────────────────

def generate_ecc_keypair() -> dict:
    """
    Generate a new NIST P-256 ECC key pair.

    Returns
    -------
    dict with keys:
        private_key (str) : PEM-encoded private key
        public_key  (str) : PEM-encoded public key
    """
    key = ECC.generate(curve=_CURVE)
    return {
        "private_key": key.export_key(format="PEM"),
        "public_key":  key.public_key().export_key(format="PEM"),
    }


def export_public_key(private_key_pem: str) -> str:
    """
    Derive and return the public key PEM from a private key PEM.

    Parameters
    ----------
    private_key_pem : PEM-encoded ECC private key string

    Returns
    -------
    str : PEM-encoded public key string
    """
    key = ECC.import_key(private_key_pem)
    return key.public_key().export_key(format="PEM")


def derive_shared_key(private_key_pem: str, peer_public_key_pem: str) -> bytes:
    """
    Perform ECDH key agreement and derive a 32-byte AES-compatible shared key.

    The raw ECDH shared point's x-coordinate is hashed with SHA-256 to produce
    a fixed-size, uniform key.  This is identical regardless of which party
    calls it (commutativity of ECDH):

        Alice: derive_shared_key(alice_priv, bob_pub)   == shared_key
        Bob:   derive_shared_key(bob_priv,  alice_pub)  == shared_key

    Parameters
    ----------
    private_key_pem     : PEM-encoded own ECC private key
    peer_public_key_pem : PEM-encoded peer's ECC public key

    Returns
    -------
    bytes : 32-byte key ready for use with AES-256
    """
    private_key = ECC.import_key(private_key_pem)
    peer_pub    = ECC.import_key(peer_public_key_pem)

    # ECDH: multiply peer's public point by own private scalar
    shared_point = peer_pub.pointQ * private_key.d

    # Derive key: SHA-256 of the x-coordinate (big-endian, 32-byte padded)
    x_bytes      = int(shared_point.x).to_bytes(32, byteorder="big")
    shared_key   = hashlib.sha256(x_bytes).digest()

    return shared_key


def sign_data(data: bytes, private_key_pem: str) -> str:
    """
    Sign arbitrary bytes using ECDSA with SHA-256.

    Parameters
    ----------
    data            : raw bytes to sign
    private_key_pem : PEM-encoded ECC private key

    Returns
    -------
    str : base64-encoded DER signature string
    """
    key    = ECC.import_key(private_key_pem)
    hasher = SHA256.new(data)
    signer = DSS.new(key, "fips-186-3")
    signature = signer.sign(hasher)
    return base64.b64encode(signature).decode("utf-8")


def verify_signature(data: bytes, signature_b64: str, public_key_pem: str) -> bool:
    """
    Verify an ECDSA signature produced by sign_data.

    Parameters
    ----------
    data            : original raw bytes that were signed
    signature_b64   : base64-encoded DER signature string
    public_key_pem  : PEM-encoded ECC public key

    Returns
    -------
    bool : True if signature is valid, False otherwise (never raises)
    """
    try:
        key       = ECC.import_key(public_key_pem)
        signature = base64.b64decode(signature_b64)
        hasher    = SHA256.new(data)
        verifier  = DSS.new(key, "fips-186-3")
        verifier.verify(hasher, signature)
        return True
    except Exception:
        return False
