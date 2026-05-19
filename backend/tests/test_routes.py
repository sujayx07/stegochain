"""
Flask Routes Integration Test Suite -- 15 tests
Run from stegochain/backend/: python tests/test_routes.py
All external services (MongoDB, Pinata, Ganache) are mocked.
"""
import base64, io, json, os, sys, uuid, tempfile
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# --- Patch pymongo BEFORE importing app -------------------------------------
_mock_db_store = {}

class _FakeCollection:
    def __init__(self, name):
        self._name = name
        if name not in _mock_db_store:
            _mock_db_store[name] = []
        self._docs = _mock_db_store[name]
    def insert_one(self, doc): self._docs.append(doc); return MagicMock()
    def find_one(self, q):
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in q.items() if not isinstance(v, dict)):
                return doc
        return None
    def find(self, q):
        res = []
        for doc in self._docs:
            ok = True
            for k, v in q.items():
                if isinstance(v, dict) and "$in" in v:
                    if doc.get(k) not in v["$in"]: ok = False
                elif doc.get(k) != v: ok = False
            if ok: res.append(doc)
        return res

class _FakeDB:
    def __getitem__(self, name):
        if name not in _mock_db_store: _mock_db_store[name] = []
        return _FakeCollection(name)

class _FakeClient:
    def get_database(self): return _FakeDB()

with patch("pymongo.MongoClient", return_value=_FakeClient()):
    from app import create_app

APP = create_app()
CLIENT = APP.test_client()

# --- Helpers ----------------------------------------------------------------
def _sep(t): print("\n--------------------------------------"); print(" " + t); print("--------------------------------------")
def _pass(l): print("  [result] PASS - " + l); return True
def _fail(l, e): print("  [result] FAIL - " + l + "\n  " + type(e).__name__ + ": " + str(e)); return False

def _make_png(size=100):
    from PIL import Image
    import numpy as np
    img = Image.fromarray((0*__import__('numpy').ones((size,size,3),dtype='uint8')+128).astype('uint8'), "RGB")
    buf = io.BytesIO(); img.save(buf, "PNG"); buf.seek(0); return buf

ctx = {}

# --- Tests ------------------------------------------------------------------

def t1():
    _sep("TEST 1 - Health Check")
    try:
        r = CLIENT.get("/health"); d = r.get_json()
        assert r.status_code == 200
        assert d["status"] == "ok"
        assert "modules" in d
        return _pass("GET /health -> 200, status=ok, modules present")
    except Exception as e: return _fail("Health check", e)

def t2():
    _sep("TEST 2 - Stego Embed Image")
    try:
        png = _make_png(100)
        r = CLIENT.post("/api/stego/embed",
                        data={"file": (png, "test.png"),
                              "message": "test hidden message",
                              "file_type": "image"},
                        content_type="multipart/form-data")
        d = r.get_json()
        assert r.status_code == 200, d
        assert "stego_file_path" in d
        assert "capacity_used" in d
        ctx["stego_path"] = d["stego_file_path"]
        return _pass("POST /api/stego/embed -> 200, stego_file_path returned")
    except Exception as e: return _fail("Stego embed", e)

def t3():
    _sep("TEST 3 - Stego Extract Image")
    try:
        stego = ctx.get("stego_path")
        if not stego or not os.path.exists(stego):
            raise RuntimeError("stego_path from Test 2 not available")
        with open(stego, "rb") as f:
            r = CLIENT.post("/api/stego/extract",
                            data={"file": (f, "stego.png"), "file_type": "image"},
                            content_type="multipart/form-data")
        d = r.get_json()
        assert r.status_code == 200, d
        assert d["message"] == "test hidden message"
        return _pass("POST /api/stego/extract -> correct message extracted")
    except Exception as e: return _fail("Stego extract", e)

def t4():
    _sep("TEST 4 - Stego Capacity")
    try:
        r = CLIENT.get("/api/stego/capacity?file_type=image&width=100&height=100")
        d = r.get_json()
        assert r.status_code == 200, d
        assert d["capacity_characters"] == 3750
        return _pass("GET /api/stego/capacity -> 3750 chars for 100x100 image")
    except Exception as e: return _fail("Stego capacity", e)

def t5():
    _sep("TEST 5 - Crypto Keypair Generation")
    try:
        r = CLIENT.post("/api/crypto/generate-keypair"); d = r.get_json()
        assert r.status_code == 200, d
        assert "BEGIN PUBLIC KEY" in d["public_key"]
        assert "BEGIN" in d["private_key"]
        ctx["keypair"] = d
        return _pass("POST /api/crypto/generate-keypair -> PEM keys returned")
    except Exception as e: return _fail("Keypair gen", e)

def t6():
    _sep("TEST 6 - Crypto Encrypt/Decrypt")
    try:
        from modules.crypto.aes_cipher import generate_aes_key
        key = generate_aes_key(); key_b64 = base64.b64encode(key).decode()
        msg = "StegoChain secret payload"
        r = CLIENT.post("/api/crypto/encrypt",
                        data=json.dumps({"message": msg, "aes_key_b64": key_b64}),
                        content_type="application/json")
        d = r.get_json()
        assert r.status_code == 200, d
        r2 = CLIENT.post("/api/crypto/decrypt",
                         data=json.dumps({"ciphertext": d["ciphertext"],
                                           "nonce": d["nonce"], "tag": d["tag"],
                                           "aes_key_b64": key_b64}),
                         content_type="application/json")
        d2 = r2.get_json()
        assert r2.status_code == 200, d2
        assert d2["message"] == msg
        return _pass("POST /api/crypto/encrypt+decrypt -> round-trip correct")
    except Exception as e: return _fail("Encrypt/decrypt", e)

def t7():
    _sep("TEST 7 - Crypto Derive Shared Key")
    try:
        from modules.crypto.key_exchange import generate_ecc_keypair
        kp1 = generate_ecc_keypair(); kp2 = generate_ecc_keypair()
        r = CLIENT.post("/api/crypto/derive-shared-key",
                        data=json.dumps({"private_key_pem": kp1["private_key"],
                                          "peer_public_key_pem": kp2["public_key"]}),
                        content_type="application/json")
        d = r.get_json()
        assert r.status_code == 200, d
        assert "shared_key_b64" in d
        assert d["key_length_bytes"] == 32
        return _pass("POST /api/crypto/derive-shared-key -> 32-byte key")
    except Exception as e: return _fail("Derive shared key", e)

def t8():
    _sep("TEST 8 - Crypto Split/Reconstruct Key")
    try:
        from modules.crypto.aes_cipher import generate_aes_key
        key = generate_aes_key(); key_b64 = base64.b64encode(key).decode()
        sess = str(uuid.uuid4()); owners = [f"user_{i}" for i in range(5)]
        ctx["t8_key_b64"] = key_b64; ctx["t8_sess"] = sess; ctx["t8_owners"] = owners
        r = CLIENT.post("/api/crypto/split-key",
                        data=json.dumps({"aes_key_b64": key_b64, "k": 3, "n": 5,
                                          "session_id": sess, "owner_ids": owners}),
                        content_type="application/json")
        d = r.get_json()
        assert r.status_code == 200, d
        assert d["shares_created"] == 5
        r2 = CLIENT.post("/api/crypto/reconstruct-key",
                          data=json.dumps({"session_id": sess, "owner_ids": owners[:3]}),
                          content_type="application/json")
        d2 = r2.get_json()
        assert r2.status_code == 200, d2
        assert d2["aes_key_b64"] == key_b64
        return _pass("POST split-key(5) + reconstruct-key(3 owners) -> key matches")
    except Exception as e: return _fail("Split/reconstruct", e)

def t9():
    _sep("TEST 9 - IPFS Upload (mocked Pinata)")
    try:
        mock_resp = MagicMock()
        mock_resp.ok = True; mock_resp.status_code = 200
        mock_resp.json.return_value = {"IpfsHash": "QmMockCID1234567890abcdef",
                                        "PinSize": 512, "Timestamp": "2026-05-17T00:00:00Z"}
        with patch("modules.ipfs.pinata.requests.post", return_value=mock_resp):
            r = CLIENT.post("/api/ipfs/upload",
                            data={"file": (io.BytesIO(b"encrypted_binary"), "enc.bin"),
                                   "session_id": "sess_ipfs", "sender_id": "alice",
                                   "receiver_id": "bob", "file_type": "image"},
                            content_type="multipart/form-data")
        d = r.get_json()
        assert r.status_code == 200, d
        assert "cid" in d and "gateway_url" in d
        ctx["ipfs_cid"] = d["cid"]
        return _pass("POST /api/ipfs/upload -> cid and gateway_url returned")
    except Exception as e: return _fail("IPFS upload", e)

def t10():
    _sep("TEST 10 - IPFS Exists (mocked)")
    try:
        cid = ctx.get("ipfs_cid", "QmMockCID1234567890abcdef")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"rows": [{"ipfs_pin_hash": cid}]}
        with patch("modules.ipfs.pinata.requests.get", return_value=mock_resp):
            r = CLIENT.get(f"/api/ipfs/exists/{cid}")
        d = r.get_json()
        assert r.status_code == 200, d
        assert "exists" in d
        return _pass("GET /api/ipfs/exists/<cid> -> exists field present")
    except Exception as e: return _fail("IPFS exists", e)

def _mock_bc():
    """Return (w3_mock, contract_mock) for blockchain tests."""
    from web3 import Web3
    w3 = MagicMock()
    w3.is_connected.return_value = True
    w3.eth.get_transaction_count.return_value = 0
    w3.eth.gas_price = 1_000_000_000
    signed = MagicMock(); signed.raw_transaction = b"\x00"*32
    w3.eth.account.sign_transaction.return_value = signed
    w3.eth.account.from_key.return_value = MagicMock(address="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
    w3.eth.send_raw_transaction.return_value = bytes.fromhex("ab"*32)
    receipt = {"blockNumber": 5, "gasUsed": 100000, "status": 1,
               "transactionHash": bytes.fromhex("ab"*32)}
    w3.eth.wait_for_transaction_receipt.return_value = receipt
    w3.to_checksum_address = Web3.to_checksum_address
    w3.keccak = Web3.keccak
    contract = MagicMock()
    def reg(cid, recv, sid, mr):
        fn = MagicMock()
        fn.build_transaction.return_value = {"to":"0x0","data":"0x","gas":300000,
                                              "gasPrice":int(1e9),"nonce":0,"chainId":1337,"value":0}
        return fn
    contract.functions.registerRecord.side_effect = reg
    ev = MagicMock(); ev.process_receipt.return_value = [{"args":{"recordId":0}}]
    contract.events.RecordRegistered.return_value = ev
    fn_rc = MagicMock(); fn_rc.call.return_value = 1
    contract.functions.recordCount.return_value = fn_rc
    def verify(rid, cid, mr):
        fn = MagicMock(); fn.call.return_value = True; return fn
    contract.functions.verifyRecord.side_effect = verify
    def stats():
        fn = MagicMock(); fn.call.return_value = (1,"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); return fn
    contract.functions.getContractStats.side_effect = stats
    return w3, contract

def t11():
    _sep("TEST 11 - Blockchain Register (mocked)")
    try:
        w3, contract = _mock_bc()
        with patch("routes.blockchain_routes._get_contract", return_value=(w3, contract)):
            r = CLIENT.post("/api/blockchain/register",
                            data=json.dumps({"cid":"QmBlockTest001",
                                              "receiver_address":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                                              "session_id":"sess_bc_001",
                                              "cids_in_session":["QmBlockTest001"]}),
                            content_type="application/json")
        d = r.get_json()
        assert r.status_code == 200, d
        assert "record_id" in d and "tx_hash" in d and "merkle_root" in d
        ctx["bc_merkle"] = d["merkle_root"]
        return _pass("POST /api/blockchain/register -> record_id, tx_hash, merkle_root")
    except Exception as e: return _fail("Blockchain register", e)

def t12():
    _sep("TEST 12 - Blockchain Verify (mocked)")
    try:
        w3, contract = _mock_bc()
        with patch("routes.blockchain_routes._get_contract", return_value=(w3, contract)):
            r = CLIENT.post("/api/blockchain/verify",
                            data=json.dumps({"record_id": 0, "cid":"QmBlockTest001",
                                              "merkle_root": ctx.get("bc_merkle","0x"+"00"*32)}),
                            content_type="application/json")
        d = r.get_json()
        assert r.status_code == 200, d
        assert "verified" in d
        return _pass("POST /api/blockchain/verify -> verified field present")
    except Exception as e: return _fail("Blockchain verify", e)

def t13():
    _sep("TEST 13 - Blockchain Stats (mocked)")
    try:
        w3, contract = _mock_bc()
        with patch("routes.blockchain_routes._get_contract", return_value=(w3, contract)):
            r = CLIENT.get("/api/blockchain/stats")
        d = r.get_json()
        assert r.status_code == 200, d
        assert "total_records" in d and "contract_owner" in d
        return _pass("GET /api/blockchain/stats -> total_records and contract_owner")
    except Exception as e: return _fail("Blockchain stats", e)

def t14():
    _sep("TEST 14 - Full Send Pipeline (mocked)")
    try:
        ipfs_resp = MagicMock(); ipfs_resp.ok = True; ipfs_resp.status_code = 200
        ipfs_resp.json.return_value = {"IpfsHash":"QmSendCID0001","PinSize":1024,"Timestamp":"2026-05-17T00:00:00Z"}
        png = _make_png(60)
        with patch("modules.ipfs.pinata.requests.post", return_value=ipfs_resp), \
             patch("routes.stego_routes._try_register_blockchain",
                   return_value={"record_id":0,"tx_hash":"0x"+"ab"*32,"block_number":5,"gas_used":100000}):
            r = CLIENT.post("/api/stego/send",
                            data={"file": (png, "cover.png"),
                                   "message": "pipeline_message_001",
                                   "file_type": "image",
                                   "sender_id": "alice",
                                   "receiver_id": "bob",
                                   "receiver_eth_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                                   "k": "3", "n": "5"},
                            content_type="multipart/form-data")
        d = r.get_json()
        assert r.status_code == 200, d
        for field in ("session_id","ipfs_cid","blockchain_record_id","shares_created"):
            assert field in d, f"Missing {field}"
        ctx["send_session_id"] = d["session_id"]
        return _pass("POST /api/stego/send -> full pipeline, all fields present")
    except Exception as e: return _fail("Full send pipeline", e)

def t15():
    _sep("TEST 15 - Full Receive Pipeline (mocked)")
    try:
        session_id = ctx.get("send_session_id")
        if not session_id:
            raise RuntimeError("session_id from Test 14 not available")

        txn_docs = _mock_db_store.get("transactions", [])
        txn_doc  = next((d for d in txn_docs if d.get("session_id") == session_id), None)
        if not txn_doc:
            raise RuntimeError("No transaction in mock DB from Test 14")

        shares_in_db = [d for d in _mock_db_store.get("keyshares",[]) if d["session_id"] == session_id]
        if len(shares_in_db) < 3:
            raise RuntimeError(f"Expected >=3 shares, found {len(shares_in_db)}")

        from modules.secret_sharing.shamir import reconstruct_secret
        from models.keyshare import KeyShare
        raw = [KeyShare.from_dict(d).to_share_dict() for d in shares_in_db[:3]]
        aes_key = reconstruct_secret(raw)

        # Build matching encrypted stego file
        from modules.steganography.lsb_image import embed_message_in_image
        from modules.crypto.aes_cipher import encrypt_file
        from PIL import Image
        import numpy as np
        img = Image.fromarray((np.zeros((60,60,3),dtype='uint8')+128), "RGB")
        src = tempfile.mktemp(suffix=".png"); stg = tempfile.mktemp(suffix=".png"); enc = tempfile.mktemp(suffix=".bin")
        img.save(src)
        embed_message_in_image(src, "pipeline_message_001", stg)
        meta = encrypt_file(stg, aes_key, enc)
        txn_doc["nonce"] = meta["nonce"]; txn_doc["tag"] = meta["tag"]
        with open(enc, "rb") as f: enc_bytes = f.read()
        for p in (src, stg, enc):
            try: os.remove(p)
            except: pass

        with patch("routes.stego_routes.retrieve_from_ipfs", return_value=enc_bytes), \
             patch("routes.stego_routes._try_verify_blockchain", return_value=True):
            r = CLIENT.post("/api/stego/receive",
                            data=json.dumps({"session_id": session_id,
                                              "owner_ids": ["owner_1","owner_2","owner_3"],
                                              "file_type": "image"}),
                            content_type="application/json")
        d = r.get_json()
        assert r.status_code == 200, d
        assert d["message"] == "pipeline_message_001"
        assert d["blockchain_verified"] is True
        return _pass("POST /api/stego/receive -> message correctly extracted")
    except Exception as e: return _fail("Full receive pipeline", e)


if __name__ == "__main__":
    print("\n==========================================")
    print("  FLASK ROUTES TEST SUITE")
    print("==========================================")
    results = {
        "Test 1  - Health Check":                 t1(),
        "Test 2  - Stego Embed Image":            t2(),
        "Test 3  - Stego Extract Image":          t3(),
        "Test 4  - Stego Capacity":               t4(),
        "Test 5  - Crypto Keypair Generation":    t5(),
        "Test 6  - Crypto Encrypt/Decrypt":       t6(),
        "Test 7  - Crypto Derive Shared Key":     t7(),
        "Test 8  - Crypto Split/Reconstruct Key": t8(),
        "Test 9  - IPFS Upload":                  t9(),
        "Test 10 - IPFS Exists":                  t10(),
        "Test 11 - Blockchain Register":          t11(),
        "Test 12 - Blockchain Verify":            t12(),
        "Test 13 - Blockchain Stats":             t13(),
        "Test 14 - Full Send Pipeline":           t14(),
        "Test 15 - Full Receive Pipeline":        t15(),
    }
    print("\n==========================================")
    print("  FLASK ROUTES TEST RESULTS")
    w = max(len(k) for k in results)
    for name, passed in results.items():
        print("  {:<{}} : {}".format(name, w, "PASS" if passed else "FAIL"))
    print("==========================================\n")
    if not all(results.values()): sys.exit(1)
