"""
test_backend_v2.py — StegoChain Backend V2 Test Suite
All external dependencies (MongoDB, Web3, IPFS) are mocked.
Run: python -m pytest tests/test_backend_v2.py -v
"""
import base64
import os
import sys
import json
import time
import types
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

# ── Path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET",        "test-secret-key")
os.environ.setdefault("CONTRACT_ADDRESS",  "0xa33fE3cee390910f8832134De02f7DC9bf473AfF")
os.environ.setdefault("BASE_SEPOLIA_RPC_URL", "http://127.0.0.1:8545")
os.environ.setdefault("PRIVATE_KEY",       "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
os.environ.setdefault("PINATA_API_KEY",    "test-pinata-key")
os.environ.setdefault("PINATA_SECRET_KEY", "test-pinata-secret")
os.environ.setdefault("MONGO_URI",         "mongodb://localhost:27017/stegochain_test")

# ── Results tracker ───────────────────────────────────────────────────────────
_RESULTS = {}


def _record(name, passed):
    _RESULTS[name] = "PASS" if passed else "FAIL"


# ══════════════════════════════════════════════════════════════════════════════
# Tests 1–4: JWT
# ══════════════════════════════════════════════════════════════════════════════

class TestJWT:
    def test_01_generate_and_verify(self):
        from modules.auth.jwt_handler import generate_token, verify_token
        token = generate_token("user-123", "0xABC")
        payload = verify_token(token)
        ok = payload["user_id"] == "user-123" and payload["eth_address"] == "0xabc"
        _record("Test 1  - JWT Generate/Verify", ok)
        assert ok

    def test_02_require_auth_valid(self):
        from modules.auth.jwt_handler import generate_token, require_auth
        token = generate_token("u1", "0xDEF")

        import flask
        fake_app = flask.Flask(__name__)
        fake_app.db = MagicMock()

        @fake_app.route("/protected")
        @require_auth
        def protected():
            return flask.jsonify({"user_id": flask.g.user_id}), 200

        with fake_app.test_client() as c:
            resp = c.get("/protected", headers={"Authorization": f"Bearer {token}"})
        ok = resp.status_code == 200
        _record("Test 2  - Auth Decorator Valid", ok)
        assert ok

    def test_03_require_auth_missing(self):
        from modules.auth.jwt_handler import require_auth
        import flask
        fake_app = flask.Flask(__name__)

        @fake_app.route("/protected2")
        @require_auth
        def protected2():
            return flask.jsonify({}), 200

        with fake_app.test_client() as c:
            resp = c.get("/protected2")
        ok = resp.status_code == 401
        _record("Test 3  - Auth Decorator Missing", ok)
        assert ok

    def test_04_require_auth_expired(self):
        import jwt as pyjwt
        from modules.auth.jwt_handler import require_auth, _secret
        import flask

        payload = {
            "user_id": "u1", "eth_address": "0x1",
            "iat": datetime.now(timezone.utc) - timedelta(hours=48),
            "exp": datetime.now(timezone.utc) - timedelta(hours=24),
        }
        expired_token = pyjwt.encode(payload, _secret(), algorithm="HS256")

        fake_app = flask.Flask(__name__)

        @fake_app.route("/protected3")
        @require_auth
        def protected3():
            return flask.jsonify({}), 200

        with fake_app.test_client() as c:
            resp = c.get("/protected3", headers={"Authorization": f"Bearer {expired_token}"})
        ok = resp.status_code == 401
        _record("Test 4  - Auth Decorator Expired", ok)
        assert ok


# ══════════════════════════════════════════════════════════════════════════════
# Flask app fixture
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def app():
    mock_db = MagicMock()
    mock_db.__getitem__ = MagicMock(return_value=MagicMock())

    with patch("pymongo.MongoClient") as mock_client:
        mock_client.return_value.get_database.return_value = mock_db
        from app import create_app
        application = create_app()
        application.config["TESTING"] = True
        application.db = mock_db
        yield application


@pytest.fixture
def client(app):
    return app.test_client()


def _auth_header(user_id="u1", eth="0x867e78c6965a5040cafff2a9bd85e48810e8fc2f"):
    from modules.auth.jwt_handler import generate_token
    return {"Authorization": f"Bearer {generate_token(user_id, eth)}"}


# ══════════════════════════════════════════════════════════════════════════════
# Tests 5–8: Auth Routes
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthRoutes:
    def test_05_register(self, app, client):
        users_col = MagicMock()
        users_col.find_one.return_value = None   # no duplicate
        users_col.insert_one.return_value = MagicMock()
        users_col.update_one.return_value = MagicMock()
        app.db.__getitem__ = lambda self, key: users_col

        with patch("modules.blockchain.web3_v2.get_v2_connection"), \
             patch("modules.blockchain.web3_v2.load_v2_contract"), \
             patch("modules.blockchain.web3_v2.register_user_on_chain",
                   return_value={"tx_hash": "0xabc", "block_number": 1, "gas_used": 50000}):
            resp = client.post("/api/auth/register", json={
                "username": "alice", "email": "alice@test.com",
                "password": "SecurePass1!", "eth_address": "0x867E78c6965a5040caFFf2A9Bd85e48810e8fC2F",
                "public_key_x": "aa" * 32, "public_key_y": "bb" * 32,
            })
        ok = resp.status_code == 200 and "token" in resp.get_json()
        _record("Test 5  - Register Route", ok)
        assert ok

    def test_06_login_success(self, app, client):
        from models.user import User
        user = User("bob", "bob@test.com", "pass123", "0x1234567890123456789012345678901234567890")
        doc  = user.to_dict()
        col  = MagicMock()
        col.find_one.return_value = doc
        app.db.__getitem__ = lambda self, k: col

        resp = client.post("/api/auth/login", json={"email": "bob@test.com", "password": "pass123"})
        ok   = resp.status_code == 200 and "token" in resp.get_json()
        _record("Test 6  - Login Success", ok)
        assert ok

    def test_07_login_wrong_password(self, app, client):
        from models.user import User
        user = User("bob", "bob@test.com", "pass123", "0x1234567890123456789012345678901234567890")
        col  = MagicMock()
        col.find_one.return_value = user.to_dict()
        app.db.__getitem__ = lambda self, k: col

        resp = client.post("/api/auth/login", json={"email": "bob@test.com", "password": "WRONG"})
        ok   = resp.status_code == 401
        _record("Test 7  - Login Wrong Password", ok)
        assert ok

    def test_08_get_me(self, app, client):
        from models.user import User
        user = User("carol", "carol@test.com", "pw", "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
                    user_id="u-carol")
        col  = MagicMock()
        col.find_one.return_value = user.to_dict()
        app.db.__getitem__ = lambda self, k: col

        resp = client.get("/api/auth/me", headers=_auth_header("u-carol"))
        ok   = resp.status_code == 200
        _record("Test 8  - GET /me Route", ok)
        assert ok


# ══════════════════════════════════════════════════════════════════════════════
# Tests 9–13: Fragment / Merkle / Signing helpers
# ══════════════════════════════════════════════════════════════════════════════

class TestFragmentHelpers:
    def test_09_split(self):
        from modules.blockchain.web3_v2 import split_aes_key_to_fragments
        key = os.urandom(32)
        frags = split_aes_key_to_fragments(key, 4)
        ok = len(frags) == 4 and all(isinstance(f, bytes) for f in frags)
        _record("Test 9  - Fragment Split", ok)
        assert ok

    def test_10_reconstruct(self):
        from modules.blockchain.web3_v2 import (
            split_aes_key_to_fragments, reconstruct_aes_key_from_fragments,
        )
        key   = os.urandom(32)
        frags = split_aes_key_to_fragments(key, 4)
        out   = reconstruct_aes_key_from_fragments(frags)
        ok    = out == key
        _record("Test 10 - Fragment Reconstruct", ok)
        assert ok

    def test_11_merkle_tree(self):
        from modules.blockchain.web3_v2 import build_fragment_merkle_tree
        frags = [os.urandom(8) for _ in range(4)]
        tree  = build_fragment_merkle_tree(frags)
        ok    = tree["root"].startswith("0x") and len(tree["leaves"]) == 4
        _record("Test 11 - Fragment Merkle Tree", ok)
        assert ok

    def test_12_merkle_proof(self):
        from modules.blockchain.web3_v2 import (
            build_fragment_merkle_tree, get_fragment_merkle_proof,
        )
        from web3 import Web3

        frags  = [os.urandom(8) for _ in range(4)]
        tree   = build_fragment_merkle_tree(frags)
        proof  = get_fragment_merkle_proof(frags, 0)
        root   = bytes.fromhex(tree["root"][2:])   # strip 0x
        leaf   = bytes.fromhex(tree["leaves"][0][2:])

        # Manual sorted-pair verify
        computed = leaf
        for sibling_hex in proof:
            sibling = bytes.fromhex(sibling_hex[2:])   # strip 0x, guaranteed even
            if computed <= sibling:
                computed = Web3.keccak(computed + sibling)
            else:
                computed = Web3.keccak(sibling + computed)
        ok = computed == root
        _record("Test 12 - Fragment Merkle Proof", ok)
        assert ok

    def test_13_sign_challenge(self):
        from modules.blockchain.web3_v2 import sign_challenge
        from eth_account import Account
        pk  = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        res = sign_challenge(pk, "StegoChain Test Challenge")
        ok  = "signature" in res and "challenge_hash" in res and len(res["signature"]) > 10
        _record("Test 13 - Sign Challenge", ok)
        assert ok


# ══════════════════════════════════════════════════════════════════════════════
# Tests 14–16: Blockchain Routes
# ══════════════════════════════════════════════════════════════════════════════

class TestBlockchainRoutes:
    def _mock_rec(self):
        return {
            "record_id": 1, "ipfs_cid": "QmTest", "fragment_cids": ["QmF1", "QmF2"],
            "sender": "0x867e78c6965a5040cafff2a9bd85e48810e8fc2f",
            "receiver": "0x867e78c6965a5040cafff2a9bd85e48810e8fc2f",
            "session_id": "sess-1", "merkle_root": "0x" + "aa" * 32,
            "media_hash": "0x" + "bb" * 32, "timestamp": 0,
            "is_active": True, "total_fragments": 2,
        }

    def test_14_register_record(self, app, client):
        col = MagicMock()
        app.db.__getitem__ = lambda self, k: col

        with patch("modules.blockchain.web3_v2.get_v2_connection"), \
             patch("modules.blockchain.web3_v2.load_v2_contract"), \
             patch("routes.blockchain_routes._get_contract",
                   return_value=(MagicMock(), MagicMock())), \
             patch("modules.blockchain.web3_v2.get_user_profile",
                   return_value={"is_registered": True}), \
             patch("modules.blockchain.web3_v2.register_record_on_chain",
                   return_value={"record_id": 1, "tx_hash": "0xabc", "block_number": 5, "gas_used": 200000}):
            resp = client.post("/api/blockchain/register-record",
                headers=_auth_header(), json={
                    "ipfs_cid": "QmTest", "fragment_cids": ["QmF1", "QmF2"],
                    "receiver_address": "0x867E78c6965a5040caFFf2A9Bd85e48810e8fC2F",
                    "session_id": "sess-abc", "merkle_root": "0x" + "aa" * 32,
                    "media_hash": "0x" + "bb" * 32, "total_fragments": 2,
                })
        ok = resp.status_code == 200
        _record("Test 14 - Register Record Route", ok)
        assert ok

    def test_15_request_decryption_authorised(self, app, client):
        col = MagicMock()
        app.db.__getitem__ = lambda self, k: col

        mock_rec = self._mock_rec()
        with patch("routes.blockchain_routes._get_contract",
                   return_value=(MagicMock(), MagicMock())), \
             patch("modules.blockchain.web3_v2.get_record_v2", return_value=mock_rec), \
             patch("modules.blockchain.web3_v2.request_decryption_on_chain",
                   return_value={"tx_hash": "0xdef", "authorised": True, "record_id": 1, "block_number": 6}), \
             patch("modules.ipfs.pinata.retrieve_from_ipfs", return_value=b"fake-bytes"):
            resp = client.post("/api/blockchain/request-decryption",
                headers=_auth_header(), json={
                    "record_id": 1, "merkle_proof": ["0x" + "cc" * 32],
                    "leaf_hash": "0x" + "dd" * 32, "signature": "0x" + "ee" * 65,
                    "challenge_hash": "0x" + "ff" * 32,
                })
        ok = resp.status_code == 200 and resp.get_json().get("authorised") is True
        _record("Test 15 - Request Decryption Authorised", ok)
        assert ok

    def test_16_request_decryption_forbidden(self, app, client):
        col = MagicMock()
        app.db.__getitem__ = lambda self, k: col

        mock_rec = self._mock_rec()
        mock_rec["receiver"] = "0xDEAD000000000000000000000000000000000000"
        with patch("routes.blockchain_routes._get_contract",
                   return_value=(MagicMock(), MagicMock())), \
             patch("modules.blockchain.web3_v2.get_record_v2", return_value=mock_rec):
            resp = client.post("/api/blockchain/request-decryption",
                headers=_auth_header(), json={
                    "record_id": 1, "merkle_proof": [],
                    "leaf_hash": "0x" + "aa" * 32, "signature": "0x" + "bb" * 65,
                    "challenge_hash": "0x" + "cc" * 32,
                })
        ok = resp.status_code == 403
        _record("Test 16 - Request Decryption Forbidden", ok)
        assert ok


# ══════════════════════════════════════════════════════════════════════════════
# Tests 17–19: Stego Routes
# ══════════════════════════════════════════════════════════════════════════════

class TestStegoRoutes:
    def _make_png(self) -> bytes:
        """Minimal 4x4 white PNG."""
        import struct, zlib
        def chunk(tag, data):
            c = struct.pack(">I", len(data)) + tag + data
            return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        raw = b"\x00" + b"\xff\xff\xff" * 4
        raw = raw * 4
        idat = zlib.compress(raw)
        return (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", idat)
            + chunk(b"IEND", b"")
        )

    def test_17_full_send(self, app, client):
        import io
        png  = self._make_png()
        col  = MagicMock()
        col.find_one.return_value = {
            "user_id": "recv-1", "eth_address": "0xbbbb",
            "public_key_x": "aa" * 32, "public_key_y": "bb" * 32,
        }
        col.insert_one.return_value = MagicMock()
        app.db.__getitem__ = lambda self, k: col

        with patch("routes.stego_routes.embed_message_in_image",
                   side_effect=lambda src, msg, out: open(out, "wb").write(png) or None), \
             patch("routes.stego_routes.generate_aes_key", return_value=b"\x00" * 32), \
             patch("routes.stego_routes.encrypt_file",
                   return_value={"nonce": "nn", "tag": "tt"}), \
             patch("routes.stego_routes.build_ipfs_metadata", return_value={}), \
             patch("routes.stego_routes.upload_file_to_ipfs",
                   return_value={"cid": "QmTest", "gateway_url": "https://gw/QmTest"}), \
             patch("routes.stego_routes._get_v2",
                   return_value=(MagicMock(), MagicMock())), \
             patch("routes.stego_routes.split_aes_key_to_fragments",
                   return_value=[b"\x01" * 8] * 4), \
             patch("routes.stego_routes.build_fragment_merkle_tree",
                   return_value={"root": "0x" + "aa" * 32, "leaves": [], "tree": []}), \
             patch("routes.stego_routes.register_record_on_chain",
                   return_value={"record_id": 1, "tx_hash": "0xabc", "block_number": 1, "gas_used": 1}), \
             patch("config.Config.PRIVATE_KEY", new_callable=lambda: property(lambda s: "0x" + "aa" * 32)):
            resp = client.post("/api/stego/send",
                headers=_auth_header("u1", "0xaaaa"),
                data={
                    "file": (io.BytesIO(png), "test.png"),
                    "message":      "hello secret",
                    "file_type":    "image",
                    "receiver_eth": "0xbbbb",
                    "n_fragments":  "4",
                },
                content_type="multipart/form-data",
            )
        body = resp.get_json()
        ok = resp.status_code == 200 and "session_id" in (body or {})
        _record("Test 17 - Full Send Pipeline", ok)
        assert ok, f"status={resp.status_code} body={body}"

    def test_18_full_receive_with_media(self, app, client):
        from models.transaction import Transaction
        txn = Transaction(
            sender_id="s1", receiver_id="r1",
            sender_eth="0xaaaa", receiver_eth="0xbbbb",
            file_type="image", original_filename="t.png",
            ipfs_cid="QmTest", nonce="nn", tag="tt",
            media_hash="0x" + "cc" * 32, merkle_root="0x" + "dd" * 32,
            blockchain_record_id=1,
        )
        col = MagicMock()
        col.find_one.return_value = txn.to_dict()
        app.db.__getitem__ = lambda self, k: col

        png = self._make_png()

        with patch("routes.stego_routes._get_v2",
                   return_value=(MagicMock(), MagicMock())), \
             patch("routes.stego_routes.get_record_v2",
                   return_value={"is_active": True, "fragment_cids": []}), \
             patch("routes.stego_routes.verify_media_integrity", return_value=True), \
             patch("routes.stego_routes.reconstruct_aes_key_from_fragments",
                   return_value=b"\x00" * 32), \
             patch("routes.stego_routes.retrieve_from_ipfs", return_value=b"fake-enc"), \
             patch("routes.stego_routes.decrypt_file",
                   side_effect=lambda enc, key, n, t, out: open(out, "wb").write(png) or None), \
             patch("routes.stego_routes.extract_message_from_image",
                   return_value="hello secret"):
            resp = client.post("/api/stego/receive",
                headers=_auth_header(),
                json={
                    "session_id":    txn.session_id,
                    "fragments_b64": [base64.b64encode(b"\x01\x02\x03\x04").decode()],
                    "file_type":     "image",
                })
        body = resp.get_json()
        ok   = resp.status_code == 200 and body.get("message") == "hello secret" and "media_b64" in body
        _record("Test 18 - Full Receive with Media", ok)
        assert ok, f"status={resp.status_code} body={body}"

    def test_19_receive_revoked(self, app, client):
        from models.transaction import Transaction
        txn = Transaction(
            sender_id="s1", receiver_id="r1",
            sender_eth="0xaaaa", receiver_eth="0xbbbb",
            file_type="image", original_filename="t.png",
            ipfs_cid="QmTest", nonce="nn", tag="tt",
            blockchain_record_id=1,
        )
        col = MagicMock()
        col.find_one.return_value = txn.to_dict()
        app.db.__getitem__ = lambda self, k: col

        with patch("routes.stego_routes._get_v2",
                   return_value=(MagicMock(), MagicMock())), \
             patch("routes.stego_routes.get_record_v2",
                   return_value={"is_active": False}):
            resp = client.post("/api/stego/receive",
                headers=_auth_header(),
                json={
                    "session_id":    txn.session_id,
                    "fragments_b64": ["AAAA"],
                    "file_type":     "image",
                })
        ok = resp.status_code == 403
        _record("Test 19 - Receive Revoked Record", ok)
        assert ok, f"Expected 403, got {resp.status_code}: {resp.get_json()}"


# ══════════════════════════════════════════════════════════════════════════════
# Test 20: Blockchain Stats
# ══════════════════════════════════════════════════════════════════════════════

class TestBlockchainStats:
    def test_20_stats(self, app, client):
        with patch("routes.blockchain_routes._get_contract",
                   return_value=(MagicMock(), MagicMock())), \
             patch("modules.blockchain.web3_v2.get_contract_stats_v2",
                   return_value={"total_records": 5, "total_users": 3,
                                 "contract_owner": "0xOwner"}):
            resp = client.get("/api/blockchain/stats")
        body = resp.get_json()
        ok   = (resp.status_code == 200
                and body.get("network") == "Base Sepolia"
                and "total_records" in body)
        _record("Test 20 - Blockchain Stats", ok)
        assert ok


# ══════════════════════════════════════════════════════════════════════════════
# Final summary
# ══════════════════════════════════════════════════════════════════════════════

def pytest_sessionfinish(session, exitstatus):
    labels = [
        "Test 1  - JWT Generate/Verify          ",
        "Test 2  - Auth Decorator Valid         ",
        "Test 3  - Auth Decorator Missing       ",
        "Test 4  - Auth Decorator Expired       ",
        "Test 5  - Register Route               ",
        "Test 6  - Login Success                ",
        "Test 7  - Login Wrong Password         ",
        "Test 8  - GET /me Route                ",
        "Test 9  - Fragment Split               ",
        "Test 10 - Fragment Reconstruct         ",
        "Test 11 - Fragment Merkle Tree         ",
        "Test 12 - Fragment Merkle Proof        ",
        "Test 13 - Sign Challenge               ",
        "Test 14 - Register Record Route        ",
        "Test 15 - Request Decryption Authorised",
        "Test 16 - Request Decryption Forbidden ",
        "Test 17 - Full Send Pipeline           ",
        "Test 18 - Full Receive with Media      ",
        "Test 19 - Receive Revoked Record       ",
        "Test 20 - Blockchain Stats             ",
    ]
    print("\n\n==========================================")
    print("BACKEND V2 TEST RESULTS")
    for label in labels:
        key    = label.strip()
        result = _RESULTS.get(key, "NOT RUN")
        print(f"{label}: {result}")
    print("==========================================\n")
