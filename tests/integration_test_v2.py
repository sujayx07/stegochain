"""
stegochain/tests/integration_test_v2.py
=========================================
Master end-to-end integration test for StegoChain V2.
Verifies all active routes against live services (MongoDB, Base Sepolia, Pinata).

Run from stegochain/ root directory:
    python tests/integration_test_v2.py
"""

import os
import sys
import time
import base64
import io
import pathlib
from PIL import Image

# Allow imports from stegochain/backend/
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.normpath(os.path.join(_HERE, ".."))
_BACKEND = os.path.join(_ROOT, "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Load env before importing modules
from dotenv import load_dotenv
_ENV_FILE = pathlib.Path(_ROOT) / ".env.production"
if _ENV_FILE.exists():
    load_dotenv(dotenv_path=_ENV_FILE, override=True)
else:
    load_dotenv()

import requests
from web3 import Web3
from eth_account import Account
from pymongo import MongoClient

from config import Config
from modules.blockchain.web3_v2 import (
    load_v2_contract,
    build_fragment_merkle_tree,
    get_fragment_merkle_proof,
    sign_challenge,
)
from modules.ipfs.pinata import retrieve_from_ipfs

# Test endpoints
BACKEND_URL = "http://localhost:5000"

# Service checks
def check_backend() -> bool:
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=3)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False

def check_mongodb() -> bool:
    try:
        client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        return True
    except Exception:
        return False

def check_sepolia() -> bool:
    try:
        rpc_url = os.environ.get("BASE_SEPOLIA_RPC_URL")
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        return w3.eth.block_number > 0
    except Exception:
        return False

def check_pinata() -> bool:
    key = Config.PINATA_API_KEY
    return bool(key and key != "your_pinata_api_key_here")

# Helper: make a dummy PNG in memory
def make_test_image() -> bytes:
    img = Image.new("RGB", (150, 150), color=(249, 115, 22))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()

# Helper: cleanup test users
def cleanup_test_users(db):
    emails = ["sender_integration@stegochain.test", "receiver_integration@stegochain.test"]
    db["users"].delete_many({"email": {"$in": emails}})
    print("[cleanup] Test users removed from MongoDB.")

def run_tests():
    print("\n" + "="*60)
    print("  STEGOCHAIN V2 INTEGRATION TEST SUITE")
    print("="*60)

    # Detect services
    services = {
        "backend": check_backend(),
        "mongodb": check_mongodb(),
        "sepolia": check_sepolia(),
        "pinata": check_pinata(),
    }

    print("Active Services Detection:")
    for name, ok in services.items():
        print(f"  {name:<15}: {'ONLINE' if ok else 'OFFLINE'}")

    if not services["backend"]:
        print("\n[ERROR] BACKEND OFFLINE. Start the Flask server first.")
        sys.exit(1)

    print("\nStarting Integration Tests...")
    db = MongoClient(Config.MONGO_URI).get_database()
    cleanup_test_users(db)

    # Setup web3
    rpc_url = os.environ.get("BASE_SEPOLIA_RPC_URL")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    contract = load_v2_contract(w3)
    backend_addr = Account.from_key(Config.PRIVATE_KEY).address

    # 1. Health check
    print("\n--- Test 1: Backend Health Check ---")
    r = requests.get(f"{BACKEND_URL}/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    print("Health check PASS")

    # 2. Blockchain Stats
    print("\n--- Test 2: Blockchain Stats ---")
    r = requests.get(f"{BACKEND_URL}/api/blockchain/stats")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    stats = r.json()
    print(f"Stats fetched: total_records={stats.get('total_records')}, network={stats.get('network')}")

    # 3. Generate ECC keypair
    print("\n--- Test 3: Generate ECC Keypair ---")
    r = requests.post(f"{BACKEND_URL}/api/crypto/generate-keypair")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    kp = r.json()
    assert "public_key" in kp and "private_key" in kp
    print("Keypair generation PASS")

    # 4. Register user
    print("\n--- Test 4: Register User ---")
    # Coordinates of backend address (already registered on-chain)
    public_key_x = "1" * 64
    public_key_y = "2" * 64
    reg_payload = {
        "username": "integration_sender",
        "email": "sender_integration@stegochain.test",
        "password": "IntegrationTest2026!",
        "eth_address": backend_addr,
        "public_key_x": public_key_x,
        "public_key_y": public_key_y,
    }
    r = requests.post(f"{BACKEND_URL}/api/auth/register", json=reg_payload)
    assert r.status_code in (200, 409), f"Registration failed: {r.text}"
    print("User registered successfully")

    # 5. Login
    print("\n--- Test 5: Login ---")
    login_payload = {
        "email": "sender_integration@stegochain.test",
        "password": "IntegrationTest2026!",
    }
    r = requests.post(f"{BACKEND_URL}/api/auth/login", json=login_payload)
    assert r.status_code == 200, f"Login failed: {r.text}"
    login_data = r.json()
    token = login_data["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful, token retrieved")

    # 6. Lookup user by ETH
    print("\n--- Test 6: Lookup User by ETH Address ---")
    r = requests.get(f"{BACKEND_URL}/api/auth/user/eth/{backend_addr}")
    assert r.status_code == 200, f"Lookup failed: {r.text}"
    profile = r.json()
    assert profile["eth_address"].lower() == backend_addr.lower()
    print("User lookup PASS")

    # 7. AES Encrypt / Decrypt
    print("\n--- Test 7: AES Encrypt/Decrypt ---")
    aes_key = os.urandom(32)
    aes_key_b64 = base64.b64encode(aes_key).decode()
    message = "StegoChain Integration Secret"
    r = requests.post(f"{BACKEND_URL}/api/crypto/encrypt", json={"message": message, "aes_key_b64": aes_key_b64})
    assert r.status_code == 200, f"Encrypt failed: {r.text}"
    enc_data = r.json()
    r = requests.post(f"{BACKEND_URL}/api/crypto/decrypt", json={
        "ciphertext": enc_data["ciphertext"],
        "nonce": enc_data["nonce"],
        "tag": enc_data["tag"],
        "aes_key_b64": aes_key_b64
    })
    assert r.status_code == 200, f"Decrypt failed: {r.text}"
    assert r.json()["message"] == message
    print("AES Encrypt/Decrypt roundtrip PASS")

    # 8. Stego Embed / Extract
    print("\n--- Test 8: Stego Embed/Extract ---")
    img_bytes = make_test_image()
    files = {"file": ("cover.png", img_bytes, "image/png")}
    data = {"message": "Hidden message in LSB", "file_type": "image"}
    r = requests.post(f"{BACKEND_URL}/api/stego/embed", files=files, data=data)
    assert r.status_code == 200, f"Embed failed: {r.text}"
    embed_data = r.json()
    stego_path = embed_data["stego_file_path"]

    with open(stego_path, "rb") as f:
        r = requests.post(f"{BACKEND_URL}/api/stego/extract", files={"file": ("stego.png", f.read())}, data={"file_type": "image"})
    assert r.status_code == 200, f"Extract failed: {r.text}"
    assert r.json()["message"] == "Hidden message in LSB"
    print("Stego Embed/Extract roundtrip PASS")

    # 9. Graph summary
    print("\n--- Test 9: Anomaly Detection / Graph summary ---")
    r = requests.get(f"{BACKEND_URL}/api/graph/summary")
    assert r.status_code == 200, f"Graph summary failed: {r.text}"
    print("Graph summary PASS")

    # 10. Full Send Pipeline
    print("\n--- Test 10: Full V2 Send Pipeline ---")
    img_bytes = make_test_image()
    files = {"file": ("cover.png", img_bytes, "image/png")}
    data = {
        "message": "Merkle Fragment End-to-End Msg",
        "file_type": "image",
        "receiver_eth": backend_addr,
        "n_fragments": "4"
    }
    r = requests.post(f"{BACKEND_URL}/api/stego/send", files=files, data=data, headers=headers)
    assert r.status_code == 200, f"Send pipeline failed: {r.text}"
    send_result = r.json()
    session_id = send_result["session_id"]
    assert send_result["txn_status"] == "pending"

    # Simulate MetaMask: register the record on-chain using test runner's private key
    from modules.blockchain.web3_v2 import register_record_on_chain
    print("Simulating MetaMask: Registering record on-chain...")
    tx_res = register_record_on_chain(
        w3, contract, Config.PRIVATE_KEY,
        send_result["ipfs_cid"], send_result["fragment_cids"], send_result["receiver_eth"],
        session_id, send_result["merkle_root"], send_result["media_hash"], send_result["total_fragments"]
    )
    tx_hash = tx_res["tx_hash"]
    print(f"Record registered on-chain, tx_hash={tx_hash}")

    # Call finalize-send to complete the transaction status
    print("Calling finalize-send...")
    r = requests.post(f"{BACKEND_URL}/api/stego/finalize-send", json={
        "session_id": session_id,
        "tx_hash": tx_hash
    }, headers=headers)
    assert r.status_code == 200, f"Finalize send failed: {r.text}"
    finalize_res = r.json()
    assert finalize_res["txn_status"] == "complete"
    record_id = finalize_res["blockchain_record_id"]
    merkle_root = finalize_res["merkle_root"]
    fragment_cids = finalize_res["fragment_cids"]
    print(f"Send pipeline PASS: session_id={session_id}, record_id={record_id}")

    # 11. Full Receive Pipeline
    print("\n--- Test 11: Full V2 Receive Pipeline ---")
    # Fetch encrypted fragments from IPFS and decrypt them to compute Merkle proof
    raw_fragments = []
    receiver_pk_x = bytes.fromhex(public_key_x)
    receiver_pk_y = bytes.fromhex(public_key_y)
    
    print("Retrieving fragments from IPFS...")
    for i, cid in enumerate(fragment_cids):
        enc_frag = retrieve_from_ipfs(cid)
        key_material = (receiver_pk_x + receiver_pk_y)[: len(enc_frag)]
        frag = bytes(a ^ b for a, b in zip(enc_frag, key_material.ljust(len(enc_frag), b"\x00")))
        raw_fragments.append(frag)

    # Build Merkle tree from unencrypted fragments
    tree_meta = build_fragment_merkle_tree(raw_fragments)
    # Choose first fragment to verify
    target_idx = 0
    leaf_hash = tree_meta["leaves"][target_idx]
    proof = get_fragment_merkle_proof(raw_fragments, target_idx)

    # Sign challenge
    challenge_msg = f"StegoChain Decrypt Request: {session_id}"
    sig_result = sign_challenge(Config.PRIVATE_KEY, challenge_msg)

    # Request decryption
    req_payload = {
        "record_id": record_id,
        "merkle_proof": proof,
        "leaf_hash": leaf_hash,
        "signature": sig_result["signature"],
        "challenge_hash": sig_result["challenge_hash"]
    }
    
    print("Calling request-decryption...")
    r = requests.post(f"{BACKEND_URL}/api/blockchain/request-decryption", json=req_payload, headers=headers)
    assert r.status_code == 200, f"Decryption request failed: {r.text}"
    dec_auth = r.json()
    assert dec_auth["authorised"] is True

    # Receive stego content using encrypted fragments returned by request-decryption
    recv_payload = {
        "session_id": session_id,
        "fragments_b64": dec_auth["fragments_b64"],
        "file_type": "image"
    }
    print("Calling stego/receive...")
    r = requests.post(f"{BACKEND_URL}/api/stego/receive", json=recv_payload, headers=headers)
    assert r.status_code == 200, f"Receive route failed: {r.text}"
    recv_data = r.json()
    assert recv_data["message"] == "Merkle Fragment End-to-End Msg"
    assert recv_data["blockchain_verified"] is True
    assert recv_data["media_integrity_verified"] is True
    print("Receive pipeline PASS: message decrypted correctly")

    # 12. Revoke Record
    print("\n--- Test 12: Revoke Record ---")
    r = requests.post(f"{BACKEND_URL}/api/blockchain/revoke/{record_id}", headers=headers)
    assert r.status_code == 200, f"Revocation failed: {r.text}"
    print("Revocation PASS")

    print("\n" + "="*60)
    print("  ALL V2 INTEGRATION TESTS PASSED SUCCESSFULLY! (12/12)")
    print("="*60 + "\n")

if __name__ == "__main__":
    try:
        run_tests()
    except AssertionError as e:
        print(f"\n[FAIL] Test assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Test run crashed: {e}")
        sys.exit(1)
