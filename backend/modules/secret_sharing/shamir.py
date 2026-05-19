"""
Shamir's Secret Sharing Module
================================
Pure-Python implementation of Shamir's (k, n) threshold secret sharing scheme
over a finite field (Mersenne prime  p = 2^127 - 1).

Strategy for 32-byte AES keys
-------------------------------
The Mersenne prime  p = 2^127 - 1  can hold any 128-bit (16-byte) value.
A 32-byte AES key is therefore split into two 16-byte halves.
Shamir's scheme is applied independently to each half, and the two sets of
half-shares are packed together into a single share_data blob.  Reconstruction
reverses this: unpack, interpolate each half, concatenate.

Integrity
----------
A SHA-256 checksum of the original secret is stored in every share.
reconstruct_secret() verifies the checksum before returning, catching
corrupted or mismatched shares.

Reference: Shamir, A. (1979). How to share a secret. CACM 22(11), 612-613.
"""

import base64
import hashlib
import os
import secrets
import struct


# ── Finite field prime ────────────────────────────────────────────────────────
# This prime is larger than any 256-bit (32-byte) integer, so any AES key
# can be represented directly as a field element without splitting.
# p = 2^256 + 297  — verified prime, safe for our field size.
PRIME = 2 ** 256 + 297

# Maximum secret length supported
MAX_SECRET_BYTES = 32


# ── Public API ────────────────────────────────────────────────────────────────

def split_secret(secret: bytes, k: int, n: int) -> list:
    """
    Split *secret* into *n* shares, any *k* of which can reconstruct it.

    Parameters
    ----------
    secret : raw bytes (up to 32 bytes; designed for 32-byte AES keys)
    k      : minimum shares required for reconstruction (threshold)
    n      : total number of shares to generate

    Returns
    -------
    list of n dicts, each containing:
        share_index (int)   : share number 1 .. n
        share_data  (str)   : base64-encoded packed half-shares
        k           (int)   : threshold
        n           (int)   : total shares
        checksum    (str)   : SHA-256 hex digest of the original secret

    Raises
    ------
    ValueError : if parameters are invalid
    """
    _validate_params(secret, k, n)

    checksum = hashlib.sha256(secret).hexdigest()

    # Pad secret to 32 bytes and represent as a single integer
    padded     = secret.ljust(32, b"\x00")
    secret_int = _bytes_to_int(padded)   # in range [0, 2^256)

    # secret_int < PRIME is guaranteed since PRIME = 2^256 + 297 > 2^256 - 1
    raw_shares = _shamir_split(secret_int, k, n)

    result = []
    for x, y in raw_shares:
        # y can be up to PRIME-1 < 2^257, so pack as 33 bytes to be safe
        packed = _int_to_bytes(y, 33)
        result.append({
            "share_index": x,
            "share_data":  base64.b64encode(packed).decode("utf-8"),
            "k":           k,
            "n":           n,
            "checksum":    checksum,
        })

    return result


def reconstruct_secret(shares: list) -> bytes:
    """
    Reconstruct the original secret from at least *k* shares.

    Parameters
    ----------
    shares : list of share dicts (format from split_secret)

    Returns
    -------
    bytes : original secret

    Raises
    ------
    ValueError : if fewer than k shares provided, checksum fails, or shares
                 are malformed / inconsistent
    """
    if not shares:
        raise ValueError("No shares provided.")

    # Validate consistency
    for sh in shares:
        if not verify_share(sh):
            raise ValueError(f"Share {sh.get('share_index', '?')} is malformed.")

    k_vals    = {sh["k"] for sh in shares}
    n_vals    = {sh["n"] for sh in shares}
    checksums = {sh["checksum"] for sh in shares}

    if len(k_vals) > 1:
        raise ValueError("Shares have inconsistent k values.")
    if len(n_vals) > 1:
        raise ValueError("Shares have inconsistent n values.")
    if len(checksums) > 1:
        raise ValueError("Shares have inconsistent checksums (different secrets?).")

    k        = k_vals.pop()
    checksum = checksums.pop()

    if len(shares) < k:
        raise ValueError(
            f"Insufficient shares: need at least {k}, got {len(shares)}."
        )

    # Unpack each share into (x, y)
    points = []
    for sh in shares:
        x      = sh["share_index"]
        packed = base64.b64decode(sh["share_data"])
        if len(packed) != 33:
            raise ValueError(f"Malformed share_data in share {x}: expected 33 bytes.")
        y = _bytes_to_int(packed)
        points.append((x, y))

    # Lagrange interpolation at x=0
    secret_int = _lagrange_interpolation(points[:k], PRIME)
    secret     = _int_to_bytes(secret_int, 32)

    # Verify integrity
    if hashlib.sha256(secret).hexdigest() != checksum:
        raise ValueError(
            "Reconstructed secret does not match checksum. "
            "Shares may be corrupted or belong to different secrets."
        )

    return secret


def verify_share(share: dict) -> bool:
    """
    Validate the structure of a single share dict.

    Returns True if all required keys are present and values are sane.
    Never raises an exception.
    """
    try:
        required = {"share_index", "share_data", "k", "n", "checksum"}
        if not required.issubset(share.keys()):
            return False

        idx = share["share_index"]
        k   = share["k"]
        n   = share["n"]

        if not (isinstance(idx, int) and 1 <= idx <= n):
            return False
        if not (isinstance(k, int) and isinstance(n, int) and 2 <= k <= n <= 255):
            return False

        # Try decoding share_data
        raw = base64.b64decode(share["share_data"])
        if len(raw) != 33:
            return False

        # Checksum must be a 64-char hex string
        if not (isinstance(share["checksum"], str) and len(share["checksum"]) == 64):
            return False

        return True
    except Exception:
        return False


def get_share_info(share: dict) -> dict:
    """
    Return human-readable metadata about a share.

    Parameters
    ----------
    share : a share dict from split_secret

    Returns
    -------
    dict with keys:
        share_index   (int)  : which share number this is
        total_shares  (int)  : n value
        threshold     (int)  : k value
        is_valid      (bool) : result of verify_share(share)
    """
    return {
        "share_index":  share.get("share_index"),
        "total_shares": share.get("n"),
        "threshold":    share.get("k"),
        "is_valid":     verify_share(share),
    }


# ── Internal helpers ──────────────────────────────────────────────────────────

def _validate_params(secret: bytes, k: int, n: int) -> None:
    if not isinstance(secret, bytes) or len(secret) == 0:
        raise ValueError("Secret must be a non-empty bytes object.")
    if len(secret) > MAX_SECRET_BYTES:
        raise ValueError(f"Secret too long: max {MAX_SECRET_BYTES} bytes, got {len(secret)}.")
    if not isinstance(k, int) or k < 2:
        raise ValueError(f"k must be an integer >= 2, got {k}.")
    if not isinstance(n, int) or n < k:
        raise ValueError(f"n must be >= k ({k}), got {n}.")
    if n > 255:
        raise ValueError(f"n must be <= 255, got {n}.")


def _shamir_split(secret_int: int, k: int, n: int) -> list:
    """
    Split *secret_int* (in range [0, PRIME)) into n shares using a random
    polynomial of degree k-1 over GF(PRIME).

    Returns list of (x, f(x)) tuples for x = 1 .. n.
    """
    # Random polynomial: f(x) = secret + a1*x + a2*x^2 + ... + a_{k-1}*x^{k-1}
    coefficients = [secret_int] + [
        secrets.randbelow(PRIME) for _ in range(k - 1)
    ]
    return [(x, _evaluate_polynomial(coefficients, x, PRIME)) for x in range(1, n + 1)]


def _evaluate_polynomial(coefficients: list, x: int, prime: int) -> int:
    """
    Evaluate polynomial with given coefficients at point x modulo prime.
    Uses Horner's method: a0 + x*(a1 + x*(a2 + ... ))
    """
    result = 0
    for coeff in reversed(coefficients):
        result = (result * x + coeff) % prime
    return result


def _lagrange_interpolation(points: list, prime: int) -> int:
    """
    Reconstruct f(0) from a list of (x, y) tuples using Lagrange interpolation
    modulo *prime*.

    Parameters
    ----------
    points : list of (x, y) tuples
    prime  : field prime

    Returns
    -------
    int : f(0) mod prime
    """
    x_vals = [p[0] for p in points]
    y_vals = [p[1] for p in points]
    k = len(points)
    result = 0

    for i in range(k):
        numerator   = 1
        denominator = 1
        for j in range(k):
            if i == j:
                continue
            numerator   = (numerator   * (0 - x_vals[j]))     % prime
            denominator = (denominator * (x_vals[i] - x_vals[j])) % prime

        # Modular inverse of denominator using Fermat's little theorem
        # (valid since prime is prime)
        inv_denom = pow(denominator, prime - 2, prime)
        lagrange_coeff = (numerator * inv_denom) % prime
        result = (result + y_vals[i] * lagrange_coeff) % prime

    return result


def _int_to_bytes(n: int, length: int) -> bytes:
    """Convert non-negative integer n to big-endian bytes of exactly *length* bytes."""
    return n.to_bytes(length, byteorder="big")


def _bytes_to_int(b: bytes) -> int:
    """Convert bytes to a non-negative integer (big-endian)."""
    return int.from_bytes(b, byteorder="big")
