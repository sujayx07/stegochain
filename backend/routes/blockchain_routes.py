"""
Blockchain Routes V2
=====================
Blueprint: blockchain_bp    prefix: /api/blockchain

All write routes require JWT auth.
Targets StegoChainV2 at BASE_SEPOLIA_RPC_URL.
"""
import base64
import os

from flask import Blueprint, current_app, g, jsonify, request
from web3 import Web3

from modules.auth.jwt_handler import require_auth

blockchain_bp = Blueprint("blockchain_bp", __name__)

CONTRACT_ADDRESS = os.environ.get("CONTRACT_ADDRESS", "")
BASESCAN_BASE    = "https://sepolia.etherscan.io"


def _err(msg, code=400):
    return jsonify({"error": msg, "status": code}), code


def _ok(data):
    data["status"] = 200
    return jsonify(data), 200


def _get_contract():
    from modules.blockchain.web3_v2 import get_v2_connection, load_v2_contract
    w3       = get_v2_connection()
    contract = load_v2_contract(w3)
    return w3, contract


def _private_key():
    return os.environ.get("PRIVATE_KEY", "")


def _basescan_tx(tx_hash: str) -> str:
    return f"{BASESCAN_BASE}/tx/{tx_hash}"


def _basescan_addr(addr: str) -> str:
    return f"{BASESCAN_BASE}/address/{addr}"


# ── POST /api/blockchain/register-record ─────────────────────────────────────

@blockchain_bp.route("/register-record", methods=["POST"])
@require_auth
def register_record():
    data = request.get_json(force=True) or {}
    ipfs_cid        = data.get("ipfs_cid", "")
    fragment_cids   = data.get("fragment_cids", [])
    receiver_address= data.get("receiver_address", "")
    session_id      = data.get("session_id", "")
    merkle_root     = data.get("merkle_root", "")
    media_hash      = data.get("media_hash", "")
    total_fragments = int(data.get("total_fragments", 0))

    for field, val in [("ipfs_cid", ipfs_cid), ("receiver_address", receiver_address),
                       ("session_id", session_id), ("merkle_root", merkle_root),
                       ("media_hash", media_hash)]:
        if not val:
            return _err(f"{field} is required")
    if not fragment_cids:
        return _err("fragment_cids must be a non-empty list")

    try:
        from modules.blockchain.web3_v2 import (
            get_user_profile, register_record_on_chain,
        )
        w3, contract = _get_contract()

        sender_profile = get_user_profile(w3, contract, g.eth_address)
        if not sender_profile["is_registered"]:
            return _err("Sender not registered on-chain. Call /api/auth/register-chain first.", 403)

        receiver_profile = get_user_profile(w3, contract, receiver_address)
        if not receiver_profile["is_registered"]:
            return _err("Receiver is not registered on-chain.", 400)

        result = register_record_on_chain(
            w3, contract, _private_key(),
            ipfs_cid, fragment_cids, receiver_address,
            session_id, merkle_root, media_hash, total_fragments,
        )
        return _ok({
            "record_id":    result["record_id"],
            "tx_hash":      result["tx_hash"],
            "block_number": result["block_number"],
            "gas_used":     result["gas_used"],
            "basescan_url": _basescan_tx(result["tx_hash"]),
        })
    except ConnectionError as exc:
        return _err(f"RPC unreachable: {exc}", 503)
    except Exception as exc:
        return _err(f"register-record failed: {exc}", 500)


# ── POST /api/blockchain/request-decryption ──────────────────────────────────

@blockchain_bp.route("/request-decryption", methods=["POST"])
@require_auth
def request_decryption():
    data           = request.get_json(force=True) or {}
    record_id_raw  = data.get("record_id")
    session_id     = data.get("session_id", "")
    signature      = data.get("signature", "")       # hex, from MetaMask signMessage
    challenge_hash = data.get("challenge_hash", "")  # raw keccak256 of challenge string

    if not signature or not challenge_hash:
        return _err("signature and challenge_hash are required")

    try:
        from modules.blockchain.web3_v2 import (
            get_record_v2, get_record_by_session, request_decryption_on_chain,
            build_fragment_merkle_tree, get_fragment_merkle_proof,
        )
        from modules.ipfs.pinata import retrieve_from_ipfs
        from modules.blockchain.web3_v2 import get_v2_connection, load_v2_contract
        import base64
        from pymongo import MongoClient
        import os as _os

        w3, contract = _get_contract()

        # Resolve record
        if record_id_raw is not None:
            record_id = int(record_id_raw)
            rec = get_record_v2(w3, contract, record_id)
        elif session_id:
            print(f"[DECRYPT] Looking up record by session_id={session_id}")
            rec = get_record_by_session(w3, contract, session_id)
            record_id = rec["record_id"]
        else:
            return _err("record_id or session_id is required")

        print(f"[DECRYPT] record_id={record_id} receiver={rec['receiver']} caller={g.eth_address}")

        if rec["receiver"].lower() != g.eth_address.lower():
            return _err("You are not the intended receiver of this record", 403)
        if not rec["is_active"]:
            return _err("Record has been revoked", 403)

        # ── Fetch fragment bytes from IPFS ─────────────────────────────────
        # We need the RAW (unencrypted) fragment bytes to build the correct Merkle tree.
        # Fragments were XOR-encrypted with receiver's public key on upload, so we
        # XOR-decrypt them back first to get the raw fragment bytes.
        from flask import current_app
        mongo_uri = _os.environ.get("MONGO_URI", "")
        client    = MongoClient(mongo_uri)
        db        = client.get_database()
        receiver_doc = db["users"].find_one({"eth_address": g.eth_address.lower()})
        if not receiver_doc:
            return _err("Receiver user not found in database", 404)

        pk_x = bytes.fromhex(receiver_doc.get("public_key_x", "").lstrip("0x"))
        pk_y = bytes.fromhex(receiver_doc.get("public_key_y", "").lstrip("0x"))
        key_material = pk_x + pk_y

        raw_fragments_bytes = []
        encrypted_frags_b64 = []
        for cid in rec["fragment_cids"]:
            try:
                enc_frag = retrieve_from_ipfs(cid)
                # XOR-decrypt back to raw fragment
                km = key_material[: len(enc_frag)]
                raw_frag = bytes(a ^ b for a, b in zip(enc_frag, km.ljust(len(enc_frag), b"\x00")))
                raw_fragments_bytes.append(raw_frag)
                encrypted_frags_b64.append(base64.b64encode(enc_frag).decode("utf-8"))
                print(f"[DECRYPT] CID={cid[:16]}… raw={len(raw_frag)}B")
            except Exception as fe:
                print(f"[DECRYPT] WARNING fragment fetch failed: {fe}")

        if not raw_fragments_bytes:
            return _err("Could not retrieve any key fragments from IPFS", 503)

        # ── Build Merkle tree from raw fragments to get leaf + proof ───────
        merkle      = build_fragment_merkle_tree(raw_fragments_bytes)
        leaf_hash   = merkle["leaves"][0]              # first leaf
        merkle_proof = get_fragment_merkle_proof(raw_fragments_bytes, 0)
        print(f"[DECRYPT] leaf={leaf_hash[:18]}… proof_len={len(merkle_proof)} root={merkle['root'][:18]}…")

        # ── Call on-chain requestDecryption ────────────────────────────────
        result = request_decryption_on_chain(
            w3, contract, _private_key(),
            record_id, merkle_proof, leaf_hash, signature, challenge_hash,
        )
        print(f"[DECRYPT] on-chain result: authorised={result['authorised']} tx={result['tx_hash'][:18]}…")

        # ── Return fragment bytes so stego/receive can reconstruct AES key ─
        return _ok({
            "authorised":      result["authorised"],
            "record_id":       record_id,
            "tx_hash":         result["tx_hash"],
            "fragments_b64":   encrypted_frags_b64,   # frontend doesn't need to XOR; stego/receive does
            "total_fragments": len(encrypted_frags_b64),
            "media_hash":      rec["media_hash"],
            "file_type":       "image",
        })
    except ConnectionError as exc:
        return _err(f"RPC unreachable: {exc}", 503)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return _err(f"request-decryption failed: {exc}", 500)


# ── GET /api/blockchain/decryption-prep ──────────────────────────────────────
# Returns the Merkle proof, leaf hash, and record_id the frontend needs
# to call requestDecryption DIRECTLY on the contract via MetaMask.
# msg.sender will be the receiver's own wallet — contract check will pass.

@blockchain_bp.route("/decryption-prep", methods=["GET"])
@require_auth
def decryption_prep():
    session_id = request.args.get("session_id", "").strip()
    if not session_id:
        return _err("session_id query parameter is required")
    try:
        from modules.blockchain.web3_v2 import (
            get_record_by_session, build_fragment_merkle_tree, get_fragment_merkle_proof,
        )
        from modules.ipfs.pinata import retrieve_from_ipfs
        from pymongo import MongoClient
        import os as _os

        w3, contract = _get_contract()
        rec = get_record_by_session(w3, contract, session_id)
        record_id = rec["record_id"]

        # Check caller is the receiver
        if rec["receiver"].lower() != g.eth_address.lower():
            return _err("You are not the intended receiver of this record", 403)
        if not rec["is_active"]:
            return _err("Record has been revoked", 403)

        # Fetch receiver's public key to XOR-decrypt fragments back to raw bytes
        client = MongoClient(_os.environ.get("MONGO_URI", ""))
        db     = client.get_database()
        receiver_doc = db["users"].find_one({"eth_address": g.eth_address.lower()})
        if not receiver_doc:
            return _err("Receiver not found in database", 404)

        pk_x = bytes.fromhex(receiver_doc.get("public_key_x", "").lstrip("0x"))
        pk_y = bytes.fromhex(receiver_doc.get("public_key_y", "").lstrip("0x"))
        key_material = pk_x + pk_y

        raw_fragments = []
        for cid in rec["fragment_cids"]:
            enc = retrieve_from_ipfs(cid)
            km  = key_material[: len(enc)]
            raw = bytes(a ^ b for a, b in zip(enc, km.ljust(len(enc), b"\x00")))
            raw_fragments.append(raw)

        if not raw_fragments:
            return _err("Could not fetch any fragments from IPFS", 503)

        # Build Merkle tree — same algorithm as send pipeline
        merkle       = build_fragment_merkle_tree(raw_fragments)
        leaf_hash    = merkle["leaves"][0]   # hex string with 0x prefix
        merkle_proof = get_fragment_merkle_proof(raw_fragments, 0)  # list of hex strings

        print(f"[PREP] session={session_id[:16]} record_id={record_id} "
              f"leaf={leaf_hash[:18]}… proof_len={len(merkle_proof)}")

        return _ok({
            "record_id":    record_id,
            "merkle_proof": merkle_proof,
            "leaf_hash":    leaf_hash,
            "merkle_root":  merkle["root"],
            "receiver":     rec["receiver"],
            "sender":       rec["sender"],
            "is_active":    rec["is_active"],
            "contract_address": os.environ.get("CONTRACT_ADDRESS", ""),
        })
    except ConnectionError as exc:
        return _err(f"RPC unreachable: {exc}", 503)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return _err(f"decryption-prep failed: {exc}", 500)


# ── POST /api/blockchain/fragments-after-auth ─────────────────────────────────
# Called AFTER the frontend MetaMask tx for requestDecryption is confirmed.
# Verifies the DecryptionAuthorised event exists in the tx, then returns fragments.

@blockchain_bp.route("/fragments-after-auth", methods=["POST"])
@require_auth
def fragments_after_auth():
    data       = request.get_json(force=True) or {}
    session_id = data.get("session_id", "").strip()
    tx_hash    = data.get("tx_hash", "").strip()

    if not session_id or not tx_hash:
        return _err("session_id and tx_hash are required")
    try:
        from modules.blockchain.web3_v2 import get_record_by_session
        from modules.ipfs.pinata import retrieve_from_ipfs
        from pymongo import MongoClient
        import os as _os, base64

        w3, contract = _get_contract()

        # Verify the tx receipt contains a DecryptionAuthorised event
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        if receipt is None:
            return _err("Transaction not found or not yet confirmed", 404)
        if receipt.status != 1:
            return _err("Transaction failed on-chain", 400)

        event_sig = w3.keccak(text="DecryptionAuthorised(uint256,address,uint256)").hex()
        found = any(
            log["topics"] and log["topics"][0].hex() == event_sig
            for log in receipt.logs
        )
        if not found:
            return _err("DecryptionAuthorised event not found in this transaction", 403)

        rec = get_record_by_session(w3, contract, session_id)
        if rec["receiver"].lower() != g.eth_address.lower():
            return _err("You are not the intended receiver", 403)

        # Fetch encrypted fragments from IPFS
        client = MongoClient(_os.environ.get("MONGO_URI", ""))
        db     = client.get_database()
        receiver_doc = db["users"].find_one({"eth_address": g.eth_address.lower()})
        if not receiver_doc:
            return _err("Receiver not found in database", 404)

        fragments_b64 = []
        for cid in rec["fragment_cids"]:
            try:
                enc = retrieve_from_ipfs(cid)
                fragments_b64.append(base64.b64encode(enc).decode())
            except Exception as fe:
                print(f"[FRAGS] fragment fetch error {cid}: {fe}")

        print(f"[FRAGS] session={session_id[:16]} tx={tx_hash[:18]} frags={len(fragments_b64)}")
        return _ok({
            "authorised":    True,
            "fragments_b64": fragments_b64,
            "tx_hash":       tx_hash,
            "media_hash":    rec["media_hash"],
            "file_type":     "image",
        })
    except ConnectionError as exc:
        return _err(f"RPC unreachable: {exc}", 503)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return _err(f"fragments-after-auth failed: {exc}", 500)


# ── GET /api/blockchain/record/<record_id> ────────────────────────────────────

@blockchain_bp.route("/record/<int:record_id>", methods=["GET"])
def get_record(record_id):
    try:
        from modules.blockchain.web3_v2 import get_record_v2
        w3, contract = _get_contract()
        rec = get_record_v2(w3, contract, record_id)
        rec["basescan_url"] = _basescan_tx(rec.get("tx_hash", "")) if rec.get("tx_hash") else ""
        return _ok(rec)
    except Exception as exc:
        return _err(str(exc), 500)


# ── GET /api/blockchain/record/session/<session_id> ──────────────────────────

@blockchain_bp.route("/record/session/<session_id>", methods=["GET"])
def get_record_by_session(session_id):
    try:
        from modules.blockchain.web3_v2 import get_record_by_session
        w3, contract = _get_contract()
        rec = get_record_by_session(w3, contract, session_id)
        return _ok(rec)
    except Exception as exc:
        return _err(str(exc), 500)


# ── GET /api/blockchain/my-sent ───────────────────────────────────────────────

@blockchain_bp.route("/my-sent", methods=["GET"])
@require_auth
def my_sent():
    try:
        from modules.blockchain.web3_v2 import get_record_v2
        w3, contract = _get_contract()
        ids = contract.functions.getSenderRecords(
            Web3.to_checksum_address(g.eth_address)
        ).call()
        records = []
        for rid in ids:
            try:
                records.append(get_record_v2(w3, contract, rid))
            except Exception:
                pass
        return _ok({"records": records, "count": len(records)})
    except Exception as exc:
        return _err(str(exc), 500)


# ── GET /api/blockchain/my-received ──────────────────────────────────────────

@blockchain_bp.route("/my-received", methods=["GET"])
@require_auth
def my_received():
    try:
        from modules.blockchain.web3_v2 import get_record_v2
        w3, contract = _get_contract()
        ids = contract.functions.getReceiverRecords(
            Web3.to_checksum_address(g.eth_address)
        ).call()
        records = []
        for rid in ids:
            try:
                records.append(get_record_v2(w3, contract, rid))
            except Exception:
                pass
        return _ok({"records": records, "count": len(records)})
    except Exception as exc:
        return _err(str(exc), 500)


# ── POST /api/blockchain/verify-integrity ────────────────────────────────────

@blockchain_bp.route("/verify-integrity", methods=["POST"])
def verify_integrity():
    data       = request.get_json(force=True) or {}
    record_id  = int(data.get("record_id", 0))
    media_hash = data.get("media_hash", "")
    if not media_hash:
        return _err("media_hash is required")
    try:
        from modules.blockchain.web3_v2 import verify_media_integrity
        w3, contract = _get_contract()
        verified = verify_media_integrity(w3, contract, record_id, media_hash)
        return _ok({"verified": verified, "record_id": record_id})
    except Exception as exc:
        return _err(str(exc), 500)


# ── POST /api/blockchain/revoke/<record_id> ──────────────────────────────────

@blockchain_bp.route("/revoke/<int:record_id>", methods=["POST"])
@require_auth
def revoke(record_id):
    try:
        from modules.blockchain.web3_v2 import get_record_v2, revoke_record_v2
        w3, contract = _get_contract()
        rec = get_record_v2(w3, contract, record_id)
        if rec["sender"].lower() != g.eth_address.lower():
            return _err("Only the sender can revoke this record", 403)
        result = revoke_record_v2(w3, contract, _private_key(), record_id)
        return _ok({
            "revoked":      True,
            "record_id":    record_id,
            "tx_hash":      result["tx_hash"],
            "basescan_url": _basescan_tx(result["tx_hash"]),
        })
    except Exception as exc:
        return _err(str(exc), 500)


# ── GET /api/blockchain/stats ─────────────────────────────────────────────────

@blockchain_bp.route("/stats", methods=["GET"])
def stats():
    try:
        from modules.blockchain.web3_v2 import get_contract_stats_v2
        w3, contract = _get_contract()
        s = get_contract_stats_v2(w3, contract)
        addr = os.environ.get("CONTRACT_ADDRESS", "")
        return _ok({
            "total_records":   s["total_records"],
            "total_users":     s["total_users"],
            "contract_owner":  s["contract_owner"],
            "contract_address": addr,
            "network":         "Ethereum Sepolia",
            "chain_id":        11155111,
            "basescan_url":    _basescan_addr(addr) if addr else "",
        })
    except Exception as exc:
        return _err(str(exc), 500)


# ── GET /api/blockchain/user/<eth_address> ────────────────────────────────────

@blockchain_bp.route("/user/<eth_address>", methods=["GET"])
def get_chain_user(eth_address):
    try:
        from modules.blockchain.web3_v2 import get_user_profile
        w3, contract = _get_contract()
        profile = get_user_profile(w3, contract, eth_address)
        return _ok(profile)
    except Exception as exc:
        return _err(str(exc), 500)
