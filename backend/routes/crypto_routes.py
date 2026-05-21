"""
Crypto Routes
==============
Blueprint: crypto_bp    prefix: /api/crypto
"""
import base64
from flask import Blueprint, current_app, jsonify, request
from modules.crypto.aes_cipher     import encrypt_message, decrypt_message
from modules.crypto.key_exchange   import generate_ecc_keypair, derive_shared_key
from modules.secret_sharing.shamir import split_secret, reconstruct_secret
from models.keyshare               import KeyShare

crypto_bp = Blueprint("crypto_bp", __name__)

def _err(msg, code=400): return jsonify({"error": msg, "status": code}), code
def _ok(data):
    data["status"] = 200
    return jsonify(data), 200
def _db(): return current_app.db

@crypto_bp.route("/generate-keypair", methods=["POST"])
def generate_keypair():
    try:
        kp = generate_ecc_keypair()
        return _ok({"public_key": kp["public_key"], "private_key": kp["private_key"],
                     "public_key_pem": kp["public_key_pem"], "private_key_pem": kp["private_key_pem"],
                     "public_key_x": kp["public_key_x"], "public_key_y": kp["public_key_y"],
                     "warning": "Store private key securely. Never send it over the network."})
    except Exception as e:
        return _err(f"Keypair generation failed: {e}")

@crypto_bp.route("/encrypt", methods=["POST"])
def encrypt():
    data = request.get_json(force=True) or {}
    message, key_b64 = data.get("message",""), data.get("aes_key_b64","")
    if not message: return _err("message is required")
    if not key_b64: return _err("aes_key_b64 is required")
    try:
        r = encrypt_message(message, base64.b64decode(key_b64))
        return _ok({"ciphertext": r["ciphertext"], "nonce": r["nonce"], "tag": r["tag"]})
    except Exception as e:
        return _err(f"Encryption failed: {e}")

@crypto_bp.route("/decrypt", methods=["POST"])
def decrypt():
    data = request.get_json(force=True) or {}
    for f in ("ciphertext","nonce","tag","aes_key_b64"):
        if not data.get(f): return _err(f"{f} is required")
    try:
        msg = decrypt_message({"ciphertext": data["ciphertext"],
                               "nonce": data["nonce"],
                               "tag": data["tag"]},
                              base64.b64decode(data["aes_key_b64"]))
        return _ok({"message": msg})
    except Exception as e:
        return _err(f"Decryption failed: {e}")

@crypto_bp.route("/derive-shared-key", methods=["POST"])
def derive_key():
    data = request.get_json(force=True) or {}
    priv, pub = data.get("private_key_pem",""), data.get("peer_public_key_pem","")
    if not priv or not pub: return _err("private_key_pem and peer_public_key_pem are required")
    try:
        key = derive_shared_key(priv, pub)
        return _ok({"shared_key_b64": base64.b64encode(key).decode(), "key_length_bytes": len(key)})
    except Exception as e:
        return _err(f"Key derivation failed: {e}")

@crypto_bp.route("/split-key", methods=["POST"])
def split_key():
    data = request.get_json(force=True) or {}
    key_b64, k, n = data.get("aes_key_b64",""), int(data.get("k",3)), int(data.get("n",5))
    session_id, owner_ids = data.get("session_id",""), data.get("owner_ids",[])
    if not key_b64:    return _err("aes_key_b64 is required")
    if not session_id: return _err("session_id is required")
    if len(owner_ids) != n: return _err(f"owner_ids must have exactly {n} elements")
    try:
        shares = split_secret(base64.b64decode(key_b64), k, n)
        db = _db()
        for i, sh in enumerate(shares):
            ks = KeyShare(sh["share_index"], sh["share_data"], k, n,
                          sh["checksum"], owner_ids[i], session_id)
            db["keyshares"].insert_one(ks.to_dict())
        return _ok({"session_id": session_id, "shares_created": n, "k": k, "n": n,
                     "share_indices": [s["share_index"] for s in shares]})
    except Exception as e:
        return _err(f"Key splitting failed: {e}")

@crypto_bp.route("/reconstruct-key", methods=["POST"])
def reconstruct_key():
    data = request.get_json(force=True) or {}
    session_id, owner_ids = data.get("session_id",""), data.get("owner_ids",[])
    if not session_id: return _err("session_id is required")
    if not owner_ids:  return _err("owner_ids list is required")
    try:
        db = _db()
        docs = list(db["keyshares"].find({"session_id": session_id, "owner_id": {"$in": owner_ids}}))
        k = docs[0]["k"] if docs else 0
        if len(docs) < k: return _err(f"Insufficient shares: need {k}, found {len(docs)}", 400)
        key = reconstruct_secret([KeyShare.from_dict(d).to_share_dict() for d in docs[:k]])
        return _ok({"aes_key_b64": base64.b64encode(key).decode(), "session_id": session_id})
    except Exception as e:
        return _err(f"Key reconstruction failed: {e}")
