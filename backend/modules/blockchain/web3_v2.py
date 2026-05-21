"""
web3_v2.py — StegoChainV2 Python Client
=========================================
All interaction with the deployed StegoChainV2 smart contract on Ethereum Sepolia.

Key differences from web3_client.py (V1):
  - Targets StegoChainV2 contract (registerUser, registerRecord, requestDecryption)
  - AES key fragment splitting / Merkle tree (not Shamir)
  - ECDSA challenge signing via eth_account
  - wait_for_decryption_event polls for DecryptionAuthorised
"""

import base64
import json
import math
import os
import time
from typing import Optional

from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct


# ── Path helper ───────────────────────────────────────────────────────────────

def _deployment_path() -> str:
    this_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(
        os.path.join(this_dir, "..", "..", "..", "blockchain", "artifacts", "deployment.json")
    )


# ── Minimal ABI (fallback when deployment.json is absent) ─────────────────────

MINIMAL_ABI_V2 = [
    {"inputs": [], "stateMutability": "nonpayable", "type": "constructor"},
    # Events
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "user",      "type": "address"},
            {"indexed": False, "name": "timestamp",  "type": "uint256"},
        ],
        "name": "UserRegistered", "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "recordId",   "type": "uint256"},
            {"indexed": True,  "name": "sender",     "type": "address"},
            {"indexed": True,  "name": "receiver",   "type": "address"},
            {"indexed": False, "name": "sessionId",  "type": "string"},
            {"indexed": False, "name": "merkleRoot", "type": "bytes32"},
            {"indexed": False, "name": "timestamp",  "type": "uint256"},
        ],
        "name": "RecordRegistered", "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "recordId",  "type": "uint256"},
            {"indexed": True,  "name": "receiver",  "type": "address"},
            {"indexed": False, "name": "timestamp", "type": "uint256"},
        ],
        "name": "DecryptionAuthorised", "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "recordId",  "type": "uint256"},
            {"indexed": True,  "name": "revokedBy", "type": "address"},
            {"indexed": False, "name": "timestamp", "type": "uint256"},
        ],
        "name": "RecordRevoked", "type": "event",
    },
    # registerUser
    {
        "inputs": [
            {"name": "publicKeyX", "type": "bytes"},
            {"name": "publicKeyY", "type": "bytes"},
        ],
        "name": "registerUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # getUser
    {
        "inputs": [{"name": "userAddress", "type": "address"}],
        "name": "getUser",
        "outputs": [
            {
                "components": [
                    {"name": "ethAddress",   "type": "address"},
                    {"name": "publicKeyX",   "type": "bytes"},
                    {"name": "publicKeyY",   "type": "bytes"},
                    {"name": "isRegistered", "type": "bool"},
                    {"name": "registeredAt", "type": "uint256"},
                ],
                "name": "", "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # registerRecord
    {
        "inputs": [
            {"name": "ipfsCID",        "type": "string"},
            {"name": "fragmentCIDs",   "type": "string[]"},
            {"name": "receiver",       "type": "address"},
            {"name": "sessionId",      "type": "string"},
            {"name": "merkleRoot",     "type": "bytes32"},
            {"name": "mediaHash",      "type": "bytes32"},
            {"name": "totalFragments", "type": "uint8"},
        ],
        "name": "registerRecord",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # requestDecryption
    {
        "inputs": [
            {"name": "recordId",      "type": "uint256"},
            {"name": "merkleProof",   "type": "bytes32[]"},
            {"name": "leafHash",      "type": "bytes32"},
            {"name": "signature",     "type": "bytes"},
            {"name": "challengeHash", "type": "bytes32"},
        ],
        "name": "requestDecryption",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # verifyMerkleProof
    {
        "inputs": [
            {"name": "proof", "type": "bytes32[]"},
            {"name": "root",  "type": "bytes32"},
            {"name": "leaf",  "type": "bytes32"},
        ],
        "name": "verifyMerkleProof",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "pure",
        "type": "function",
    },
    # getRecord
    {
        "inputs": [{"name": "recordId", "type": "uint256"}],
        "name": "getRecord",
        "outputs": [
            {
                "components": [
                    {"name": "recordId",       "type": "uint256"},
                    {"name": "ipfsCID",        "type": "string"},
                    {"name": "fragmentCIDs",   "type": "string[]"},
                    {"name": "sender",         "type": "address"},
                    {"name": "receiver",       "type": "address"},
                    {"name": "sessionId",      "type": "string"},
                    {"name": "merkleRoot",     "type": "bytes32"},
                    {"name": "mediaHash",      "type": "bytes32"},
                    {"name": "timestamp",      "type": "uint256"},
                    {"name": "isActive",       "type": "bool"},
                    {"name": "totalFragments", "type": "uint8"},
                ],
                "name": "", "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # getRecordBySession
    {
        "inputs": [{"name": "sessionId", "type": "string"}],
        "name": "getRecordBySession",
        "outputs": [
            {
                "components": [
                    {"name": "recordId",       "type": "uint256"},
                    {"name": "ipfsCID",        "type": "string"},
                    {"name": "fragmentCIDs",   "type": "string[]"},
                    {"name": "sender",         "type": "address"},
                    {"name": "receiver",       "type": "address"},
                    {"name": "sessionId",      "type": "string"},
                    {"name": "merkleRoot",     "type": "bytes32"},
                    {"name": "mediaHash",      "type": "bytes32"},
                    {"name": "timestamp",      "type": "uint256"},
                    {"name": "isActive",       "type": "bool"},
                    {"name": "totalFragments", "type": "uint8"},
                ],
                "name": "", "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # getReceiverRecords
    {
        "inputs": [{"name": "receiver", "type": "address"}],
        "name": "getReceiverRecords",
        "outputs": [{"name": "", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    # getSenderRecords
    {
        "inputs": [{"name": "sender", "type": "address"}],
        "name": "getSenderRecords",
        "outputs": [{"name": "", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    # revokeRecord
    {
        "inputs": [{"name": "recordId", "type": "uint256"}],
        "name": "revokeRecord",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # verifyMediaIntegrity
    {
        "inputs": [
            {"name": "recordId",  "type": "uint256"},
            {"name": "mediaHash", "type": "bytes32"},
        ],
        "name": "verifyMediaIntegrity",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    # getContractStats
    {
        "inputs": [],
        "name": "getContractStats",
        "outputs": [
            {"name": "totalRecords",   "type": "uint256"},
            {"name": "totalUsers",     "type": "uint256"},
            {"name": "contractOwner",  "type": "address"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # recordCount / userCount / owner
    {"inputs": [], "name": "recordCount", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "userCount",   "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "owner",       "outputs": [{"name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
]


# ── Connection ─────────────────────────────────────────────────────────────────

def _is_connected(w3: Web3) -> bool:
    try:
        if w3.is_connected():
            return True
    except Exception:
        pass
    try:
        w3.eth.block_number
        return True
    except Exception:
        return False

def get_v2_connection() -> Web3:
    """
    Connect to BASE_SEPOLIA_RPC_URL from environment, fall back to localhost:8545.
    Raises ConnectionError if unreachable.
    """
    rpc_url = os.environ.get("BASE_SEPOLIA_RPC_URL", "http://127.0.0.1:8545")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not _is_connected(w3):
        # Try localhost fallback
        w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
        if not _is_connected(w3):
            raise ConnectionError(
                f"Cannot connect to Ethereum node at {rpc_url} or localhost:8545"
            )
    return w3


def load_v2_contract(w3: Web3):
    """
    Load StegoChainV2 contract from deployment.json, falling back to MINIMAL_ABI_V2.
    Returns contract instance at CONTRACT_ADDRESS.
    """
    dep_path = _deployment_path()
    abi = MINIMAL_ABI_V2
    address = os.environ.get("CONTRACT_ADDRESS", "")

    if os.path.exists(dep_path):
        with open(dep_path, "r") as fh:
            data = json.load(fh)
        if data.get("abi"):
            abi = data["abi"]
        if not address and data.get("address"):
            address = data["address"]

    if not address:
        raise ValueError("CONTRACT_ADDRESS not set in environment or deployment.json")

    checksum = Web3.to_checksum_address(address)
    return w3.eth.contract(address=checksum, abi=abi)


# ── Transaction helpers ────────────────────────────────────────────────────────

def _send_tx(w3: Web3, tx_fn, private_key: str, gas: int = 400_000) -> dict:
    """Build, sign, send a transaction and wait for receipt."""
    account = Account.from_key(private_key)
    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = int(w3.eth.gas_price * 2.0)
    tx = tx_fn.build_transaction({
        "from":     account.address,
        "nonce":    nonce,
        "gas":      gas,
        "gasPrice": gas_price,
    })
    signed = w3.eth.account.sign_transaction(tx, private_key=private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return receipt


def _hex32(hex_str: str) -> bytes:
    """Convert 0x-prefixed hex string to 32 raw bytes."""
    return bytes.fromhex(hex_str.lstrip("0x").zfill(64))


def _parse_record(rec) -> dict:
    """Convert contract tuple to dict."""
    return {
        "record_id":       rec[0],
        "ipfs_cid":        rec[1],
        "fragment_cids":   list(rec[2]),
        "sender":          rec[3],
        "receiver":        rec[4],
        "session_id":      rec[5],
        "merkle_root":     "0x" + bytes(rec[6]).hex(),
        "media_hash":      "0x" + bytes(rec[7]).hex(),
        "timestamp":       rec[8],
        "is_active":       rec[9],
        "total_fragments": rec[10],
    }


# ── User functions ─────────────────────────────────────────────────────────────

def register_user_on_chain(
    w3: Web3, contract, private_key: str,
    public_key_x: bytes, public_key_y: bytes,
) -> dict:
    """
    Call registerUser(publicKeyX, publicKeyY) on-chain.
    Returns { tx_hash, block_number, gas_used }.
    """
    tx_fn = contract.functions.registerUser(public_key_x, public_key_y)
    receipt = _send_tx(w3, tx_fn, private_key, gas=200_000)
    return {
        "tx_hash":      receipt["transactionHash"].hex(),
        "block_number": receipt["blockNumber"],
        "gas_used":     receipt["gasUsed"],
    }


def get_user_profile(w3: Web3, contract, address: str) -> dict:
    """Call getUser() and return a clean dict."""
    u = contract.functions.getUser(Web3.to_checksum_address(address)).call()
    return {
        "eth_address":   u[0],
        "public_key_x":  u[1].hex() if u[1] else "",
        "public_key_y":  u[2].hex() if u[2] else "",
        "is_registered": u[3],
        "registered_at": u[4],
    }


# ── Record functions ───────────────────────────────────────────────────────────

def register_record_on_chain(
    w3: Web3, contract, private_key: str,
    ipfs_cid: str, fragment_cids: list,
    receiver_address: str, session_id: str,
    merkle_root: str, media_hash: str,
    total_fragments: int,
) -> dict:
    """
    Call registerRecord(...) on-chain.
    Returns { tx_hash, record_id, block_number, gas_used }.
    """
    merkle_b32 = _hex32(merkle_root)
    media_b32  = _hex32(media_hash)
    receiver   = Web3.to_checksum_address(receiver_address)

    tx_fn = contract.functions.registerRecord(
        ipfs_cid, fragment_cids, receiver,
        session_id, merkle_b32, media_b32, total_fragments,
    )
    receipt = _send_tx(w3, tx_fn, private_key, gas=1_500_000)

    # Extract recordId from event
    record_id = _extract_record_id(contract, receipt)

    return {
        "tx_hash":      receipt["transactionHash"].hex(),
        "record_id":    record_id,
        "block_number": receipt["blockNumber"],
        "gas_used":     receipt["gasUsed"],
    }


def _extract_record_id(contract, receipt) -> int:
    try:
        logs = contract.events.RecordRegistered().process_receipt(receipt)
        if logs:
            return logs[0]["args"]["recordId"]
    except Exception:
        pass
    return contract.functions.recordCount().call()


def request_decryption_on_chain(
    w3: Web3, contract, private_key: str,
    record_id: int, merkle_proof: list,
    leaf_hash: str, signature: str, challenge_hash: str,
) -> dict:
    """
    Call requestDecryption(...) on-chain.
    Returns { tx_hash, authorised: bool, record_id, block_number }.
    """
    proof_b32 = [_hex32(p) for p in merkle_proof]
    leaf_b32  = _hex32(leaf_hash)
    ch_b32    = _hex32(challenge_hash)
    sig_bytes = bytes.fromhex(signature.lstrip("0x"))

    tx_fn = contract.functions.requestDecryption(
        record_id, proof_b32, leaf_b32, sig_bytes, ch_b32
    )
    receipt = _send_tx(w3, tx_fn, private_key, gas=800_000)

    # Check for DecryptionAuthorised event
    authorised = False
    try:
        logs = contract.events.DecryptionAuthorised().process_receipt(receipt)
        authorised = len(logs) > 0
    except Exception:
        pass

    return {
        "tx_hash":      receipt["transactionHash"].hex(),
        "authorised":   authorised,
        "record_id":    record_id,
        "block_number": receipt["blockNumber"],
    }


def wait_for_decryption_event(
    w3: Web3, contract, record_id: int, timeout_seconds: int = 60
) -> dict:
    """
    Poll for DecryptionAuthorised event for given record_id.
    Polls every 2 seconds up to timeout_seconds.
    Returns { authorised: bool, timestamp } or raises TimeoutError.
    """
    start = time.time()
    event_filter = contract.events.DecryptionAuthorised.create_filter(
        fromBlock="latest",
        argument_filters={"recordId": record_id},
    )
    while time.time() - start < timeout_seconds:
        entries = event_filter.get_new_entries()
        for entry in entries:
            if entry["args"]["recordId"] == record_id:
                return {
                    "authorised": True,
                    "timestamp":  entry["args"]["timestamp"],
                }
        time.sleep(2)
    raise TimeoutError(
        f"DecryptionAuthorised event not received for record_id={record_id} "
        f"within {timeout_seconds}s"
    )


def get_record_v2(w3: Web3, contract, record_id: int) -> dict:
    """Fetch a StegoRecord by recordId."""
    rec = contract.functions.getRecord(record_id).call()
    return _parse_record(rec)


def get_record_by_session(w3: Web3, contract, session_id: str) -> dict:
    """Fetch a StegoRecord by session ID."""
    rec = contract.functions.getRecordBySession(session_id).call()
    return _parse_record(rec)


def verify_media_integrity(w3: Web3, contract, record_id: int, media_hash: str) -> bool:
    """Call verifyMediaIntegrity on-chain."""
    media_b32 = _hex32(media_hash)
    return contract.functions.verifyMediaIntegrity(record_id, media_b32).call()


def verify_merkle_proof_v2(
    w3: Web3, contract, proof: list, root: str, leaf: str
) -> bool:
    """Call verifyMerkleProof on-chain."""
    proof_b32 = [_hex32(p) for p in proof]
    return contract.functions.verifyMerkleProof(
        proof_b32, _hex32(root), _hex32(leaf)
    ).call()


def revoke_record_v2(w3: Web3, contract, private_key: str, record_id: int) -> dict:
    """Call revokeRecord on-chain."""
    tx_fn = contract.functions.revokeRecord(record_id)
    receipt = _send_tx(w3, tx_fn, private_key, gas=100_000)
    return {
        "tx_hash":      receipt["transactionHash"].hex(),
        "block_number": receipt["blockNumber"],
        "gas_used":     receipt["gasUsed"],
    }


def get_contract_stats_v2(w3: Web3, contract) -> dict:
    """Call getContractStats()."""
    total_records, total_users, contract_owner = contract.functions.getContractStats().call()
    return {
        "total_records":   total_records,
        "total_users":     total_users,
        "contract_owner":  contract_owner,
    }


# ── Merkle tree for AES key fragments ─────────────────────────────────────────

def _keccak(data: bytes) -> bytes:
    # Wrap in bytes() so .hex() returns plain hex without '0x' prefix
    # (hexbytes >= 1.0.0 changed HexBytes.hex() to include '0x')
    return bytes(Web3.keccak(data))


def _hash_pair_sorted(a: bytes, b: bytes) -> bytes:
    return _keccak(a + b) if a <= b else _keccak(b + a)


def build_fragment_merkle_tree(fragments: list) -> dict:
    """
    Build Merkle tree from raw byte fragments.
    Each leaf = keccak256(fragment_bytes).
    Uses sorted-pair hashing to match Solidity verifyMerkleProof.

    Returns { root: '0x...', leaves: ['0x...'], tree: [[level0], [level1], ...] }
    """
    if not fragments:
        raise ValueError("fragments list cannot be empty")

    leaves = [_keccak(f) for f in fragments]
    layer  = leaves[:]

    # Pad to power of two
    while len(layer) & (len(layer) - 1):
        layer.append(layer[-1])

    all_layers = [layer[:]]
    while len(layer) > 1:
        next_layer = []
        for i in range(0, len(layer), 2):
            next_layer.append(_hash_pair_sorted(layer[i], layer[i + 1]))
        layer = next_layer
        all_layers.append(layer[:])

    root = "0x" + layer[0].hex()
    return {
        "root":   root,
        "leaves": ["0x" + lf.hex() for lf in leaves],
        "tree":   [["0x" + n.hex() for n in lvl] for lvl in all_layers],
    }


def get_fragment_merkle_proof(fragments: list, target_index: int) -> list:
    """
    Return Merkle proof (list of sibling hashes) for fragment at target_index.
    """
    raw_leaves = [_keccak(f) for f in fragments]
    layer = raw_leaves[:]

    # Pad to power of two
    while len(layer) & (len(layer) - 1):
        layer.append(layer[-1])

    proof = []
    idx   = target_index
    while len(layer) > 1:
        sibling_idx = idx ^ 1   # XOR flips last bit → sibling
        if sibling_idx < len(layer):
            proof.append("0x" + layer[sibling_idx].hex())
        next_layer = []
        for i in range(0, len(layer), 2):
            next_layer.append(_hash_pair_sorted(layer[i], layer[i + 1]))
        layer = next_layer
        idx   = idx >> 1

    return proof


# ── AES key fragment helpers ───────────────────────────────────────────────────

def split_aes_key_to_fragments(aes_key: bytes, n: int) -> list:
    """
    Split a 32-byte AES key into n equal fragments.
    The last fragment is zero-padded if needed.
    Returns list of n bytes objects.
    """
    if len(aes_key) != 32:
        raise ValueError(f"AES key must be 32 bytes, got {len(aes_key)}")
    if n < 1 or n > 32:
        raise ValueError(f"n must be 1-32, got {n}")

    frag_size = math.ceil(32 / n)
    fragments = []
    for i in range(n):
        start = i * frag_size
        end   = start + frag_size
        chunk = aes_key[start:end]
        # Pad last fragment with zeros if short
        if len(chunk) < frag_size:
            chunk = chunk + b"\x00" * (frag_size - len(chunk))
        fragments.append(chunk)
    return fragments


def reconstruct_aes_key_from_fragments(fragments: list) -> bytes:
    """
    Concatenate fragments and trim/pad to exactly 32 bytes.
    Returns 32-byte AES key.
    """
    raw = b"".join(fragments)
    if len(raw) < 32:
        raw = raw + b"\x00" * (32 - len(raw))
    return raw[:32]


# ── ECDSA signing ──────────────────────────────────────────────────────────────

def sign_challenge(private_key_hex: str, challenge: str) -> dict:
    """
    Sign a challenge string using eth_account (MetaMask-compatible).
    The challenge is hashed with keccak256 then signed with the Ethereum prefix.

    Returns { signature, challenge_hash, v, r, s }.
    """
    challenge_bytes = challenge.encode("utf-8")
    challenge_hash  = Web3.keccak(challenge_bytes)

    # Encode with Ethereum signed message prefix (\x19Ethereum Signed Message:\n32)
    msg     = encode_defunct(challenge_hash)
    account = Account.from_key(private_key_hex)
    signed  = account.sign_message(msg)

    return {
        "signature":      signed.signature.hex(),
        "challenge_hash": challenge_hash.hex(),
        "v":              signed.v,
        "r":              hex(signed.r),
        "s":              hex(signed.s),
    }
