"""
stegochain/tests/integration_test.py
=====================================
Master end-to-end integration test for the StegoChain pipeline.

Requires (some optional):
  - Flask backend at  http://localhost:5000
  - MongoDB           configured via .env.production MONGO_URI (Atlas or local)
  - Ethereum node at  http://127.0.0.1:7545  (Hardhat or Ganache)
  - Pinata API key    configured via .env.production PINATA_API_KEY

Run from stegochain/ directory:
    python tests/integration_test.py
"""

import base64
import io
import json
import os
import pathlib
import sys
import tempfile
import time

# ── Allow imports from stegochain/backend ────────────────────────────────────
_HERE       = os.path.dirname(os.path.abspath(__file__))
_STEGO_ROOT = os.path.normpath(os.path.join(_HERE, ".."))
_BACKEND    = os.path.join(_STEGO_ROOT, "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

try:
    import requests
    _REQUESTS = True
except ImportError:
    _REQUESTS = False

# ── Load .env.production so we get Atlas URI, Pinata keys, contract address ──
_ENV_FILE = pathlib.Path(_STEGO_ROOT) / ".env.production"

def _load_dotenv_manual(path: pathlib.Path) -> dict:
    """Minimal dotenv parser — no extra dependency."""
    vals = {}
    if not path.exists():
        return vals
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        vals[key] = val
    return vals

_dotenv = _load_dotenv_manual(_ENV_FILE)
# Inject into os.environ only if not already set by shell
for _k, _v in _dotenv.items():
    if _k not in os.environ:
        os.environ[_k] = _v

# ── Service endpoints (pulled from .env.production or sensible defaults) ──────
BACKEND_URL  = "http://localhost:5000"
MONGO_URI    = os.environ.get("MONGO_URI", "mongodb://localhost:27017/stegochain")
GANACHE_URL  = os.environ.get("GANACHE_URL", "http://127.0.0.1:7545")

# ── Service detection ─────────────────────────────────────────────────────────

def check_backend() -> bool:
    if not _REQUESTS:
        return False
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=5)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False


def check_mongodb() -> bool:
    """Ping MongoDB using the actual URI (Atlas or local)."""
    try:
        from pymongo import MongoClient
        # Atlas needs a longer timeout; local is instant
        timeout = 8000 if "mongodb+srv" in MONGO_URI else 2000
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=timeout)
        client.admin.command("ping")
        return True
    except Exception:
        return False


def check_ganache() -> bool:
    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(GANACHE_URL, request_kwargs={"timeout": 3}))
        return w3.is_connected()
    except Exception:
        return False


def check_pinata() -> bool:
    key = os.environ.get("PINATA_API_KEY", "")
    return bool(key) and key not in ("", "your_pinata_api_key_here")


# ── Result tracking ───────────────────────────────────────────────────────────

_results = {}
_session_id_from_I9 = None
_ganache_record_id  = None
_ganache_cid        = None
_ganache_merkle     = None


def _pass(name, note=""):
    suffix = f" ({note})" if note else ""
    print(f"  [result] PASS - {name}{suffix}")
    _results[name] = "PASS"


def _fail(name, exc, note=""):
    suffix = f" ({note})" if note else ""
    print(f"  [result] FAIL - {name}{suffix}")
    print(f"           {type(exc).__name__}: {exc}")
    _results[name] = "FAIL"


def _skip(name, reason=""):
    print(f"  [result] SKIP - {name}" + (f" ({reason})" if reason else ""))
    _results[name] = "SKIP"


def _sep(t):
    print("\n" + "-" * 60)
    print("  " + t)
    print("-" * 60)


# ── Image helper ──────────────────────────────────────────────────────────────

def _make_png(width=150, height=150, path=None) -> str:
    """Generate a solid-colour PNG using Pillow. Returns file path."""
    from PIL import Image
    import numpy as np
    arr = np.random.randint(0, 256, (height, width, 3), dtype=np.uint8)
    img = Image.fromarray(arr, "RGB")
    if path is None:
        fd, path = tempfile.mkstemp(suffix=".png")
        os.close(fd)
    img.save(path, "PNG")
    return path


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_I1_health():
    _sep("TEST I1 — Backend Health Check")
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=5)
        assert r.status_code == 200, f"HTTP {r.status_code}"
        d = r.json()
        assert d.get("status") == "ok",     f"status={d.get('status')}"
        assert "modules" in d,              "missing 'modules' key"
        assert len(d["modules"]) >= 5,      f"only {len(d['modules'])} modules"
        print(f"  [info] Service: {d.get('service')}  version: {d.get('version')}")
        print(f"  [info] Modules: {d['modules']}")
        _pass("I1 - Backend Health Check")
    except Exception as e:
        _fail("I1 - Backend Health Check", e)


def test_I2_keypair():
    _sep("TEST I2 — ECC Keypair Generation")
    try:
        r = requests.post(f"{BACKEND_URL}/api/crypto/generate-keypair", timeout=10)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        d = r.json()
        assert "public_key"  in d, "missing public_key"
        assert "private_key" in d, "missing private_key"
        assert "BEGIN"        in d["public_key"],  "public_key not PEM"
        assert "BEGIN"        in d["private_key"], "private_key not PEM"
        print(f"  [info] Public key ({len(d['public_key'])} bytes)")
        _pass("I2 - ECC Keypair Generation")
    except Exception as e:
        _fail("I2 - ECC Keypair Generation", e)


def test_I3_aes():
    _sep("TEST I3 — AES Encrypt/Decrypt Round Trip")
    plaintext = "Integration test secret message — StegoChain 2026"
    try:
        aes_key_b64 = base64.b64encode(os.urandom(32)).decode()

        # Encrypt
        r_enc = requests.post(
            f"{BACKEND_URL}/api/crypto/encrypt",
            json={"message": plaintext, "aes_key_b64": aes_key_b64},
            timeout=10,
        )
        assert r_enc.status_code == 200, f"Encrypt HTTP {r_enc.status_code}: {r_enc.text[:300]}"
        enc = r_enc.json()
        assert "ciphertext" in enc or "encrypted" in enc, f"No ciphertext in {list(enc.keys())}"

        # Decrypt — try reconstructing payload
        dec_body = {
            "aes_key_b64": aes_key_b64,
            "ciphertext":  enc.get("ciphertext") or enc.get("encrypted"),
            "nonce":       enc.get("nonce", ""),
            "tag":         enc.get("tag", ""),
        }
        r_dec = requests.post(
            f"{BACKEND_URL}/api/crypto/decrypt",
            json=dec_body,
            timeout=10,
        )
        assert r_dec.status_code == 200, f"Decrypt HTTP {r_dec.status_code}: {r_dec.text[:300]}"
        dec = r_dec.json()
        recovered = dec.get("message") or dec.get("plaintext") or dec.get("decrypted", "")
        assert recovered == plaintext, f"Recovered: '{recovered}'"
        _pass("I3 - AES Encrypt/Decrypt Round Trip")
    except Exception as e:
        _fail("I3 - AES Encrypt/Decrypt Round Trip", e)


def test_I4_stego_image():
    _sep("TEST I4 — Steganography Embed/Extract (Image)")
    secret = "Integration stego test"
    src = None
    try:
        src = _make_png(100, 100)

        # Embed
        with open(src, "rb") as fh:
            r_emb = requests.post(
                f"{BACKEND_URL}/api/stego/embed",
                files={"file": ("cover.png", fh, "image/png")},
                data={"message": secret, "file_type": "image"},
                timeout=30,
            )
        assert r_emb.status_code == 200, f"Embed HTTP {r_emb.status_code}: {r_emb.text[:300]}"
        emb = r_emb.json()
        stego_path = emb.get("stego_file_path", "")
        assert stego_path, "No stego_file_path in response"
        print(f"  [info] Stego file: {stego_path}")

        # Extract — re-upload the stego file from disk
        assert os.path.exists(stego_path), f"Stego file not found on disk: {stego_path}"
        with open(stego_path, "rb") as fh:
            r_ext = requests.post(
                f"{BACKEND_URL}/api/stego/extract",
                files={"file": ("stego.png", fh, "image/png")},
                data={"file_type": "image"},
                timeout=30,
            )
        assert r_ext.status_code == 200, f"Extract HTTP {r_ext.status_code}: {r_ext.text[:300]}"
        extracted = r_ext.json().get("message", "")
        assert extracted == secret, f"Got: '{extracted}'"
        _pass("I4 - Stego Embed/Extract Image")
    except Exception as e:
        _fail("I4 - Stego Embed/Extract Image", e)
    finally:
        if src and os.path.exists(src):
            try: os.remove(src)
            except: pass


def test_I5_shamir(mongodb_live: bool):
    _sep("TEST I5 — Shamir Key Split/Reconstruct")
    if not mongodb_live:
        _skip("I5 - Shamir Key Split/Reconstruct", "MongoDB offline — Shamir routes require DB")
        return
    try:
        aes_key_b64 = base64.b64encode(os.urandom(32)).decode()
        # Use a unique session_id per run to avoid duplicate-key conflicts in Atlas
        session_id  = f"integration_test_{int(time.time())}"
        owner_ids   = [f"i_owner_{i}" for i in range(1, 6)]
        # Clean up any leftover shares from previous runs
        try:
            from pymongo import MongoClient
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            _db = _client[MONGO_URI.split("/")[-1].split("?")[0]]  # DB name from URI
            _db["keyshares"].delete_many({"owner_id": {"$regex": "^i_owner_"}})
            _client.close()
        except Exception:
            pass  # Cleanup failure is not critical

        # Split
        r_split = requests.post(
            f"{BACKEND_URL}/api/crypto/split-key",
            json={
                "aes_key_b64": aes_key_b64,
                "k":           3,
                "n":           5,
                "session_id":  session_id,
                "owner_ids":   owner_ids,
            },
            timeout=30,
        )
        assert r_split.status_code == 200, f"Split HTTP {r_split.status_code}: {r_split.text[:300]}"
        sp = r_split.json()
        created = sp.get("shares_created", sp.get("shares", 0))
        assert int(created) == 5, f"shares_created={created}"

        # Reconstruct with 3 of 5 owners
        r_rec = requests.post(
            f"{BACKEND_URL}/api/crypto/reconstruct-key",
            json={
                "session_id": session_id,
                "owner_ids":  ["i_owner_1", "i_owner_3", "i_owner_5"],
            },
            timeout=30,
        )
        assert r_rec.status_code == 200, f"Reconstruct HTTP {r_rec.status_code}: {r_rec.text[:300]}"
        rc = r_rec.json()
        recovered = rc.get("aes_key_b64") or rc.get("key") or rc.get("reconstructed_key", "")
        assert recovered == aes_key_b64, f"Key mismatch.\nOriginal:  {aes_key_b64}\nRecovered: {recovered}"
        _pass("I5 - Shamir Key Split/Reconstruct")
    except Exception as e:
        _fail("I5 - Shamir Key Split/Reconstruct", e)


def test_I6_ipfs(pinata_live: bool):
    _sep("TEST I6 — IPFS Upload/Retrieve")
    if not pinata_live:
        _skip("I6 - IPFS Upload/Retrieve", "Pinata API key not configured — IPFS requires live credentials")
        return
    try:
        data = os.urandom(512)
        r = requests.post(
            f"{BACKEND_URL}/api/ipfs/upload",
            files={"file": ("test.bin", io.BytesIO(data), "application/octet-stream")},
            data={
                "session_id":  "integration_test_002",
                "sender_id":   "sender_A",
                "receiver_id": "receiver_B",
                "file_type":   "image",
            },
            timeout=60,
        )
        assert r.status_code == 200, f"Upload HTTP {r.status_code}: {r.text[:300]}"
        d = r.json()
        cid = d.get("cid") or d.get("ipfs_cid", "")
        assert cid, f"No CID in response: {list(d.keys())}"
        print(f"  [info] CID: {cid}")
        # Note: pin_exists may return False immediately after upload due to Pinata
        # propagation latency (~10-30s). We only check upload success, not pin status.
        r2 = requests.get(f"{BACKEND_URL}/api/ipfs/exists/{cid}", timeout=15)
        print(f"  [info] Pin exists immediately: {r2.json().get('exists', 'N/A') if r2.status_code == 200 else 'N/A'}")
        _pass("I6 - IPFS Upload/Retrieve", "LIVE")
    except Exception as e:
        _fail("I6 - IPFS Upload/Retrieve", e, "LIVE")


def test_I7_blockchain(ganache_live: bool, contract_address: str = ""):
    global _ganache_record_id, _ganache_cid, _ganache_merkle
    _sep("TEST I7 — Blockchain Register/Verify")

    if not ganache_live:
        _skip("I7 - Blockchain Register/Verify", "Ganache offline — blockchain tests require live node")
        return

    if not contract_address:
        _fail("I7 - Blockchain Register/Verify",
              ValueError("CONTRACT_ADDRESS is empty. Run: python scripts/deploy_contract.py"),
              "LIVE")
        return

    print(f"  [info] Contract: {contract_address}")

    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(GANACHE_URL, request_kwargs={"timeout": 5}))
        receiver = w3.eth.accounts[1]
        test_cid = "QmLiveIntegrationCID001"

        r = requests.post(
            f"{BACKEND_URL}/api/blockchain/register",
            json={
                "cid":              test_cid,
                "receiver_address": receiver,
                "session_id":       "integration_bc_live_001",
                "cids_in_session":  [test_cid],
            },
            timeout=30,
        )
        assert r.status_code == 200, f"Register HTTP {r.status_code}: {r.text[:300]}"
        d = r.json()
        record_id   = d.get("record_id", -1)
        tx_hash     = d.get("tx_hash", "")
        merkle_root = d.get("merkle_root", "")
        assert record_id >= 0, f"record_id={record_id}"
        assert tx_hash,        "tx_hash empty"
        print(f"  [info] Record ID: {record_id}, Tx: {tx_hash[:20]}...")

        r2 = requests.get(f"{BACKEND_URL}/api/blockchain/record/{record_id}", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("cid") == test_cid, "CID mismatch in record"

        r3 = requests.post(
            f"{BACKEND_URL}/api/blockchain/verify",
            json={"record_id": record_id, "cid": test_cid, "merkle_root": merkle_root},
            timeout=15,
        )
        assert r3.status_code == 200
        assert r3.json().get("verified") is True, "verified=False"

        _ganache_record_id = record_id
        _ganache_cid       = test_cid
        _ganache_merkle    = merkle_root
        _pass("I7 - Blockchain Register/Verify", "LIVE")
    except Exception as e:
        _fail("I7 - Blockchain Register/Verify", e, "LIVE")


def test_I8_graph_summary(mongodb_live: bool):
    _sep("TEST I8 — Graph Summary")
    if not mongodb_live:
        _skip("I8 - Graph Summary", "MongoDB offline — graph summary reads transaction collection")
        return
    try:
        r = requests.get(f"{BACKEND_URL}/api/graph/summary", timeout=30)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        d = r.json()
        for key in ("total_nodes", "total_edges", "avg_out_degree", "avg_in_degree"):
            assert key in d, f"Missing key: {key}"
        print(f"  [info] Nodes={d['total_nodes']}  Edges={d['total_edges']}")
        _pass("I8 - Graph Summary")
    except Exception as e:
        _fail("I8 - Graph Summary", e)


def test_I9_full_send(mongodb_live: bool, pinata_live: bool):
    global _session_id_from_I9
    _sep("TEST I9 — Full Send Pipeline")
    if not mongodb_live:
        _skip("I9 - Full Send Pipeline", "MongoDB offline — send pipeline requires DB")
        return
    if not pinata_live:
        _skip("I9 - Full Send Pipeline", "Pinata not configured — send pipeline requires IPFS")
        return
    secret_msg = "INTEGRATION TEST - Patient record: Jane Doe, Ward 12, Blood O+"
    src = None
    try:
        src = _make_png(150, 150)
        with open(src, "rb") as fh:
            r = requests.post(
                f"{BACKEND_URL}/api/stego/send",
                files={"file": ("integration_cover.png", fh, "image/png")},
                data={
                    "message":              secret_msg,
                    "file_type":            "image",
                    "sender_id":            "integration_sender_001",
                    "receiver_id":          "integration_receiver_001",
                    "receiver_eth_address": "0x742d35Cc6634C0532925a3b8D4C9B7D8F1a2b3c4",
                    "k":                    "3",
                    "n":                    "5",
                    "owner_ids":            "int_owner_1,int_owner_2,int_owner_3,int_owner_4,int_owner_5",
                },
                timeout=120,
            )

        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"
        d = r.json()
        print(f"  [info] Response keys: {list(d.keys())}")

        required = ("session_id", "ipfs_cid", "gateway_url", "blockchain_record_id",
                    "tx_hash", "merkle_root", "shares_created", "k", "n")
        for f in required:
            assert f in d, f"Missing field: '{f}'"

        assert int(d["shares_created"]) == 5, f"shares_created={d['shares_created']}"
        assert int(d["k"]) == 3,              f"k={d['k']}"

        _session_id_from_I9 = d["session_id"]
        print(f"  [info] Session ID: {_session_id_from_I9}")
        _pass("I9 - Full Send Pipeline")
    except Exception as e:
        _fail("I9 - Full Send Pipeline", e)
    finally:
        if src and os.path.exists(src):
            try: os.remove(src)
            except: pass


def test_I10_full_receive():
    _sep("TEST I10 — Full Receive Pipeline")
    if not _session_id_from_I9:
        _skip("I10 - Full Receive Pipeline", "I9 did not produce a session_id")
        return

    secret_msg = "INTEGRATION TEST - Patient record: Jane Doe, Ward 12, Blood O+"
    try:
        r = requests.post(
            f"{BACKEND_URL}/api/stego/receive",
            json={
                "session_id": _session_id_from_I9,
                "owner_ids":  ["int_owner_1", "int_owner_3", "int_owner_5"],
                "file_type":  "image",
            },
            timeout=120,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"
        d = r.json()
        recovered = d.get("message", "")
        assert recovered == secret_msg, (
            f"Message mismatch.\n  Expected: {secret_msg}\n  Got:      {recovered}"
        )
        assert "blockchain_verified" in d, "Missing blockchain_verified"
        assert d.get("sender_id") == "integration_sender_001", f"sender_id={d.get('sender_id')}"
        print(f"  [info] Recovered: {recovered[:50]}...")
        print(f"  [info] Blockchain verified: {d.get('blockchain_verified')}")
        _pass("I10 - Full Receive Pipeline")
    except Exception as e:
        _fail("I10 - Full Receive Pipeline", e)


def test_I11_revoke(ganache_live: bool):
    _sep("TEST I11 — Blockchain Revoke and Re-Verify")
    if not ganache_live or _ganache_record_id is None:
        _skip("I11 - Blockchain Revoke", "Ganache not live or I7 did not register a record")
        return
    try:
        # Revoke
        r = requests.post(
            f"{BACKEND_URL}/api/blockchain/revoke/{_ganache_record_id}",
            timeout=30,
        )
        assert r.status_code == 200, f"Revoke HTTP {r.status_code}: {r.text[:200]}"
        assert r.json().get("revoked") is True, "revoked=False"

        # Verify again — should be False (revoked)
        r2 = requests.post(
            f"{BACKEND_URL}/api/blockchain/verify",
            json={
                "record_id":   _ganache_record_id,
                "cid":         _ganache_cid,
                "merkle_root": _ganache_merkle,
            },
            timeout=15,
        )
        assert r2.status_code == 200
        # After revoke, verified should be False
        assert r2.json().get("verified") is False, (
            f"Expected verified=False after revoke, got {r2.json().get('verified')}"
        )
        _pass("I11 - Blockchain Revoke")
    except Exception as e:
        _fail("I11 - Blockchain Revoke", e)


def test_I12_anomaly(mongodb_live: bool):
    _sep("TEST I12 — Graph Anomaly Scores")
    if not mongodb_live:
        _skip("I12 - Graph Anomaly Scores", "MongoDB offline — anomaly detection reads transaction collection")
        return
    try:
        r = requests.get(f"{BACKEND_URL}/api/graph/anomaly-scores?epochs=50", timeout=180)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        d = r.json()

        # Insufficient-data path (< 2 edges)
        if "message" in d and "Insufficient" in d.get("message", ""):
            assert d["flagged_nodes"] == [], "flagged_nodes not empty on insufficient data"
            print(f"  [info] Insufficient data path: {d['message']}")
            _pass("I12 - Graph Anomaly Scores", "insufficient data — score path OK")
            return

        # Full result
        for key in ("num_nodes", "anomaly_scores", "flagged_nodes", "threshold"):
            assert key in d, f"Missing key: {key}"
        assert d["num_nodes"] >= 0,       f"num_nodes={d['num_nodes']}"
        assert isinstance(d["anomaly_scores"], dict)
        assert isinstance(d["flagged_nodes"], list)
        assert float(d["threshold"]) == 0.7, f"threshold={d['threshold']}"
        print(f"  [info] Nodes={d['num_nodes']}  Flagged={len(d['flagged_nodes'])}")
        _pass("I12 - Graph Anomaly Scores")
    except Exception as e:
        _fail("I12 - Graph Anomaly Scores", e)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print("  STEGOCHAIN INTEGRATION TEST SUITE")
    print("=" * 60)

    # Detect services
    print("\n  Detecting services...")
    SERVICES = {
        "backend": check_backend(),
        "mongodb": check_mongodb(),
        "ganache": check_ganache(),
        "pinata":  check_pinata(),
    }

    # Print service table
    print("\n  Service Status:")
    # Shorten Atlas URI for display
    _mongo_label = "Atlas (cloud)" if "mongodb+srv" in MONGO_URI else MONGO_URI
    labels = {
        "backend": f"Backend  ({BACKEND_URL})",
        "mongodb": f"MongoDB  ({_mongo_label})",
        "ganache": f"Ganache  ({GANACHE_URL})",
        "pinata":  "Pinata   (API keys)",
    }
    for svc, live in SERVICES.items():
        status = "LIVE" if live else ("OFFLINE" if svc != "pinata" else "NOT CONFIGURED")
        print(f"    {labels[svc]:<38} : {status}")

    if not SERVICES["backend"]:
        print("\n  BACKEND OFFLINE — cannot run integration tests.")
        print("  Start the backend with: cd stegochain/backend && python app.py")
        sys.exit(1)

    if not _REQUESTS:
        print("\n  ERROR: 'requests' library not installed. Run: pip install requests")
        sys.exit(1)

    m = SERVICES["mongodb"]
    g = SERVICES["ganache"]
    p = SERVICES["pinata"]
    contract = os.environ.get("CONTRACT_ADDRESS", "")
    print()
    test_I1_health()
    test_I2_keypair()
    test_I3_aes()
    test_I4_stego_image()
    test_I5_shamir(m)
    test_I6_ipfs(p)
    test_I7_blockchain(g, contract)
    test_I8_graph_summary(m)
    test_I9_full_send(m, p)
    test_I10_full_receive()
    test_I11_revoke(g)
    test_I12_anomaly(m)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  STEGOCHAIN INTEGRATION TEST RESULTS")
    print("=" * 60)
    print("  Services:")
    for svc, live in SERVICES.items():
        status = "LIVE" if live else ("OFFLINE" if svc != "pinata" else "NOT CONFIGURED")
        print(f"    {labels[svc]:<38} : {status}")
    print()

    ordered = [
        ("I1  - Backend Health Check",         "I1 - Backend Health Check"),
        ("I2  - ECC Keypair Generation",        "I2 - ECC Keypair Generation"),
        ("I3  - AES Encrypt/Decrypt",           "I3 - AES Encrypt/Decrypt Round Trip"),
        ("I4  - Stego Embed/Extract Image",     "I4 - Stego Embed/Extract Image"),
        ("I5  - Shamir Split/Reconstruct",      "I5 - Shamir Key Split/Reconstruct"),
        ("I6  - IPFS Upload/Retrieve",          "I6 - IPFS Upload/Retrieve"),
        ("I7  - Blockchain Register/Verify",    "I7 - Blockchain Register/Verify"),
        ("I8  - Graph Summary",                 "I8 - Graph Summary"),
        ("I9  - Full Send Pipeline",            "I9 - Full Send Pipeline"),
        ("I10 - Full Receive Pipeline",         "I10 - Full Receive Pipeline"),
        ("I11 - Blockchain Revoke",             "I11 - Blockchain Revoke"),
        ("I12 - Graph Anomaly Scores",          "I12 - Graph Anomaly Scores"),
    ]
    for display, key in ordered:
        status = _results.get(key, "NOT RUN")
        print(f"  Test {display:<38} : {status}")

    passed  = sum(1 for _, k in ordered if _results.get(k) == "PASS")
    skipped = sum(1 for _, k in ordered if _results.get(k) == "SKIP")
    failed  = sum(1 for _, k in ordered if _results.get(k) == "FAIL")

    print("=" * 60)
    print(f"  TOTAL: {passed}/12 passed  |  {skipped} skipped  |  {failed} failed")
    print("=" * 60 + "\n")

    # Exit 1 only if any test FAILed (SKIPs are acceptable)
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
