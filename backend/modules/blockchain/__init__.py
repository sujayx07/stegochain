from .web3_client import (
    get_web3_connection,
    load_contract,
    build_merkle_tree,
    get_merkle_proof,
    register_record,
    get_record,
    get_record_by_cid,
    verify_record,
    verify_merkle_proof_on_chain,
    get_contract_stats,
    revoke_record,
)

__all__ = [
    "get_web3_connection",
    "load_contract",
    "build_merkle_tree",
    "get_merkle_proof",
    "register_record",
    "get_record",
    "get_record_by_cid",
    "verify_record",
    "verify_merkle_proof_on_chain",
    "get_contract_stats",
    "revoke_record",
]
