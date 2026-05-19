"""
Blockchain Routes
==================
Blueprint: blockchain_bp    prefix: /api/blockchain
"""
from flask import Blueprint, jsonify, request
from config import Config

blockchain_bp = Blueprint("blockchain_bp", __name__)

def _err(msg, code=400): return jsonify({"error": msg, "status": code}), code
def _ok(data):
    data["status"] = 200
    return jsonify(data), 200

def _get_contract():
    """
    Load Web3 connection and contract. Raises ConnectionError if Ganache unreachable.
    Returns (w3, contract).
    """
    from modules.blockchain.web3_client import (
        get_web3_connection, load_contract, _load_abi,
    )
    w3       = get_web3_connection(Config.GANACHE_URL)
    abi      = _load_abi()
    contract = load_contract(w3, Config.CONTRACT_ADDRESS, abi)
    return w3, contract


@blockchain_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True) or {}
    cid              = data.get("cid","")
    receiver_address = data.get("receiver_address","")
    session_id       = data.get("session_id","")
    cids_in_session  = data.get("cids_in_session", [cid])
    if not cid:              return _err("cid is required")
    if not receiver_address: return _err("receiver_address is required")
    if not session_id:       return _err("session_id is required")
    try:
        from modules.blockchain.web3_client import build_merkle_tree, register_record
        w3, contract  = _get_contract()
        merkle        = build_merkle_tree(cids_in_session or [cid])
        result        = register_record(w3, contract, Config.PRIVATE_KEY,
                                        cid, receiver_address, session_id, merkle["root"])
        return _ok({
            "record_id":    result["record_id"],
            "tx_hash":      result["tx_hash"],
            "block_number": result["block_number"],
            "gas_used":     result["gas_used"],
            "merkle_root":  merkle["root"],
        })
    except ConnectionError as e:
        return _err(f"Ganache unreachable: {e}", 503)
    except Exception as e:
        return _err(f"Blockchain register failed: {e}")


@blockchain_bp.route("/record/<int:record_id>", methods=["GET"])
def get_record_by_id(record_id):
    try:
        from modules.blockchain.web3_client import get_record
        w3, contract = _get_contract()
        rec = get_record(w3, contract, record_id)
        return _ok(rec)
    except ConnectionError as e:
        return _err(str(e), 503)
    except Exception as e:
        return _err(str(e))


@blockchain_bp.route("/record/cid/<cid>", methods=["GET"])
def get_record_by_cid(cid):
    try:
        from modules.blockchain.web3_client import get_record_by_cid
        w3, contract = _get_contract()
        rec = get_record_by_cid(w3, contract, cid)
        return _ok(rec)
    except ConnectionError as e:
        return _err(str(e), 503)
    except Exception as e:
        return _err(str(e))


@blockchain_bp.route("/verify", methods=["POST"])
def verify():
    data = request.get_json(force=True) or {}
    record_id   = data.get("record_id", 0)
    cid         = data.get("cid","")
    merkle_root = data.get("merkle_root","")
    if not cid or not merkle_root: return _err("cid and merkle_root are required")
    try:
        from modules.blockchain.web3_client import verify_record
        w3, contract = _get_contract()
        result = verify_record(w3, contract, record_id, cid, merkle_root)
        return _ok({"record_id": record_id, "verified": result})
    except ConnectionError as e:
        return _err(str(e), 503)
    except Exception as e:
        return _err(str(e))


@blockchain_bp.route("/verify-proof", methods=["POST"])
def verify_proof():
    data = request.get_json(force=True) or {}
    cids_in_session = data.get("cids_in_session",[])
    target_cid      = data.get("target_cid","")
    root            = data.get("root","")
    if not cids_in_session or not target_cid or not root:
        return _err("cids_in_session, target_cid and root are required")
    try:
        from modules.blockchain.web3_client import (
            get_merkle_proof, verify_merkle_proof_on_chain,
        )
        w3, contract = _get_contract()
        proof  = get_merkle_proof(cids_in_session, target_cid)
        from modules.blockchain.web3_client import _keccak256_bytes
        leaf   = "0x" + _keccak256_bytes(target_cid.encode()).hex()
        result = verify_merkle_proof_on_chain(w3, contract, proof, root, leaf)
        return _ok({"verified": result, "proof": proof})
    except ConnectionError as e:
        return _err(str(e), 503)
    except Exception as e:
        return _err(str(e))


@blockchain_bp.route("/revoke/<int:record_id>", methods=["POST"])
def revoke(record_id):
    try:
        from modules.blockchain.web3_client import revoke_record
        w3, contract = _get_contract()
        result = revoke_record(w3, contract, Config.PRIVATE_KEY, record_id)
        return _ok({"record_id": record_id, "tx_hash": result["tx_hash"], "revoked": True})
    except ConnectionError as e:
        return _err(str(e), 503)
    except Exception as e:
        return _err(str(e))


@blockchain_bp.route("/stats", methods=["GET"])
def stats():
    try:
        from modules.blockchain.web3_client import get_contract_stats
        w3, contract = _get_contract()
        s = get_contract_stats(w3, contract)
        return _ok({"total_records": s["total_records"], "contract_owner": s["contract_owner"]})
    except ConnectionError as e:
        return _err(str(e), 503)
    except Exception as e:
        return _err(str(e))


@blockchain_bp.route("/sender/<address>", methods=["GET"])
def sender_records(address):
    try:
        from web3 import Web3
        from modules.blockchain.web3_client import _load_abi, load_contract, get_web3_connection
        w3, contract = _get_contract()
        ids = contract.functions.getSenderRecords(Web3.to_checksum_address(address)).call()
        return _ok({"sender": address, "record_ids": list(ids)})
    except ConnectionError as e:
        return _err(str(e), 503)
    except Exception as e:
        return _err(str(e))
