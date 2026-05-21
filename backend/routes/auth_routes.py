"""
Auth Routes
============
Blueprint: auth_bp    prefix: /api/auth

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/auth/user/eth/<eth_address>
POST /api/auth/register-chain
"""
import re

from flask import Blueprint, current_app, g, jsonify, request
from web3 import Web3

from models.user import User
from modules.auth.jwt_handler import generate_token, require_auth

auth_bp = Blueprint("auth_bp", __name__)


def _err(msg, code=400):
    return jsonify({"error": msg, "status": code}), code


def _ok(data):
    data["status"] = 200
    return jsonify(data), 200


def _db():
    return current_app.db


def _is_valid_eth(address: str) -> bool:
    return bool(re.match(r"^0x[0-9a-fA-F]{40}$", address))


def _try_chain_register(user: User) -> dict:
    """Attempt on-chain registerUser. Returns result dict or empty dict on failure."""
    try:
        import os
        from modules.blockchain.web3_v2 import (
            get_v2_connection, load_v2_contract, register_user_on_chain,
        )
        w3       = get_v2_connection()
        contract = load_v2_contract(w3)
        pk_x = bytes.fromhex(user.public_key_x.lstrip("0x"))
        pk_y = bytes.fromhex(user.public_key_y.lstrip("0x"))
        result = register_user_on_chain(
            w3, contract, os.environ.get("PRIVATE_KEY", ""), pk_x, pk_y
        )
        return result
    except Exception as exc:
        return {"error": str(exc)}


# ── POST /api/auth/register ──────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True) or {}

    username      = data.get("username", "").strip()
    email         = data.get("email", "").strip().lower()
    password      = data.get("password", "")
    eth_address   = data.get("eth_address", "").strip()
    public_key_x  = data.get("public_key_x", "").strip()
    public_key_y  = data.get("public_key_y", "").strip()

    # Validation
    for field, val in [("username", username), ("email", email),
                       ("password", password), ("eth_address", eth_address),
                       ("public_key_x", public_key_x), ("public_key_y", public_key_y)]:
        if not val:
            return _err(f"{field} is required")

    if not _is_valid_eth(eth_address):
        return _err("eth_address must be a valid Ethereum address (0x + 40 hex chars)")

    db = _db()

    # Uniqueness checks
    if db[User.COLLECTION].find_one({"email": email}):
        return _err("Email already registered", 409)
    if db[User.COLLECTION].find_one({"eth_address": eth_address.lower()}):
        return _err("Ethereum address already registered", 409)

    # Create user (password hashed inside __init__)
    user = User(
        username=username, email=email, password=password,
        eth_address=eth_address,
        public_key_x=public_key_x, public_key_y=public_key_y,
    )
    db[User.COLLECTION].insert_one(user.to_dict())

    # NOTE: On-chain registration is performed by the frontend via MetaMask.
    # The /register-chain-manual endpoint marks chain_registered=True after
    # the user's MetaMask tx is confirmed.

    token = generate_token(user.user_id, user.eth_address)

    return _ok({
        "user_id":       user.user_id,
        "username":      user.username,
        "eth_address":   user.eth_address,
        "chain_tx_hash": "",
        "token":         token,
    })


# ── POST /api/auth/login ─────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.get_json(force=True) or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return _err("email and password are required")

    db  = _db()
    doc = db[User.COLLECTION].find_one({"email": email})
    if not doc:
        return _err("Invalid credentials", 401)

    user = User.from_dict(doc)

    if not user.verify_password(password):
        return _err("Invalid credentials", 401)

    if not user.is_active:
        return _err("Account is disabled", 403)

    token = generate_token(user.user_id, user.eth_address)
    return _ok({
        "user_id":          user.user_id,
        "username":         user.username,
        "eth_address":      user.eth_address,
        "chain_registered": user.chain_registered,
        "token":            token,
    })


# ── GET /api/auth/me ─────────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
@require_auth
def me():
    doc = _db()[User.COLLECTION].find_one({"user_id": g.user_id})
    if not doc:
        return _err("User not found", 404)
    user = User.from_dict(doc)
    return _ok(user.to_public_profile())


# ── GET /api/auth/user/eth/<eth_address> ─────────────────────────────────────

@auth_bp.route("/user/eth/<eth_address>", methods=["GET"])
def get_by_eth(eth_address):
    """Public — look up user by Ethereum address (for sender to find receiver)."""
    doc = _db()[User.COLLECTION].find_one({"eth_address": eth_address.lower()})
    if not doc:
        return _err(f"No user found for address {eth_address}", 404)
    user = User.from_dict(doc)
    return _ok(user.to_public_profile())


# ── POST /api/auth/register-chain ────────────────────────────────────────────

@auth_bp.route("/register-chain", methods=["POST"])
@require_auth
def register_chain():
    """On-chain registration is now MetaMask-driven from the frontend.
    This endpoint now just checks the current status.
    Use /register-chain-manual after the MetaMask tx is confirmed."""
    db  = _db()
    doc = db[User.COLLECTION].find_one({"user_id": g.user_id})
    if not doc:
        return _err("User not found", 404)

    user = User.from_dict(doc)
    if user.chain_registered:
        return _ok({"message": "Already registered on-chain", "chain_registered": True})

    return _ok({
        "chain_registered": False,
        "message": "Use the dashboard to complete registration via MetaMask, "
                   "then call /register-chain-manual with the tx_hash.",
    })


# ── POST /api/auth/register-chain-manual ─────────────────────────────────────

@auth_bp.route("/register-chain-manual", methods=["POST"])
@require_auth
def register_chain_manual():
    """Called after the frontend sends registerUser() from MetaMask.
    Just marks chain_registered=True in MongoDB with the provided tx_hash."""
    data    = request.get_json(force=True) or {}
    tx_hash = data.get("tx_hash", "")
    db      = _db()
    db[User.COLLECTION].update_one(
        {"user_id": g.user_id},
        {"$set": {"chain_registered": True, "chain_tx_hash": tx_hash}},
    )
    print(f"[CHAIN] User {g.user_id} marked chain_registered via MetaMask tx={tx_hash}")
    return _ok({"chain_registered": True, "chain_tx_hash": tx_hash})
