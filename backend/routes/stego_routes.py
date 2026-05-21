"""
Steganography Routes V2
========================
Blueprint: stego_bp    prefix: /api/stego

Unchanged routes (keep exactly as-is):
  POST /api/stego/embed
  POST /api/stego/extract
  GET  /api/stego/capacity

Replaced routes (V2 pipeline):
  POST /api/stego/send    — JWT required, fragments + Merkle tree + on-chain
  POST /api/stego/receive — JWT required, returns media_b64 + message
"""

import base64
import os
import tempfile
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request

from modules.steganography.lsb_image import embed_message_in_image, extract_message_from_image
from modules.crypto.aes_cipher       import generate_aes_key, encrypt_file, decrypt_file
from modules.ipfs.pinata              import (
    build_ipfs_metadata,
    upload_file_to_ipfs,
    retrieve_from_ipfs,
)
from modules.auth.jwt_handler import require_auth
from models.transaction       import Transaction
from config                   import Config

# V2 helpers — imported at module level so unittest.mock.patch targets work
from modules.blockchain.web3_v2 import (
    split_aes_key_to_fragments,
    reconstruct_aes_key_from_fragments,
    build_fragment_merkle_tree,
    get_fragment_merkle_proof,
    register_record_on_chain,
    get_record_v2,
    verify_media_integrity,
)

try:
    from modules.steganography.echo_audio import embed_message_in_audio, extract_message_from_audio
    _AUDIO_AVAILABLE = True
except ImportError:
    _AUDIO_AVAILABLE = False

stego_bp = Blueprint("stego", __name__)

_TMPDIR = os.path.join(tempfile.gettempdir(), "stegochain")
os.makedirs(_TMPDIR, exist_ok=True)


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _cleanup(*paths):
    for p in paths:
        try:
            os.remove(p)
        except (FileNotFoundError, PermissionError):
            pass


def _tmp(suffix=""):
    return os.path.join(_TMPDIR, f"{uuid.uuid4().hex}{suffix}")


def _err(msg, code=400):
    return jsonify({"error": msg, "status": code}), code


def _ok(data):
    data["status"] = 200
    return jsonify(data), 200


def _db():
    return current_app.db


def _get_v2():
    from modules.blockchain.web3_v2 import get_v2_connection, load_v2_contract
    w3 = get_v2_connection()
    contract = load_v2_contract(w3)
    return w3, contract


# ── Simple routes (unchanged) ─────────────────────────────────────────────────

@stego_bp.route("/embed", methods=["POST"])
def embed():
    if "file" not in request.files:
        return _err("No file uploaded")
    file      = request.files["file"]
    message   = request.form.get("message", "").strip()
    file_type = request.form.get("file_type", "").strip().lower()

    if not message:
        return _err("message is required")
    if file_type not in ("image", "audio"):
        return _err("file_type must be 'image' or 'audio'")

    suffix    = os.path.splitext(file.filename)[1] or (".png" if file_type == "image" else ".wav")
    src_path  = _tmp(suffix)
    out_suffix = ".png" if file_type == "image" else suffix
    out_path  = _tmp(out_suffix)

    try:
        file.save(src_path)
        if file_type == "image":
            embed_message_in_image(src_path, message, out_path)
            from PIL import Image
            img = Image.open(src_path)
            w, h = img.size
            capacity = (w * h * 3) // 8
        else:
            if not _AUDIO_AVAILABLE:
                return _err("Audio steganography module not available", 501)
            embed_message_in_audio(src_path, message, out_path)
            capacity = 0

        return _ok({
            "stego_file_path": out_path,
            "file_type":       file_type,
            "capacity_used":   f"{len(message)} of {capacity} characters",
            "message":         "embedded successfully",
        })
    except ValueError as exc:
        return _err(str(exc))
    except Exception as exc:
        return _err(f"Embedding failed: {exc}")
    finally:
        _cleanup(src_path)


@stego_bp.route("/extract", methods=["POST"])
def extract():
    if "file" not in request.files:
        return _err("No file uploaded")
    file      = request.files["file"]
    file_type = request.form.get("file_type", "image").strip().lower()

    if file_type not in ("image", "audio"):
        return _err("file_type must be 'image' or 'audio'")

    suffix   = os.path.splitext(file.filename)[1] or (".png" if file_type == "image" else ".wav")
    src_path = _tmp(suffix)

    try:
        file.save(src_path)
        if file_type == "image":
            message = extract_message_from_image(src_path)
        else:
            if not _AUDIO_AVAILABLE:
                return _err("Audio steganography module not available", 501)
            message = extract_message_from_audio(src_path)
        return _ok({"message": message, "file_type": file_type})
    except ValueError as exc:
        return jsonify({"error": str(exc), "status": 404}), 404
    except Exception as exc:
        return _err(f"Extraction failed: {exc}")
    finally:
        _cleanup(src_path)


@stego_bp.route("/capacity", methods=["GET"])
def capacity():
    file_type = request.args.get("file_type", "").strip().lower()
    if file_type not in ("image", "audio"):
        return _err("file_type must be 'image' or 'audio'")
    if file_type == "image":
        try:
            width  = int(request.args.get("width",  0))
            height = int(request.args.get("height", 0))
        except ValueError:
            return _err("width and height must be integers")
        if width <= 0 or height <= 0:
            return _err("width and height must be positive integers")
        chars = (width * height * 3) // 8
    else:
        try:
            duration    = float(request.args.get("duration", 0))
            sample_rate = int(request.args.get("sample_rate", 44100))
        except ValueError:
            return _err("duration and sample_rate must be numbers")
        if duration <= 0:
            return _err("duration must be positive")
        chars = int((duration * sample_rate) // (512 * 8))
    return _ok({"capacity_characters": chars, "file_type": file_type})


# ── V2 Send Pipeline ──────────────────────────────────────────────────────────

@stego_bp.route("/send", methods=["POST"])
@require_auth
def send():
    """
    Full V2 send pipeline:
    embed → compute media_hash → AES encrypt → IPFS upload (stego)
    → split AES key → ECC encrypt fragments → IPFS upload (fragments)
    → build Merkle tree → register_record_on_chain → MongoDB save
    """
    if "file" not in request.files:
        return _err("No file uploaded")

    file         = request.files["file"]
    message      = request.form.get("message", "").strip()
    file_type    = request.form.get("file_type", "image").strip().lower()
    receiver_eth = request.form.get("receiver_eth", "").strip()
    n_fragments  = min(int(request.form.get("n_fragments", 4)), 8)
    n_fragments  = max(n_fragments, 1)

    if not message:
        return _err("message is required")
    if file_type not in ("image", "audio"):
        return _err("file_type must be 'image' or 'audio'")
    if not receiver_eth:
        return _err("receiver_eth is required")

    # Look up receiver in MongoDB to get public key + user_id
    db          = _db()
    receiver_doc = db["users"].find_one({"eth_address": receiver_eth.lower()})
    if not receiver_doc:
        return _err(f"Receiver {receiver_eth} not found. They must register first.", 400)

    sender_doc = db["users"].find_one({"eth_address": g.eth_address.lower()})
    sender_id  = sender_doc["user_id"] if sender_doc else g.user_id

    suffix     = os.path.splitext(file.filename)[1] or ".png"
    src_path   = _tmp(suffix)
    stego_suffix = ".png" if file_type == "image" else suffix
    stego_path = _tmp(stego_suffix)
    enc_path   = _tmp(".bin")

    txn = Transaction(
        sender_id         = sender_id,
        receiver_id       = receiver_doc["user_id"],
        sender_eth        = g.eth_address,
        receiver_eth      = receiver_eth,
        file_type         = file_type,
        original_filename = file.filename,
        total_fragments   = n_fragments,
        status            = "pending",
    )

    step = "save_upload"
    try:
        file.save(src_path)

        # 1 — Embed message
        step = "embed"
        if file_type == "image":
            embed_message_in_image(src_path, message, stego_path)
        else:
            if not _AUDIO_AVAILABLE:
                raise RuntimeError("Audio steganography not available")
            embed_message_in_audio(src_path, message, stego_path)

        # 2 — Compute media_hash (keccak256 of stego file bytes)
        step = "media_hash"
        from web3 import Web3
        with open(stego_path, "rb") as fh:
            stego_bytes = fh.read()
        media_hash_bytes = Web3.keccak(stego_bytes)
        media_hash = "0x" + media_hash_bytes.hex()
        txn.media_hash = media_hash

        # 3 — Generate AES key and encrypt stego file
        step = "encrypt"
        aes_key  = generate_aes_key()
        enc_meta = encrypt_file(stego_path, aes_key, enc_path)
        txn.nonce = enc_meta["nonce"]
        txn.tag   = enc_meta["tag"]

        # 4 — Upload encrypted stego to IPFS
        step = "ipfs_upload_media"
        ipfs_meta    = build_ipfs_metadata(txn.session_id, sender_id, receiver_doc["user_id"], file_type)
        upload_result = upload_file_to_ipfs(
            enc_path, Config.PINATA_API_KEY, Config.PINATA_SECRET_KEY, metadata=ipfs_meta,
        )
        txn.ipfs_cid         = upload_result["cid"]
        txn.ipfs_gateway_url = upload_result["gateway_url"]

        # 5 — Split AES key into n fragments
        step = "split_key"
        raw_fragments = split_aes_key_to_fragments(aes_key, n_fragments)


        # 6 — Encrypt each fragment with receiver's ECC public key and upload to IPFS
        step = "encrypt_fragments"
        receiver_pk_x = bytes.fromhex(receiver_doc.get("public_key_x", "").lstrip("0x"))
        receiver_pk_y = bytes.fromhex(receiver_doc.get("public_key_y", "").lstrip("0x"))

        fragment_cids = []
        for i, frag in enumerate(raw_fragments):
            # Simple XOR encryption with receiver public key bytes for IPFS storage
            # (Full ECDH would require curve25519; this demonstrates the architecture)
            key_material = (receiver_pk_x + receiver_pk_y)[: len(frag)]
            enc_frag = bytes(a ^ b for a, b in zip(frag, key_material.ljust(len(frag), b"\x00")))
            frag_tmp = _tmp(".frag")
            with open(frag_tmp, "wb") as fh:
                fh.write(enc_frag)
            frag_meta = {"name": f"frag-{i}-{txn.session_id}", "keyvalues": {"fragment_index": str(i)}}
            frag_result = upload_file_to_ipfs(
                frag_tmp, Config.PINATA_API_KEY, Config.PINATA_SECRET_KEY, metadata=frag_meta,
            )
            fragment_cids.append(frag_result["cid"])
            _cleanup(frag_tmp)

        txn.fragment_cids = fragment_cids

        # 7 — Build Merkle tree from raw (unencrypted) fragments
        step = "merkle_tree"
        merkle = build_fragment_merkle_tree(raw_fragments)
        txn.merkle_root = merkle["root"]

        # 8 — Save Transaction as pending (MetaMask will execute registerRecord on-chain)
        step = "save_transaction"
        txn.status = "pending"
        db["transactions"].insert_one(txn.to_dict())

        return _ok({
            "session_id":      txn.session_id,
            "ipfs_cid":        txn.ipfs_cid,
            "gateway_url":     txn.ipfs_gateway_url,
            "fragment_cids":   fragment_cids,
            "merkle_root":     merkle["root"],
            "media_hash":      media_hash,
            "total_fragments": n_fragments,
            "receiver_eth":    receiver_eth,
            "contract_address": Config.CONTRACT_ADDRESS,
            "status":          "pending",
            "txn_status":      "pending",
            "message":         "Transaction prepared. Please call registerRecord via MetaMask.",
        })

    except Exception as exc:
        txn.status = "failed"
        try:
            _db()["transactions"].insert_one(txn.to_dict())
        except Exception:
            pass
        return jsonify({"error": f"Step '{step}' failed: {exc}", "step": step, "status": 500}), 500
    finally:
        _cleanup(src_path, stego_path, enc_path)


@stego_bp.route("/finalize-send", methods=["POST"])
@require_auth
def finalize_send():
    """
    Verify on-chain registration of a record via tx_hash and update transaction status to complete.
    """
    data       = request.get_json(force=True) or {}
    session_id = data.get("session_id", "").strip()
    tx_hash    = data.get("tx_hash", "").strip()

    if not session_id or not tx_hash:
        return _err("session_id and tx_hash are required")

    db      = _db()
    txn_doc = db["transactions"].find_one({"session_id": session_id})
    if not txn_doc:
        return _err(f"No transaction for session_id {session_id}", 404)

    # Prevent spoofing: only the original sender can finalize
    if txn_doc.get("sender_eth", "").lower() != g.eth_address.lower():
        return _err("Only the message sender can finalize this transaction", 403)

    if txn_doc.get("status") == "complete":
        return _ok({
            "session_id":           session_id,
            "blockchain_record_id": txn_doc.get("blockchain_record_id"),
            "tx_hash":              txn_doc.get("tx_hash"),
            "status":               "complete",
            "txn_status":           "complete",
            "message":              "Transaction already finalized",
        })

    try:
        w3, contract = _get_v2()

        # Get transaction receipt
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        if receipt is None:
            return _err("Transaction not found or not yet confirmed", 404)
        if receipt.status != 1:
            return _err("Transaction failed on-chain", 400)

        # Parse logs to find RecordRegistered event
        logs = contract.events.RecordRegistered().process_receipt(receipt)
        if not logs:
            return _err("RecordRegistered event not found in transaction logs", 400)

        event_args = logs[0]["args"]
        record_id  = event_args["recordId"]
        evt_session_id = event_args["sessionId"]
        evt_merkle_root = "0x" + event_args["merkleRoot"].hex()

        # Validate event details against MongoDB
        if evt_session_id != session_id:
            return _err("Transaction sessionId does not match", 400)
        if evt_merkle_root.lower() != txn_doc.get("merkle_root", "").lower():
            return _err("Transaction Merkle root does not match", 400)

        # Update MongoDB transaction
        txn_doc["status"]               = "complete"
        txn_doc["blockchain_record_id"] = record_id
        txn_doc["tx_hash"]              = tx_hash
        txn_doc["block_number"]         = receipt["blockNumber"]
        txn_doc["completed_at"]         = datetime.now(timezone.utc).isoformat()

        db["transactions"].replace_one({"_id": txn_doc["_id"]}, txn_doc)

        return _ok({
            "session_id":           session_id,
            "ipfs_cid":             txn_doc.get("ipfs_cid"),
            "fragment_cids":        txn_doc.get("fragment_cids"),
            "merkle_root":          txn_doc.get("merkle_root"),
            "blockchain_record_id": record_id,
            "tx_hash":              tx_hash,
            "basescan_url":         f"https://sepolia.etherscan.io/tx/{tx_hash}",
            "status":               "complete",
            "txn_status":           "complete",
            "message":              "Transaction finalized successfully",
        })
    except ConnectionError as exc:
        return _err(f"RPC unreachable: {exc}", 503)
    except Exception as exc:
        return _err(f"Finalization failed: {exc}", 500)


# ── V2 Receive Pipeline ───────────────────────────────────────────────────────

@stego_bp.route("/receive", methods=["POST"])
@require_auth
def receive():
    """
    Full V2 receive pipeline.
    Accepts pre-assembled fragments_b64 from the frontend (after requestDecryption).
    Reconstructs AES key, decrypts stego file, extracts message.
    Returns: message + media_b64 + blockchain_verified + media_integrity_verified.
    """
    data         = request.get_json(force=True) or {}
    session_id   = data.get("session_id", "")
    fragments_b64= data.get("fragments_b64", [])
    file_type    = data.get("file_type", "image")

    if not session_id:
        return _err("session_id is required")
    if not fragments_b64:
        return _err("fragments_b64 list is required")

    db      = _db()
    txn_doc = db["transactions"].find_one({"session_id": session_id})
    if not txn_doc:
        return _err(f"No transaction for session_id {session_id}", 404)
    txn = Transaction.from_dict(txn_doc)

    # Check blockchain record is still active
    blockchain_verified    = False
    media_integrity_verified = False
    try:
        w3, contract = _get_v2()
        rec = get_record_v2(w3, contract, txn.blockchain_record_id)
        if not rec["is_active"]:
            return _err("Blockchain record has been revoked", 403)
        blockchain_verified = True
        media_integrity_verified = verify_media_integrity(
            w3, contract, txn.blockchain_record_id, txn.media_hash
        )
    except Exception:
        pass  # fail-open: don't block receive if chain unreachable

    enc_path = _tmp(".bin")
    dec_path = _tmp(".png" if file_type == "image" else ".wav")

    try:
        # Decode fragments from base64 back to raw bytes
        encrypted_fragments = [base64.b64decode(b64) for b64 in fragments_b64]

        # Look up receiver in MongoDB to get public key coordinates
        receiver_doc = db["users"].find_one({"eth_address": g.eth_address.lower()})
        if not receiver_doc:
            return _err("Receiver not found in database", 404)

        pk_x = bytes.fromhex(receiver_doc.get("public_key_x", "").lstrip("0x"))
        pk_y = bytes.fromhex(receiver_doc.get("public_key_y", "").lstrip("0x"))
        key_material = pk_x + pk_y

        raw_fragments = []
        for frag in encrypted_fragments:
            km = key_material[: len(frag)]
            dec_frag = bytes(a ^ b for a, b in zip(frag, km.ljust(len(frag), b"\x00")))
            raw_fragments.append(dec_frag)

        # Reconstruct AES key
        try:
            aes_key = reconstruct_aes_key_from_fragments(raw_fragments)
        except Exception as exc:
            return _err(f"Cannot reconstruct AES key from fragments: {exc}", 400)

        # Retrieve encrypted stego file from IPFS
        enc_bytes = retrieve_from_ipfs(txn.ipfs_cid)
        with open(enc_path, "wb") as fh:
            fh.write(enc_bytes)

        # Decrypt
        decrypt_file(enc_path, aes_key, txn.nonce, txn.tag, dec_path)

        # Read decrypted stego file as base64 for frontend display
        with open(dec_path, "rb") as fh:
            stego_bytes = fh.read()
        media_b64 = base64.b64encode(stego_bytes).decode("utf-8")

        # Determine MIME type
        media_mime = "image/png" if file_type == "image" else "audio/wav"

        # Extract hidden message
        if file_type == "image":
            secret_message = extract_message_from_image(dec_path)
        else:
            if not _AUDIO_AVAILABLE:
                raise RuntimeError("Audio steganography not available")
            secret_message = extract_message_from_audio(dec_path)

        return _ok({
            "session_id":              session_id,
            "message":                 secret_message,
            "file_type":               file_type,
            "media_b64":               media_b64,
            "media_mime":              media_mime,
            "blockchain_verified":     blockchain_verified,
            "media_integrity_verified": media_integrity_verified,
            "sender_eth":              txn.sender_eth,
            "sender_id":               txn.sender_id,
        })

    except ValueError as exc:
        return _err(str(exc), 400)
    except Exception as exc:
        return _err(f"Receive pipeline failed: {exc}", 500)
    finally:
        _cleanup(enc_path, dec_path)
