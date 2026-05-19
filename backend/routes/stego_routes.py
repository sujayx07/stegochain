"""
Steganography Routes
=====================
Blueprint: stego_bp    prefix: /api/stego

Endpoints:
  POST /api/stego/embed          — embed message in media file
  POST /api/stego/extract        — extract hidden message from stego file
  GET  /api/stego/capacity       — estimate capacity without uploading file
  POST /api/stego/send           — full pipeline: embed→encrypt→IPFS→blockchain→split
  POST /api/stego/receive        — full reverse pipeline: reconstruct→retrieve→decrypt→extract
"""

import base64
import os
import tempfile
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

from modules.steganography.lsb_image import embed_message_in_image, extract_message_from_image
from modules.crypto.aes_cipher       import generate_aes_key, encrypt_file, decrypt_file
from modules.ipfs.pinata              import (
    build_ipfs_metadata,
    upload_file_to_ipfs,
    retrieve_from_ipfs,
)
from modules.blockchain.web3_client  import (
    build_merkle_tree,
    register_record,
    verify_record,
    get_web3_connection,
    load_contract,
    _load_abi,
)
from modules.secret_sharing.shamir   import split_secret, reconstruct_secret
from models.keyshare                 import KeyShare
from models.transaction              import Transaction
from config                          import Config

try:
    from modules.steganography.echo_audio import embed_message_in_audio, extract_message_from_audio
    _AUDIO_AVAILABLE = True
except ImportError:
    _AUDIO_AVAILABLE = False

stego_bp = Blueprint("stego", __name__)

# Temp directory for stego pipeline files
_TMPDIR = os.path.join(tempfile.gettempdir(), "stegochain")
os.makedirs(_TMPDIR, exist_ok=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cleanup(*paths: str) -> None:
    for p in paths:
        try:
            os.remove(p)
        except (FileNotFoundError, PermissionError):
            pass


def _tmp(suffix: str = "") -> str:
    return os.path.join(_TMPDIR, f"{uuid.uuid4().hex}{suffix}")


def _err(msg: str, code: int = 400):
    return jsonify({"error": msg, "status": code}), code


def _ok(data: dict):
    data["status"] = 200
    return jsonify(data), 200


def _get_db():
    return current_app.db


# ── Simple routes ─────────────────────────────────────────────────────────────

@stego_bp.route("/embed", methods=["POST"])
def embed():
    """Embed a secret message in a media file and return stego file path."""
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
    out_path  = _tmp(suffix)

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
            capacity = 0   # audio capacity varies

        capacity_used = f"{len(message)} of {capacity} characters"
        return _ok({
            "stego_file_path": out_path,
            "file_type":       file_type,
            "capacity_used":   capacity_used,
            "message":         "embedded successfully",
        })
    except ValueError as exc:
        _cleanup(src_path, out_path)
        return _err(str(exc))
    except Exception as exc:
        _cleanup(src_path, out_path)
        return _err(f"Embedding failed: {exc}")
    finally:
        _cleanup(src_path)


@stego_bp.route("/extract", methods=["POST"])
def extract():
    """Extract the hidden message from a stego media file."""
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
    """Estimate embedding capacity in characters without a file upload."""
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


# ── Master send pipeline ──────────────────────────────────────────────────────

@stego_bp.route("/send", methods=["POST"])
def send():
    """
    Full send pipeline:
      embed → encrypt → IPFS upload → blockchain register → Shamir split → MongoDB save
    """
    if "file" not in request.files:
        return _err("No file uploaded")

    file             = request.files["file"]
    message          = request.form.get("message", "").strip()
    file_type        = request.form.get("file_type", "image").strip().lower()
    sender_id        = request.form.get("sender_id", "anonymous")
    receiver_id      = request.form.get("receiver_id", "anonymous")
    receiver_eth     = request.form.get("receiver_eth_address", "")
    k                = int(request.form.get("k", 3))
    n                = int(request.form.get("n", 5))
    owner_ids_raw    = request.form.get("owner_ids", "")
    owner_ids        = [x.strip() for x in owner_ids_raw.split(",") if x.strip()] \
                       if owner_ids_raw else [f"owner_{i+1}" for i in range(n)]

    if not message:
        return _err("message is required")
    if file_type not in ("image", "audio"):
        return _err("file_type must be 'image' or 'audio'")
    if len(owner_ids) != n:
        owner_ids = [f"owner_{i+1}" for i in range(n)]

    session_id = str(uuid.uuid4())
    suffix     = os.path.splitext(file.filename)[1] or ".png"
    src_path   = _tmp(suffix)
    stego_path = _tmp(suffix)
    enc_path   = _tmp(".bin")

    txn = Transaction(
        sender_id         = sender_id,
        receiver_id       = receiver_id,
        sender_eth        = Config.PRIVATE_KEY[:20] if Config.PRIVATE_KEY else "",
        receiver_eth      = receiver_eth,
        file_type         = file_type,
        original_filename = file.filename,
        k                 = k,
        n                 = n,
        session_id        = session_id,
        status            = "pending",
    )

    step = "save_upload"
    try:
        file.save(src_path)

        # Step 1 — Generate AES key
        step = "generate_aes_key"
        aes_key = generate_aes_key()

        # Step 2 — Embed message
        step = "embed"
        if file_type == "image":
            embed_message_in_image(src_path, message, stego_path)
        else:
            if not _AUDIO_AVAILABLE:
                raise RuntimeError("Audio steganography module not available")
            embed_message_in_audio(src_path, message, stego_path)

        # Step 3 — AES encrypt stego file
        step = "encrypt"
        enc_meta = encrypt_file(stego_path, aes_key, enc_path)
        txn.nonce = enc_meta["nonce"]
        txn.tag   = enc_meta["tag"]

        # Step 4 — Upload to IPFS
        step = "ipfs_upload"
        ipfs_meta = build_ipfs_metadata(session_id, sender_id, receiver_id, file_type)
        upload_result = upload_file_to_ipfs(
            enc_path,
            Config.PINATA_API_KEY,
            Config.PINATA_SECRET_KEY,
            metadata=ipfs_meta,
        )
        txn.ipfs_cid         = upload_result["cid"]
        txn.ipfs_gateway_url = upload_result["gateway_url"]

        # Step 5 — Build Merkle tree & register on blockchain
        step = "blockchain"
        merkle = build_merkle_tree([txn.ipfs_cid])
        txn.merkle_root = merkle["root"]

        bc_result = _try_register_blockchain(
            txn.ipfs_cid, receiver_eth, session_id, txn.merkle_root
        )
        txn.blockchain_record_id = bc_result.get("record_id", -1)
        txn.tx_hash              = bc_result.get("tx_hash", "")
        txn.block_number         = bc_result.get("block_number", -1)

        # Step 6 — Shamir split
        step = "shamir_split"
        shares = split_secret(aes_key, k, n)
        db = _get_db()
        for i, share in enumerate(shares):
            ks = KeyShare(
                share_index = share["share_index"],
                share_data  = share["share_data"],
                k           = k,
                n           = n,
                checksum    = share["checksum"],
                owner_id    = owner_ids[i],
                session_id  = session_id,
            )
            db["keyshares"].insert_one(ks.to_dict())

        # Step 7 — Save Transaction
        step = "save_transaction"
        txn.status       = "complete"
        txn.completed_at = datetime.now(timezone.utc).isoformat()
        db["transactions"].insert_one(txn.to_dict())

        return _ok({
            "session_id":          session_id,
            "ipfs_cid":            txn.ipfs_cid,
            "gateway_url":         txn.ipfs_gateway_url,
            "blockchain_record_id": txn.blockchain_record_id,
            "tx_hash":             txn.tx_hash,
            "merkle_root":         txn.merkle_root,
            "shares_created":      n,
            "k":                   k,
            "n":                   n,
            "message":             "Message sent successfully",
        })

    except Exception as exc:
        txn.status = "failed"
        try:
            _get_db()["transactions"].insert_one(txn.to_dict())
        except Exception:
            pass
        return jsonify({"error": f"Step '{step}' failed: {exc}", "step": step, "status": 500}), 500
    finally:
        _cleanup(src_path, stego_path, enc_path)


# ── Master receive pipeline ───────────────────────────────────────────────────

@stego_bp.route("/receive", methods=["POST"])
def receive():
    """
    Full receive pipeline:
      MongoDB fetch → blockchain verify → share reconstruct → IPFS retrieve → decrypt → extract
    """
    data       = request.get_json(force=True) or {}
    session_id = data.get("session_id", "")
    owner_ids  = data.get("owner_ids", [])
    file_type  = data.get("file_type", "image")

    if not session_id:
        return _err("session_id is required")
    if not owner_ids:
        return _err("owner_ids list is required")

    db = _get_db()

    # Fetch Transaction
    txn_doc = db["transactions"].find_one({"session_id": session_id})
    if not txn_doc:
        return _err(f"No transaction found for session_id {session_id}", 404)
    txn = Transaction.from_dict(txn_doc)

    # Verify blockchain record
    bc_active = _try_verify_blockchain(
        txn.blockchain_record_id, txn.ipfs_cid, txn.merkle_root
    )
    if not bc_active:
        return jsonify({"error": "Blockchain record is revoked or inactive", "status": 403}), 403

    # Fetch shares
    share_docs = list(db["keyshares"].find(
        {"session_id": session_id, "owner_id": {"$in": owner_ids}}
    ))
    if len(share_docs) < txn.k:
        return _err(
            f"Insufficient shares: need {txn.k}, got {len(share_docs)}", 400
        )

    enc_path  = _tmp(".bin")
    dec_path  = _tmp(".png" if file_type == "image" else ".wav")

    try:
        # Reconstruct AES key
        raw_shares = [KeyShare.from_dict(d).to_share_dict() for d in share_docs]
        aes_key    = reconstruct_secret(raw_shares[:txn.k])

        # Retrieve encrypted file from IPFS
        enc_bytes = retrieve_from_ipfs(txn.ipfs_cid)
        with open(enc_path, "wb") as fh:
            fh.write(enc_bytes)

        # Decrypt
        decrypt_file(enc_path, aes_key, txn.nonce, txn.tag, dec_path)

        # Extract message
        if file_type == "image":
            message = extract_message_from_image(dec_path)
        else:
            if not _AUDIO_AVAILABLE:
                raise RuntimeError("Audio steganography module not available")
            message = extract_message_from_audio(dec_path)

        return _ok({
            "session_id":          session_id,
            "message":             message,
            "file_type":           file_type,
            "blockchain_verified": bc_active,
            "sender_id":           txn.sender_id,
        })

    except ValueError as exc:
        return _err(str(exc), 400)
    except Exception as exc:
        return _err(f"Receive pipeline failed: {exc}", 500)
    finally:
        _cleanup(enc_path, dec_path)


# ── Private blockchain helpers ────────────────────────────────────────────────

def _try_register_blockchain(cid: str, receiver_eth: str, session_id: str, merkle_root: str) -> dict:
    """Attempt blockchain registration; returns empty dict on failure (non-fatal)."""
    try:
        from web3 import Web3
        w3       = get_web3_connection(Config.GANACHE_URL)
        abi      = _load_abi()
        contract = load_contract(w3, Config.CONTRACT_ADDRESS, abi)
        result   = register_record(
            w3, contract, Config.PRIVATE_KEY,
            cid, receiver_eth, session_id, merkle_root
        )
        return result
    except Exception:
        return {"record_id": -1, "tx_hash": "", "block_number": -1, "gas_used": 0}


def _try_verify_blockchain(record_id: int, cid: str, merkle_root: str) -> bool:
    """Attempt on-chain verification; returns True on any failure (fail-open)."""
    if record_id < 0:
        return True   # never registered → treat as active
    try:
        from web3 import Web3
        w3       = get_web3_connection(Config.GANACHE_URL)
        abi      = _load_abi()
        contract = load_contract(w3, Config.CONTRACT_ADDRESS, abi)
        return verify_record(w3, contract, record_id, cid, merkle_root)
    except Exception:
        return True   # fail-open: if chain unreachable, don't block decryption
