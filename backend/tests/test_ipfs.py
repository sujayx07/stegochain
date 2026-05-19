"""
IPFS / Pinata Module Test Suite
=================================
Tests all 8 scenarios for the Pinata IPFS module.

Mode detection (automatic):
  LIVE  — PINATA_API_KEY is set in environment and is not the placeholder value
  MOCKED — API key missing or is placeholder → all HTTP calls are mocked

Run from the project root:
    python backend/tests/test_ipfs.py

For live mode first set:
    set PINATA_API_KEY=your_key
    set PINATA_SECRET_KEY=your_secret
"""

import io
import json
import os
import sys
import tempfile
from unittest.mock import MagicMock, patch

import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Make backend package importable
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

from modules.ipfs.pinata import (
    build_ipfs_metadata,
    get_pin_list,
    pin_exists,
    retrieve_from_ipfs,
    unpin_from_ipfs,
    upload_bytes_to_ipfs,
    upload_file_to_ipfs,
)
from modules.crypto.aes_cipher import decrypt_file, encrypt_file, generate_aes_key
from modules.steganography.lsb_image import embed_message_in_image, extract_message_from_image

# ---------------------------------------------------------------------------
# Detect live vs mocked mode
# ---------------------------------------------------------------------------
_PLACEHOLDER = "your_pinata_api_key_here"
API_KEY    = os.environ.get("PINATA_API_KEY", "")
SECRET_KEY = os.environ.get("PINATA_SECRET_KEY", "")
LIVE_MODE  = bool(API_KEY) and API_KEY != _PLACEHOLDER

TEST_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Shared state across tests
# ---------------------------------------------------------------------------
_uploaded_cid: str = ""

# ---------------------------------------------------------------------------
# Mock Pinata responses
# ---------------------------------------------------------------------------
MOCK_CID       = "QmTestCIDStegoChain1234567890abcdefghijklmnopqr"
MOCK_GATEWAY   = f"https://gateway.pinata.cloud/ipfs/{MOCK_CID}"
MOCK_UPLOAD_RESPONSE = {
    "IpfsHash":  MOCK_CID,
    "PinSize":   1234,
    "Timestamp": "2026-05-17T00:00:00.000Z",
}
MOCK_PIN_LIST_RESPONSE = {
    "count": 1,
    "rows": [
        {
            "ipfs_pin_hash": MOCK_CID,
            "size":          1234,
            "date_pinned":   "2026-05-17T00:00:00.000Z",
            "metadata":      {"name": "stegochain_sess_001"},
        }
    ],
}
# Bytes the mock gateway returns when we "retrieve" the file
MOCK_FILE_CONTENT = os.urandom(256)


def _mock_response(status: int = 200, json_body: dict = None, content: bytes = None):
    """Build a mock requests.Response object."""
    resp = MagicMock()
    resp.status_code = status
    resp.ok = (200 <= status < 300)
    resp.text = json.dumps(json_body) if json_body else ""
    resp.json.return_value = json_body or {}
    resp.content = content or b""
    return resp


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


def _cleanup(*paths: str) -> None:
    for p in paths:
        try:
            os.remove(p)
        except FileNotFoundError:
            pass


def _make_test_png(path: str, size: int = 10) -> None:
    """Create a small random-colour PNG at *path*."""
    rng  = np.random.default_rng(seed=7)
    data = rng.integers(0, 256, (size, size, 3), dtype=np.uint8)
    Image.fromarray(data, "RGB").save(path)


# ---------------------------------------------------------------------------
# Test 1 — build_ipfs_metadata (always live, no API needed)
# ---------------------------------------------------------------------------

def test_1_build_metadata() -> bool:
    _sep("TEST 1 - build_ipfs_metadata")
    try:
        meta = build_ipfs_metadata(
            session_id="sess_001",
            sender_id="alice",
            receiver_id="bob",
            file_type="image",
        )
        print(f"  [info] Returned: {meta}")

        assert meta["name"] == "stegochain_sess_001", "Wrong name"
        kv = meta["keyvalues"]
        assert kv["session_id"]  == "sess_001", "Wrong session_id"
        assert kv["sender_id"]   == "alice",    "Wrong sender_id"
        assert kv["receiver_id"] == "bob",      "Wrong receiver_id"
        assert kv["file_type"]   == "image",    "Wrong file_type"
        assert kv["app"]         == "stegochain", "Wrong app"

        return _pass("build_ipfs_metadata returns correct structure")
    except Exception as exc:
        return _fail("build_ipfs_metadata", exc)


# ---------------------------------------------------------------------------
# Test 2 — upload_file_to_ipfs
# ---------------------------------------------------------------------------

def test_2_upload_file(ctx: dict) -> bool:
    global _uploaded_cid
    _sep("TEST 2 - upload_file_to_ipfs")
    tmp_png = os.path.join(TEST_DIR, "test_upload_img.png")
    try:
        _make_test_png(tmp_png, size=10)
        print(f"  [setup] Created test PNG: {tmp_png}")

        if LIVE_MODE:
            result = upload_file_to_ipfs(tmp_png, API_KEY, SECRET_KEY)
        else:
            with patch("modules.ipfs.pinata.requests.post",
                       return_value=_mock_response(200, MOCK_UPLOAD_RESPONSE)):
                result = upload_file_to_ipfs(tmp_png, "mock_key", "mock_secret")

        print(f"  [info] Result: {result}")
        for key in ("cid", "size", "timestamp", "file_name", "gateway_url"):
            assert key in result, f"Missing key '{key}'"

        assert result["cid"], "cid is empty"
        assert result["gateway_url"].startswith("https://gateway.pinata.cloud/ipfs/"), \
            "gateway_url has wrong prefix"

        _uploaded_cid = result["cid"]
        ctx["cid"]    = _uploaded_cid
        ctx["content"] = open(tmp_png, "rb").read()

        print(f"  [info] CID: {_uploaded_cid}")
        return _pass("upload_file_to_ipfs returned correct dict with valid CID")
    except Exception as exc:
        ctx["cid"]     = MOCK_CID
        ctx["content"] = MOCK_FILE_CONTENT
        return _fail("upload_file_to_ipfs", exc)
    finally:
        _cleanup(tmp_png)
        print("  [cleanup] Temp PNG removed")


# ---------------------------------------------------------------------------
# Test 3 — upload_bytes_to_ipfs
# ---------------------------------------------------------------------------

def test_3_upload_bytes() -> bool:
    _sep("TEST 3 - upload_bytes_to_ipfs")
    try:
        data = os.urandom(256)
        print(f"  [info] Uploading {len(data)} random bytes")

        if LIVE_MODE:
            result = upload_bytes_to_ipfs(data, "test_encrypted_stego.bin", API_KEY, SECRET_KEY)
        else:
            with patch("modules.ipfs.pinata.requests.post",
                       return_value=_mock_response(200, MOCK_UPLOAD_RESPONSE)):
                result = upload_bytes_to_ipfs(data, "test_encrypted_stego.bin",
                                              "mock_key", "mock_secret")

        print(f"  [info] Result: {result}")
        for key in ("cid", "size", "timestamp", "file_name", "gateway_url"):
            assert key in result, f"Missing key '{key}'"
        assert result["cid"], "cid is empty"

        return _pass("upload_bytes_to_ipfs returned correct dict")
    except Exception as exc:
        return _fail("upload_bytes_to_ipfs", exc)


# ---------------------------------------------------------------------------
# Test 4 — retrieve_from_ipfs
# ---------------------------------------------------------------------------

def test_4_retrieve(ctx: dict) -> bool:
    _sep("TEST 4 - retrieve_from_ipfs")
    cid      = ctx.get("cid", MOCK_CID)
    expected = ctx.get("content", MOCK_FILE_CONTENT)
    tmp_out  = os.path.join(TEST_DIR, "test_retrieved.bin")

    try:
        if LIVE_MODE:
            raw = retrieve_from_ipfs(cid)
            retrieve_from_ipfs(cid, output_path=tmp_out)
        else:
            with patch("modules.ipfs.pinata.requests.get",
                       return_value=_mock_response(200, content=expected)):
                raw = retrieve_from_ipfs(cid)
            with patch("modules.ipfs.pinata.requests.get",
                       return_value=_mock_response(200, content=expected)):
                retrieve_from_ipfs(cid, output_path=tmp_out)

        assert isinstance(raw, bytes) and len(raw) > 0, "Retrieved bytes are empty"
        assert os.path.exists(tmp_out),                 "output_path file not created"
        assert os.path.getsize(tmp_out) > 0,            "output_path file is empty"
        print(f"  [info] Retrieved {len(raw)} bytes from CID {cid[:20]}...")

        ctx["retrieved_bytes"] = raw
        return _pass("retrieve_from_ipfs returned bytes and saved to file")
    except Exception as exc:
        ctx["retrieved_bytes"] = expected
        return _fail("retrieve_from_ipfs", exc)
    finally:
        _cleanup(tmp_out)


# ---------------------------------------------------------------------------
# Test 5 — pin_exists
# ---------------------------------------------------------------------------

def test_5_pin_exists(ctx: dict) -> bool:
    _sep("TEST 5 - pin_exists")
    cid = ctx.get("cid", MOCK_CID)
    try:
        fake_cid = "QmFakeCIDThatDoesNotExist123456789"

        if LIVE_MODE:
            exists      = pin_exists(cid, API_KEY, SECRET_KEY)
            not_exists  = pin_exists(fake_cid, API_KEY, SECRET_KEY)
        else:
            real_body = {"rows": [{"ipfs_pin_hash": cid}]}
            fake_body = {"rows": []}
            with patch("modules.ipfs.pinata.requests.get",
                       side_effect=[
                           _mock_response(200, real_body),
                           _mock_response(200, fake_body),
                       ]):
                exists     = pin_exists(cid, "mock_key", "mock_secret")
                not_exists = pin_exists(fake_cid, "mock_key", "mock_secret")

        print(f"  [info] pin_exists({cid[:20]}...) = {exists}")
        print(f"  [info] pin_exists(fake_cid)    = {not_exists}")
        assert exists     is True,  "Known CID should exist"
        assert not_exists is False, "Fake CID should not exist"

        return _pass("pin_exists correctly identifies existing and non-existing pins")
    except Exception as exc:
        return _fail("pin_exists", exc)


# ---------------------------------------------------------------------------
# Test 6 — get_pin_list
# ---------------------------------------------------------------------------

def test_6_get_pin_list() -> bool:
    _sep("TEST 6 - get_pin_list")
    try:
        if LIVE_MODE:
            pins = get_pin_list(API_KEY, SECRET_KEY, limit=5)
        else:
            with patch("modules.ipfs.pinata.requests.get",
                       return_value=_mock_response(200, MOCK_PIN_LIST_RESPONSE)):
                pins = get_pin_list("mock_key", "mock_secret", limit=5)

        print(f"  [info] Returned {len(pins)} pins")
        assert isinstance(pins, list), "get_pin_list must return a list"

        if pins:
            for item in pins:
                for key in ("cid", "size", "timestamp", "file_name"):
                    assert key in item, f"Pin item missing key '{key}'"
            print(f"  [info] First pin: {pins[0]}")

        return _pass("get_pin_list returned list with correct structure")
    except Exception as exc:
        return _fail("get_pin_list", exc)


# ---------------------------------------------------------------------------
# Test 7 — Full Pipeline: Stego → AES Encrypt → IPFS → Retrieve → Decrypt → Extract
# ---------------------------------------------------------------------------

def test_7_full_pipeline() -> bool:
    _sep("TEST 7 - Full Encrypt+Upload+Retrieve Pipeline")

    src_img       = os.path.join(TEST_DIR, "t7_source.png")
    stego_img     = os.path.join(TEST_DIR, "t7_stego.png")
    enc_bin       = os.path.join(TEST_DIR, "t7_encrypted.bin")
    retrieved_bin = os.path.join(TEST_DIR, "t7_retrieved.bin")
    decrypted_img = os.path.join(TEST_DIR, "t7_decrypted.png")
    hidden_msg    = "IPFS pipeline test"

    try:
        # 1. Create source image (50x50)
        _make_test_png(src_img, size=50)
        print(f"  [step 1] Created 50x50 source image")

        # 2. Embed steganographic message
        embed_message_in_image(src_img, hidden_msg, stego_img)
        print(f"  [step 2] Embedded message into stego image")

        # 3. AES encrypt the stego image
        aes_key = generate_aes_key()
        meta_enc = encrypt_file(stego_img, aes_key, enc_bin)
        print(f"  [step 3] Encrypted stego image -> {enc_bin}")

        # 4. Upload encrypted binary to IPFS
        if LIVE_MODE:
            upload_result = upload_file_to_ipfs(enc_bin, API_KEY, SECRET_KEY)
        else:
            with patch("modules.ipfs.pinata.requests.post",
                       return_value=_mock_response(200, MOCK_UPLOAD_RESPONSE)):
                upload_result = upload_file_to_ipfs(enc_bin, "mock_key", "mock_secret")

        cid = upload_result["cid"]
        print(f"  [step 4] Uploaded to IPFS, CID: {cid[:20]}...")
        assert cid, "CID is empty"

        # 5. Build metadata
        metadata = build_ipfs_metadata("sess_pipeline", "alice", "bob", "image")
        assert metadata["name"] == "stegochain_sess_pipeline"
        print(f"  [step 5] Built metadata: {metadata['name']}")

        # 6. Retrieve from IPFS
        if LIVE_MODE:
            retrieved_bytes = retrieve_from_ipfs(cid)
        else:
            # For mock: return the actual encrypted file bytes
            with open(enc_bin, "rb") as fh:
                actual_enc_bytes = fh.read()
            with patch("modules.ipfs.pinata.requests.get",
                       return_value=_mock_response(200, content=actual_enc_bytes)):
                retrieved_bytes = retrieve_from_ipfs(cid)

        with open(retrieved_bin, "wb") as fh:
            fh.write(retrieved_bytes)
        print(f"  [step 6] Retrieved {len(retrieved_bytes)} bytes from IPFS")

        # 7. Decrypt
        decrypt_file(retrieved_bin, aes_key, meta_enc["nonce"], meta_enc["tag"], decrypted_img)
        print(f"  [step 7] Decrypted to image file")

        # 8. Extract hidden message
        extracted = extract_message_from_image(decrypted_img)
        print(f"  [step 8] Extracted message: \"{extracted}\"")
        assert extracted == hidden_msg, f"Expected {hidden_msg!r}, got {extracted!r}"

        return _pass("Full pipeline: stego -> encrypt -> IPFS -> retrieve -> decrypt -> extract")
    except Exception as exc:
        return _fail("Full pipeline", exc)
    finally:
        _cleanup(src_img, stego_img, enc_bin, retrieved_bin, decrypted_img)
        print("  [cleanup] All temp files removed")


# ---------------------------------------------------------------------------
# Test 8 — unpin_from_ipfs
# ---------------------------------------------------------------------------

def test_8_unpin(ctx: dict) -> bool:
    _sep("TEST 8 - unpin_from_ipfs")
    cid = ctx.get("cid", MOCK_CID)
    try:
        if LIVE_MODE:
            result = unpin_from_ipfs(cid, API_KEY, SECRET_KEY)
        else:
            with patch("modules.ipfs.pinata.requests.delete",
                       return_value=_mock_response(200)):
                result = unpin_from_ipfs(cid, "mock_key", "mock_secret")

        print(f"  [info] unpin_from_ipfs({cid[:20]}...) = {result}")
        assert result is True, "unpin_from_ipfs should return True on success"

        return _pass("unpin_from_ipfs returned True")
    except Exception as exc:
        return _fail("unpin_from_ipfs", exc)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mode_label = "LIVE" if LIVE_MODE else "MOCKED"
    print(f"\n==========================================")
    print(f"  IPFS MODULE TEST SUITE")
    print(f"  Mode: {mode_label}")
    if LIVE_MODE:
        print(f"  API key: {API_KEY[:6]}...{API_KEY[-4:]}")
    else:
        print(f"  (Set PINATA_API_KEY env var to run in LIVE mode)")
    print(f"==========================================")

    ctx = {}   # shared state: cid, content, retrieved_bytes

    results = {
        "Test 1 - build_ipfs_metadata":          test_1_build_metadata(),
        "Test 2 - upload_file_to_ipfs":           test_2_upload_file(ctx),
        "Test 3 - upload_bytes_to_ipfs":          test_3_upload_bytes(),
        "Test 4 - retrieve_from_ipfs":            test_4_retrieve(ctx),
        "Test 5 - pin_exists":                    test_5_pin_exists(ctx),
        "Test 6 - get_pin_list":                  test_6_get_pin_list(),
        "Test 7 - Full Encrypt+Upload+Retrieve":  test_7_full_pipeline(),
        "Test 8 - unpin_from_ipfs":               test_8_unpin(ctx),
    }

    print(f"\n==========================================")
    print(f"  IPFS MODULE TEST RESULTS")
    print(f"  Mode: {mode_label}")
    width = max(len(k) for k in results)
    for name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {name:<{width}} : {status}")
    print(f"==========================================\n")

    if not all(results.values()):
        sys.exit(1)
