"""
Crypto Module Test Suite — AES-256 + ECC
==========================================
Tests all functions in:
    backend/modules/crypto/aes_cipher.py
    backend/modules/crypto/key_exchange.py

Run from the project root:
    python backend/tests/test_crypto.py

No external services required — all tests are self-contained.
"""

import os
import sys

# ---------------------------------------------------------------------------
# Ensure the backend package is importable when run directly
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

from modules.crypto.aes_cipher import (
    generate_aes_key,
    encrypt_message,
    decrypt_message,
    encrypt_file,
    decrypt_file,
)
from modules.crypto.key_exchange import (
    generate_ecc_keypair,
    export_public_key,
    derive_shared_key,
    sign_data,
    verify_signature,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
TEST_DIR = os.path.dirname(__file__)

def _sep(title: str) -> None:
    print(f"\n--------------------------------------")
    print(f" {title}")
    print(f"--------------------------------------")

def _pass(label: str) -> bool:
    print(f"  [result] PASS - {label}")
    return True

def _fail(label: str, exc: Exception) -> bool:
    print(f"  [result] FAIL - {label}")
    print(f"  {type(exc).__name__}: {exc}")
    return False

def _cleanup(*paths: str) -> None:
    for p in paths:
        try:
            os.remove(p)
        except FileNotFoundError:
            pass


# ---------------------------------------------------------------------------
# Test 1 — AES Key Generation
# ---------------------------------------------------------------------------
def test_1_aes_key_generation() -> bool:
    _sep("TEST 1 - AES Key Generation")
    try:
        key = generate_aes_key()
        print(f"  [info] Key length: {len(key)} bytes")
        assert isinstance(key, bytes), "Key is not bytes"
        assert len(key) == 32, f"Expected 32 bytes, got {len(key)}"
        return _pass("Key is 32 bytes of raw bytes")
    except Exception as exc:
        return _fail("AES key generation", exc)


# ---------------------------------------------------------------------------
# Test 2 — AES Encrypt / Decrypt Round Trip
# ---------------------------------------------------------------------------
def test_2_aes_encrypt_decrypt() -> bool:
    _sep("TEST 2 - AES Encrypt/Decrypt Round Trip")
    original = "Confidential StegoChain payload - patient record 2026"
    try:
        key       = generate_aes_key()
        encrypted = encrypt_message(original, key)

        print(f"  [info] Encrypted keys: {list(encrypted.keys())}")
        assert "ciphertext" in encrypted, "Missing 'ciphertext'"
        assert "nonce"      in encrypted, "Missing 'nonce'"
        assert "tag"        in encrypted, "Missing 'tag'"

        decrypted = decrypt_message(encrypted, key)
        print(f"  [info] Decrypted: \"{decrypted}\"")
        assert decrypted == original, f"Mismatch: {decrypted!r} != {original!r}"

        return _pass("Encrypt/Decrypt round trip successful")
    except Exception as exc:
        return _fail("AES round trip", exc)


# ---------------------------------------------------------------------------
# Test 3 — AES Wrong Key Rejection
# ---------------------------------------------------------------------------
def test_3_aes_wrong_key() -> bool:
    _sep("TEST 3 - AES Wrong Key Rejection")
    try:
        key_a     = generate_aes_key()
        key_b     = generate_aes_key()
        encrypted = encrypt_message("Top secret message", key_a)

        raised = False
        try:
            decrypt_message(encrypted, key_b)
        except (ValueError, Exception):
            raised = True

        assert raised, "Decryption with wrong key should raise an exception"
        print("  [info] Wrong-key decryption raised an exception as expected")
        return _pass("Wrong key correctly rejected")
    except Exception as exc:
        return _fail("Wrong key rejection", exc)


# ---------------------------------------------------------------------------
# Test 4 — AES File Encryption Round Trip
# ---------------------------------------------------------------------------
def test_4_aes_file_encryption() -> bool:
    _sep("TEST 4 - AES File Encryption Round Trip")
    source_path    = os.path.join(TEST_DIR, "test_source.txt")
    encrypted_path = os.path.join(TEST_DIR, "test_encrypted.bin")
    decrypted_path = os.path.join(TEST_DIR, "test_decrypted.txt")
    original_content = "StegoChain file encryption test content 9876"

    try:
        # Write source file
        with open(source_path, "w", encoding="utf-8") as fh:
            fh.write(original_content)
        print(f"  [setup] Wrote source file: {source_path}")

        # Encrypt
        key  = generate_aes_key()
        meta = encrypt_file(source_path, key, encrypted_path)
        print(f"  [encrypt] Encrypted file written: {encrypted_path}")
        print(f"  [encrypt] Meta keys: {list(meta.keys())}")
        assert "nonce" in meta and "tag" in meta, "encrypt_file must return nonce and tag"

        # Decrypt
        result = decrypt_file(encrypted_path, key, meta["nonce"], meta["tag"], decrypted_path)
        print(f"  [decrypt] Decrypted file written: {decrypted_path}")
        assert result == decrypted_path

        with open(decrypted_path, "r", encoding="utf-8") as fh:
            recovered = fh.read()
        print(f"  [verify] Recovered content: \"{recovered}\"")
        assert recovered == original_content, f"Content mismatch: {recovered!r}"

        return _pass("File encrypt/decrypt round trip successful")
    except Exception as exc:
        return _fail("AES file encryption", exc)
    finally:
        _cleanup(source_path, encrypted_path, decrypted_path)
        print("  [cleanup] Temporary files removed")


# ---------------------------------------------------------------------------
# Test 5 — ECC Key Pair Generation
# ---------------------------------------------------------------------------
def test_5_ecc_keypair_generation() -> bool:
    _sep("TEST 5 - ECC Key Pair Generation")
    try:
        pair = generate_ecc_keypair()
        print(f"  [info] Returned keys: {list(pair.keys())}")
        assert "private_key" in pair, "Missing 'private_key'"
        assert "public_key"  in pair, "Missing 'public_key'"

        priv = pair["private_key"]
        pub  = pair["public_key"]
        assert isinstance(priv, str) and len(priv) > 0, "private_key empty or not a string"
        assert isinstance(pub, str)  and len(pub)  > 0, "public_key empty or not a string"
        assert "BEGIN" in priv, "private_key does not contain PEM header"
        assert "BEGIN" in pub,  "public_key does not contain PEM header"

        print(f"  [info] Private key header: {priv.splitlines()[0]}")
        print(f"  [info] Public  key header: {pub.splitlines()[0]}")

        # Also test export_public_key
        exported_pub = export_public_key(priv)
        assert "BEGIN" in exported_pub, "export_public_key did not return PEM"
        print(f"  [info] export_public_key works correctly")

        return _pass("ECC key pair generated with valid PEM headers")
    except Exception as exc:
        return _fail("ECC key pair generation", exc)


# ---------------------------------------------------------------------------
# Test 6 — ECDH Shared Key Agreement
# ---------------------------------------------------------------------------
def test_6_ecdh_shared_key() -> bool:
    _sep("TEST 6 - ECDH Shared Key Agreement")
    try:
        alice = generate_ecc_keypair()
        bob   = generate_ecc_keypair()

        key_alice = derive_shared_key(alice["private_key"], bob["public_key"])
        key_bob   = derive_shared_key(bob["private_key"],  alice["public_key"])

        print(f"  [info] Alice derived key length: {len(key_alice)} bytes")
        print(f"  [info] Bob   derived key length: {len(key_bob)} bytes")

        assert len(key_alice) == 32, f"Alice's key should be 32 bytes, got {len(key_alice)}"
        assert len(key_bob)   == 32, f"Bob's key should be 32 bytes, got {len(key_bob)}"
        assert key_alice == key_bob, "Derived keys do not match!"

        print(f"  [info] Keys match: {key_alice.hex()[:16]}...")
        return _pass("Alice and Bob derived the same 32-byte shared key")
    except Exception as exc:
        return _fail("ECDH shared key agreement", exc)


# ---------------------------------------------------------------------------
# Test 7 — Full Pipeline: ECDH then AES Encrypt/Decrypt
# ---------------------------------------------------------------------------
def test_7_full_ecc_aes_pipeline() -> bool:
    _sep("TEST 7 - Full ECC+AES Pipeline")
    original = "IoT sensor data: temperature=36.7 humidity=82 location=ward_4"
    try:
        # Key exchange
        alice = generate_ecc_keypair()
        bob   = generate_ecc_keypair()
        shared_alice = derive_shared_key(alice["private_key"], bob["public_key"])
        shared_bob   = derive_shared_key(bob["private_key"],  alice["public_key"])
        assert shared_alice == shared_bob, "Shared keys must match"
        print(f"  [info] Shared key established: {shared_alice.hex()[:16]}...")

        # Alice encrypts
        encrypted = encrypt_message(original, shared_alice)
        print(f"  [encrypt] Alice encrypted: ciphertext length = {len(encrypted['ciphertext'])} chars")

        # Bob decrypts
        decrypted = decrypt_message(encrypted, shared_bob)
        print(f"  [decrypt] Bob decrypted: \"{decrypted}\"")
        assert decrypted == original, f"Mismatch: {decrypted!r}"

        return _pass("Full ECC key exchange + AES encryption pipeline successful")
    except Exception as exc:
        return _fail("Full ECC+AES pipeline", exc)


# ---------------------------------------------------------------------------
# Test 8 — ECDSA Sign and Verify
# ---------------------------------------------------------------------------
def test_8_ecdsa_sign_verify() -> bool:
    _sep("TEST 8 - ECDSA Sign and Verify")
    data = b"StegoChain blockchain record hash 0xABCDEF"
    try:
        # Generate signer's key pair
        signer    = generate_ecc_keypair()
        impostor  = generate_ecc_keypair()

        # Sign
        signature = sign_data(data, signer["private_key"])
        print(f"  [sign]   Signature length: {len(signature)} chars (base64)")

        # Verify with correct public key
        valid = verify_signature(data, signature, signer["public_key"])
        print(f"  [verify] With correct key:  {valid}")
        assert valid is True, "Verification with correct key must return True"

        # Verify with wrong public key
        invalid = verify_signature(data, signature, impostor["public_key"])
        print(f"  [verify] With impostor key: {invalid}")
        assert invalid is False, "Verification with wrong key must return False"

        return _pass("ECDSA sign and verify works correctly")
    except Exception as exc:
        return _fail("ECDSA sign and verify", exc)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    results = {
        "Test 1 - AES Key Generation":        test_1_aes_key_generation(),
        "Test 2 - AES Encrypt/Decrypt":        test_2_aes_encrypt_decrypt(),
        "Test 3 - AES Wrong Key Rejection":    test_3_aes_wrong_key(),
        "Test 4 - AES File Encryption":        test_4_aes_file_encryption(),
        "Test 5 - ECC Key Pair Generation":    test_5_ecc_keypair_generation(),
        "Test 6 - ECDH Shared Key Agreement":  test_6_ecdh_shared_key(),
        "Test 7 - Full ECC+AES Pipeline":      test_7_full_ecc_aes_pipeline(),
        "Test 8 - ECDSA Sign and Verify":      test_8_ecdsa_sign_verify(),
    }

    print("\n==========================================")
    print("  CRYPTO MODULE TEST RESULTS")
    width = max(len(k) for k in results)
    for name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {name:<{width}} : {status}")
    print("==========================================\n")

    if not all(results.values()):
        sys.exit(1)
