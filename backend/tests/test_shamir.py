"""
Shamir's Secret Sharing Test Suite
====================================
Tests all 9 scenarios for the Shamir module and the KeyShare model.

Run from the project root:
    python backend/tests/test_shamir.py

No external services or files needed.
"""

import os
import sys

# ---------------------------------------------------------------------------
# Make backend package importable
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

from modules.secret_sharing.shamir import (
    split_secret,
    reconstruct_secret,
    verify_share,
    get_share_info,
)
from modules.crypto.aes_cipher import generate_aes_key, encrypt_message, decrypt_message
from models.keyshare import KeyShare


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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

def _pick(shares: list, indices: list) -> list:
    """Return shares whose share_index is in indices."""
    idx_set = set(indices)
    return [s for s in shares if s["share_index"] in idx_set]


# ---------------------------------------------------------------------------
# Test 1 — Basic Split and Reconstruct (k=3, n=5)
# ---------------------------------------------------------------------------
_shared_secret_t1 = None
_shares_t1        = None

def test_1_basic_split_reconstruct() -> bool:
    global _shared_secret_t1, _shares_t1
    _sep("TEST 1 - Basic Split/Reconstruct (k=3, n=5)")
    try:
        secret = os.urandom(32)
        _shared_secret_t1 = secret
        shares = split_secret(secret, k=3, n=5)
        _shares_t1 = shares

        print(f"  [info] Generated {len(shares)} shares")
        assert len(shares) == 5, f"Expected 5 shares, got {len(shares)}"

        for sh in shares:
            for key in ("share_index", "share_data", "k", "n", "checksum"):
                assert key in sh, f"Missing key '{key}' in share {sh.get('share_index')}"

        # Reconstruct from shares 1, 3, 5
        subset = _pick(shares, [1, 3, 5])
        recovered = reconstruct_secret(subset)
        print(f"  [info] Reconstructed from shares [1,3,5]")
        assert recovered == secret, "Reconstructed secret does not match original"

        return _pass("5 shares generated; reconstruction from [1,3,5] succeeded")
    except Exception as exc:
        return _fail("Basic split/reconstruct", exc)


# ---------------------------------------------------------------------------
# Test 2 — Multiple Share Combinations
# ---------------------------------------------------------------------------
def test_2_multiple_combinations() -> bool:
    _sep("TEST 2 - Multiple Share Combinations")
    try:
        assert _shares_t1 is not None, "Test 1 must run first"
        secret = _shared_secret_t1
        shares = _shares_t1

        for combo in ([1, 2, 3], [2, 4, 5], [1, 4, 5]):
            subset    = _pick(shares, combo)
            recovered = reconstruct_secret(subset)
            assert recovered == secret, f"Combo {combo} gave wrong secret"
            print(f"  [info] Shares {combo} -> CORRECT")

        return _pass("All three k-subsets reconstruct identical secret")
    except Exception as exc:
        return _fail("Multiple share combinations", exc)


# ---------------------------------------------------------------------------
# Test 3 — Insufficient Shares Fails
# ---------------------------------------------------------------------------
def test_3_insufficient_shares() -> bool:
    _sep("TEST 3 - Insufficient Shares Rejection")
    try:
        assert _shares_t1 is not None, "Test 1 must run first"
        subset = _pick(_shares_t1, [1, 2])   # only 2, need 3

        raised = False
        try:
            reconstruct_secret(subset)
        except ValueError as ve:
            raised = True
            print(f"  [info] ValueError raised as expected: {ve}")

        assert raised, "reconstruct_secret should raise ValueError for insufficient shares"
        return _pass("ValueError raised when only k-1 shares provided")
    except Exception as exc:
        return _fail("Insufficient shares rejection", exc)


# ---------------------------------------------------------------------------
# Test 4 — Custom Params (k=2, n=3)
# ---------------------------------------------------------------------------
def test_4_custom_k2_n3() -> bool:
    _sep("TEST 4 - Custom Params (k=2, n=3)")
    try:
        secret = os.urandom(32)
        shares = split_secret(secret, k=2, n=3)
        assert len(shares) == 3

        # Reconstruct with any 2
        for combo in ([1, 2], [1, 3], [2, 3]):
            recovered = reconstruct_secret(_pick(shares, combo))
            assert recovered == secret, f"Combo {combo} failed"
            print(f"  [info] Shares {combo} -> CORRECT")

        return _pass("k=2,n=3 split/reconstruct with all 2-share combos")
    except Exception as exc:
        return _fail("Custom k=2,n=3", exc)


# ---------------------------------------------------------------------------
# Test 5 — Custom Params (k=5, n=7)
# ---------------------------------------------------------------------------
def test_5_custom_k5_n7() -> bool:
    _sep("TEST 5 - Custom Params (k=5, n=7)")
    try:
        secret = os.urandom(32)
        shares = split_secret(secret, k=5, n=7)
        assert len(shares) == 7

        # Reconstruct with exactly 5
        subset5 = shares[:5]
        recovered = reconstruct_secret(subset5)
        assert recovered == secret, "k=5 reconstruction failed"
        print(f"  [info] Reconstruction with 5 shares -> CORRECT")

        # Try with only 4 — must fail
        raised = False
        try:
            reconstruct_secret(shares[:4])
        except ValueError as ve:
            raised = True
            print(f"  [info] 4 shares raised ValueError as expected: {ve}")
        assert raised, "Should raise ValueError with only 4 of 5 required shares"

        return _pass("k=5,n=7 reconstruct OK with 5; ValueError with 4")
    except Exception as exc:
        return _fail("Custom k=5,n=7", exc)


# ---------------------------------------------------------------------------
# Test 6 — Share Verification
# ---------------------------------------------------------------------------
def test_6_share_verification() -> bool:
    _sep("TEST 6 - Share Verification")
    try:
        secret = os.urandom(32)
        shares = split_secret(secret, k=3, n=5)

        # All genuine shares must verify
        for sh in shares:
            assert verify_share(sh) is True, f"Share {sh['share_index']} failed verify"
        print(f"  [info] All 5 genuine shares passed verify_share")

        # Tampered share_data
        tampered = dict(shares[0])
        tampered["share_data"] = "dGhpcyBpcyBub3QgdmFsaWQ="   # valid b64 but wrong length
        assert verify_share(tampered) is False, "Tampered share should fail verification"
        print(f"  [info] Tampered share correctly rejected by verify_share")

        # Missing key
        bad_keys = {k: v for k, v in shares[0].items() if k != "checksum"}
        assert verify_share(bad_keys) is False, "Share missing 'checksum' should fail"
        print(f"  [info] Share with missing key correctly rejected")

        return _pass("verify_share correctly accepts valid and rejects tampered shares")
    except Exception as exc:
        return _fail("Share verification", exc)


# ---------------------------------------------------------------------------
# Test 7 — Full Integration: AES Key Split and Reconstruct
# ---------------------------------------------------------------------------
def test_7_full_aes_integration() -> bool:
    _sep("TEST 7 - Full AES Key Split+Reconstruct")
    original_message = "Patient record: John Doe, Blood type O+, Ward 7"
    try:
        # Generate and use AES key
        aes_key   = generate_aes_key()
        encrypted = encrypt_message(original_message, aes_key)
        print(f"  [encrypt] Message encrypted with AES key")

        # Split key
        shares = split_secret(aes_key, k=3, n=5)
        print(f"  [split]   AES key split into 5 shares (k=3)")

        # Discard original key
        aes_key = None

        # Reconstruct from shares 2, 3, 5
        subset    = _pick(shares, [2, 3, 5])
        recovered = reconstruct_secret(subset)
        print(f"  [reconstruct] Key reconstructed from shares [2,3,5]")

        # Decrypt using reconstructed key
        decrypted = decrypt_message(encrypted, recovered)
        print(f"  [decrypt] Decrypted: \"{decrypted}\"")
        assert decrypted == original_message, "Decrypted message does not match"

        return _pass("AES key split, discarded, reconstructed, and used to decrypt")
    except Exception as exc:
        return _fail("Full AES integration", exc)


# ---------------------------------------------------------------------------
# Test 8 — get_share_info Output
# ---------------------------------------------------------------------------
def test_8_get_share_info() -> bool:
    _sep("TEST 8 - get_share_info Output")
    try:
        shares = split_secret(os.urandom(32), k=3, n=5)
        share3 = _pick(shares, [3])[0]
        info   = get_share_info(share3)

        print(f"  [info] get_share_info returned: {info}")
        assert info["share_index"]  == 3,    f"share_index should be 3, got {info['share_index']}"
        assert info["total_shares"] == 5,    f"total_shares should be 5, got {info['total_shares']}"
        assert info["threshold"]    == 3,    f"threshold should be 3, got {info['threshold']}"
        assert info["is_valid"]     is True, f"is_valid should be True"

        return _pass("get_share_info returns correct metadata for share 3")
    except Exception as exc:
        return _fail("get_share_info output", exc)


# ---------------------------------------------------------------------------
# Test 9 — KeyShare Model
# ---------------------------------------------------------------------------
def test_9_keyshare_model() -> bool:
    _sep("TEST 9 - KeyShare Model")
    try:
        shares  = split_secret(os.urandom(32), k=3, n=5)
        raw_sh  = shares[0]   # share_index == 1

        # Wrap in KeyShare
        ks = KeyShare(
            share_index = raw_sh["share_index"],
            share_data  = raw_sh["share_data"],
            k           = raw_sh["k"],
            n           = raw_sh["n"],
            checksum    = raw_sh["checksum"],
            owner_id    = "doctor_alice",
            session_id  = "session_001",
        )
        print(f"  [model]  Created: {ks}")

        # to_dict
        d = ks.to_dict()
        for field in ("share_index","share_data","k","n","checksum","owner_id","session_id","created_at"):
            assert field in d, f"to_dict missing '{field}'"
        print(f"  [to_dict] All fields present: {list(d.keys())}")

        # from_dict round-trip
        ks2 = KeyShare.from_dict(d)
        assert ks2 == ks, "from_dict round-trip object does not match original"
        print(f"  [from_dict] Round-trip successful")

        # to_share_dict — must contain exactly the keys reconstruct_secret needs
        sd = ks.to_share_dict()
        required_keys = {"share_index", "share_data", "k", "n", "checksum"}
        assert set(sd.keys()) == required_keys, (
            f"to_share_dict has wrong keys: {set(sd.keys())} vs {required_keys}"
        )
        print(f"  [to_share_dict] Keys: {sorted(sd.keys())}")

        # Verify to_share_dict is accepted by reconstruct_secret (in a group)
        all_sds = [s for s in shares]   # use raw dicts
        all_sds[0] = sd                  # replace first with KeyShare output
        recovered  = reconstruct_secret(all_sds[:3])
        print(f"  [reconstruct] Using to_share_dict output in reconstruction -> OK")

        return _pass("KeyShare to_dict, from_dict, and to_share_dict all work correctly")
    except Exception as exc:
        return _fail("KeyShare model", exc)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    results = {
        "Test 1 - Basic Split/Reconstruct (k=3,n=5)":  test_1_basic_split_reconstruct(),
        "Test 2 - Multiple Share Combinations":         test_2_multiple_combinations(),
        "Test 3 - Insufficient Shares Rejection":       test_3_insufficient_shares(),
        "Test 4 - Custom Params (k=2,n=3)":             test_4_custom_k2_n3(),
        "Test 5 - Custom Params (k=5,n=7)":             test_5_custom_k5_n7(),
        "Test 6 - Share Verification":                  test_6_share_verification(),
        "Test 7 - Full AES Key Split+Reconstruct":      test_7_full_aes_integration(),
        "Test 8 - get_share_info Output":               test_8_get_share_info(),
        "Test 9 - KeyShare Model":                      test_9_keyshare_model(),
    }

    print("\n==========================================")
    print("  SHAMIR SECRET SHARING MODULE TEST RESULTS")
    width = max(len(k) for k in results)
    for name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {name:<{width}} : {status}")
    print("==========================================\n")

    if not all(results.values()):
        sys.exit(1)
