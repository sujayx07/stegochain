"""
AES-256 Encryption Module (GCM Mode)
======================================
Provides authenticated encryption using AES-256-GCM via PyCryptodome.
GCM mode gives both confidentiality and integrity in a single pass.

All ciphertext, nonce, and tag values are base64-encoded strings so they
are JSON-serialisable and MongoDB-safe.

Dependencies: pycryptodome (Crypto.*)
"""

import base64
import os

from Crypto.Cipher import AES


# ── Public API ───────────────────────────────────────────────────────────────

def generate_aes_key() -> bytes:
    """
    Generate a cryptographically secure random 256-bit (32-byte) AES key.

    Returns
    -------
    bytes : 32 random bytes suitable for AES-256.
    """
    return os.urandom(32)


def encrypt_message(message: str, key: bytes) -> dict:
    """
    Encrypt a plaintext string using AES-256-GCM.

    Parameters
    ----------
    message : plaintext string to encrypt
    key     : 32-byte AES key (from generate_aes_key or derive_shared_key)

    Returns
    -------
    dict with keys:
        ciphertext (str) : base64-encoded ciphertext
        nonce      (str) : base64-encoded 16-byte nonce
        tag        (str) : base64-encoded 16-byte GCM authentication tag
    """
    nonce  = os.urandom(16)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(message.encode("utf-8"))

    return {
        "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
        "nonce":      base64.b64encode(nonce).decode("utf-8"),
        "tag":        base64.b64encode(tag).decode("utf-8"),
    }


def decrypt_message(encrypted_data: dict, key: bytes) -> str:
    """
    Decrypt a message produced by encrypt_message.

    Parameters
    ----------
    encrypted_data : dict with keys ciphertext, nonce, tag (all base64 strings)
    key            : 32-byte AES key used during encryption

    Returns
    -------
    str : original plaintext string

    Raises
    ------
    ValueError : if decryption fails or GCM tag verification fails
    """
    try:
        ciphertext = base64.b64decode(encrypted_data["ciphertext"])
        nonce      = base64.b64decode(encrypted_data["nonce"])
        tag        = base64.b64decode(encrypted_data["tag"])

        cipher    = AES.new(key, AES.MODE_GCM, nonce=nonce)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)

        return plaintext.decode("utf-8")
    except (KeyError, ValueError, UnicodeDecodeError) as exc:
        raise ValueError(f"Decryption failed: {exc}") from exc


def encrypt_file(file_path: str, key: bytes, output_path: str) -> dict:
    """
    Encrypt a file's contents using AES-256-GCM and write the ciphertext to disk.

    The ciphertext bytes are saved to *output_path*.
    The nonce and tag are returned (caller must store them separately, e.g. in
    MongoDB or alongside the IPFS upload in Prompt 4).

    Parameters
    ----------
    file_path   : path to the plaintext source file
    key         : 32-byte AES key
    output_path : destination path for the encrypted binary output

    Returns
    -------
    dict with keys:
        nonce (str) : base64-encoded nonce
        tag   (str) : base64-encoded GCM authentication tag
    """
    with open(file_path, "rb") as fh:
        plaintext = fh.read()

    nonce  = os.urandom(16)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)

    with open(output_path, "wb") as fh:
        fh.write(ciphertext)

    return {
        "nonce": base64.b64encode(nonce).decode("utf-8"),
        "tag":   base64.b64encode(tag).decode("utf-8"),
    }


def decrypt_file(
    encrypted_file_path: str,
    key: bytes,
    nonce: str,
    tag: str,
    output_path: str,
) -> str:
    """
    Decrypt a file produced by encrypt_file and write plaintext back to disk.

    Parameters
    ----------
    encrypted_file_path : path to the encrypted binary file
    key                 : 32-byte AES key used during encryption
    nonce               : base64-encoded nonce string (from encrypt_file return)
    tag                 : base64-encoded GCM tag string (from encrypt_file return)
    output_path         : destination path for decrypted plaintext

    Returns
    -------
    str : output_path on success

    Raises
    ------
    ValueError : if decryption or tag verification fails
    """
    try:
        with open(encrypted_file_path, "rb") as fh:
            ciphertext = fh.read()

        nonce_bytes = base64.b64decode(nonce)
        tag_bytes   = base64.b64decode(tag)

        cipher    = AES.new(key, AES.MODE_GCM, nonce=nonce_bytes)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag_bytes)

        with open(output_path, "wb") as fh:
            fh.write(plaintext)

        return output_path
    except (ValueError, KeyError) as exc:
        raise ValueError(f"File decryption failed: {exc}") from exc
