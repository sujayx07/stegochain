"""
IPFS Routes
============
Blueprint: ipfs_bp    prefix: /api/ipfs
"""
import io
import os
import tempfile
import uuid

from flask import Blueprint, current_app, jsonify, request, send_file

from modules.ipfs.pinata import (
    build_ipfs_metadata, get_pin_list, pin_exists,
    retrieve_from_ipfs, upload_file_to_ipfs,
)
from config import Config

ipfs_bp = Blueprint("ipfs_bp", __name__)

_TMPDIR = os.path.join(tempfile.gettempdir(), "stegochain")
os.makedirs(_TMPDIR, exist_ok=True)

def _err(msg, code=400): return jsonify({"error": msg, "status": code}), code
def _ok(data):
    data["status"] = 200
    return jsonify(data), 200
def _tmp(suffix=""): return os.path.join(_TMPDIR, f"{uuid.uuid4().hex}{suffix}")
def _cleanup(*paths):
    for p in paths:
        try: os.remove(p)
        except FileNotFoundError: pass


@ipfs_bp.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return _err("No file uploaded")
    file        = request.files["file"]
    session_id  = request.form.get("session_id",  "unknown")
    sender_id   = request.form.get("sender_id",   "unknown")
    receiver_id = request.form.get("receiver_id", "unknown")
    file_type   = request.form.get("file_type",   "image")

    tmp = _tmp(".bin")
    try:
        file.save(tmp)
        meta   = build_ipfs_metadata(session_id, sender_id, receiver_id, file_type)
        result = upload_file_to_ipfs(tmp, Config.PINATA_API_KEY, Config.PINATA_SECRET_KEY, metadata=meta)
        return _ok({
            "cid":         result["cid"],
            "gateway_url": result["gateway_url"],
            "size":        result["size"],
            "timestamp":   result["timestamp"],
        })
    except Exception as e:
        return _err(f"IPFS upload failed: {e}")
    finally:
        _cleanup(tmp)


@ipfs_bp.route("/retrieve/<cid>", methods=["GET"])
def retrieve(cid):
    try:
        content = retrieve_from_ipfs(cid)
        return send_file(
            io.BytesIO(content),
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=f"stegochain_{cid[:16]}.bin",
        )
    except Exception as e:
        return _err(f"IPFS retrieve failed: {e}", 502)


@ipfs_bp.route("/exists/<cid>", methods=["GET"])
def exists(cid):
    result = pin_exists(cid, Config.PINATA_API_KEY, Config.PINATA_SECRET_KEY)
    return _ok({"cid": cid, "exists": result})


@ipfs_bp.route("/list", methods=["GET"])
def list_pins():
    try:
        limit = min(int(request.args.get("limit", 10)), 50)
    except ValueError:
        limit = 10
    pins = get_pin_list(Config.PINATA_API_KEY, Config.PINATA_SECRET_KEY, limit=limit)
    return _ok({"pins": pins, "count": len(pins)})
