"""
deploy_contract.py
==================
Deploys StegoChain.sol to a running Ganache instance and saves the
contract address so the Flask backend can pick it up.

Usage
-----
    python scripts/deploy_contract.py

Environment variables
---------------------
    GANACHE_URL   — defaults to http://127.0.0.1:7545
    PRIVATE_KEY   — optional; if omitted, uses Ganache unlocked account[0]

Outputs
-------
    blockchain/artifacts/deployment.json  — { address, abi, tx_hash }
    Prints: export CONTRACT_ADDRESS=0x...
    Exits 0 on success, 1 on failure.
"""

import json
import os
import sys
import time

from web3 import Web3

try:
    from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware
except ImportError:
    from web3.middleware import geth_poa_middleware


# ── Helpers ───────────────────────────────────────────────────────────────────

def wait_for_ganache(url: str, max_retries: int = 30, delay: float = 2.0) -> Web3:
    """
    Poll the Ethereum node (Hardhat or Ganache) until it responds.
    Works with:
      - Hardhat node:  npx hardhat node --port 7545  (chainId 31337)
      - Ganache v7:    npx ganache --server.port 7545 --wallet.deterministic (chainId 1337)

    Returns
    -------
    web3.Web3 instance connected to the node.
    """
    for attempt in range(1, max_retries + 1):
        try:
            w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 3}))
            if w3.is_connected():
                chain_id = w3.eth.chain_id
                print(f"[deploy] Node connected after {attempt} attempt(s). chainId={chain_id}")
                return w3
        except Exception:
            pass
        print(f"[deploy] Waiting for Ganache ({attempt}/{max_retries})...")
        time.sleep(delay)

    print(f"[deploy] ERROR: No Ethereum node at {url} after {max_retries} retries.")
    print()
    print("  Start a local node in another terminal:")
    print("    Option A (Hardhat — recommended):")
    print("      cd stegochain/blockchain")
    print("      npx hardhat node --port 7545")
    print("    Option B (Ganache v7 — fixed syntax):")
    print("      npx ganache --server.port 7545 --wallet.deterministic")
    sys.exit(1)


def load_abi_and_bytecode(artifact_path: str) -> tuple:
    """
    Load compiled ABI and bytecode from a Hardhat artifact JSON.

    Parameters
    ----------
    artifact_path : str
        Path to <Contract>.json produced by `hardhat compile`.

    Returns
    -------
    (abi, bytecode) tuple.

    Raises
    ------
    SystemExit(1) if file is missing or malformed.
    """
    if not os.path.exists(artifact_path):
        print(f"[deploy] ERROR: Artifact not found: {artifact_path}")
        print("[deploy] Run `npx hardhat compile` in the blockchain/ directory first.")
        sys.exit(1)

    try:
        with open(artifact_path, "r", encoding="utf-8") as fh:
            artifact = json.load(fh)
        abi      = artifact["abi"]
        bytecode = artifact["bytecode"]
        if not abi or not bytecode:
            raise ValueError("ABI or bytecode is empty")
        print(f"[deploy] Loaded ABI ({len(abi)} entries) from {os.path.basename(artifact_path)}")
        return abi, bytecode
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"[deploy] ERROR loading artifact: {exc}")
        sys.exit(1)


def deploy_contract(
    w3: Web3,
    abi: list,
    bytecode: str,
    deployer_account: str,
    private_key: str | None,
) -> tuple:
    """
    Deploy the StegoChain contract.

    Supports two modes:
    - private_key provided → sign and send raw transaction
    - private_key is None → use w3.eth.send_transaction (Ganache unlocked account)

    Returns
    -------
    (contract_address: str, tx_hash: str)

    Raises
    ------
    SystemExit(1) on deployment failure.
    """
    try:
        contract = w3.eth.contract(abi=abi, bytecode=bytecode)

        if private_key:
            # Build and sign raw transaction
            nonce     = w3.eth.get_transaction_count(deployer_account)
            gas_price = w3.eth.gas_price
            tx        = contract.constructor().build_transaction({
                "from":     deployer_account,
                "nonce":    nonce,
                "gas":      3_000_000,
                "gasPrice": gas_price,
            })
            signed  = w3.eth.account.sign_transaction(tx, private_key=private_key)
            # web3.py v6 uses raw_transaction; v5 used rawTransaction
            raw_tx  = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
            tx_hash = w3.eth.send_raw_transaction(raw_tx)
        else:
            # Ganache unlocked account — no signing needed
            tx_hash = contract.constructor().transact({
                "from": deployer_account,
                "gas":  3_000_000,
            })

        print("[deploy] Waiting for deployment receipt...")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt.status != 1:
            print("[deploy] ERROR: Deployment transaction reverted.")
            sys.exit(1)

        address = receipt.contractAddress
        tx_hash_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
        return address, tx_hash_hex

    except Exception as exc:
        print(f"[deploy] ERROR during deployment: {exc}")
        sys.exit(1)


def save_deployment(address: str, abi: list, artifact_dir: str) -> None:
    """
    Persist deployment.json and print the export command.

    File format
    -----------
    {
        "address": "0x...",
        "abi": [...],
        "tx_hash": "0x...",
        "deployed_at": "<ISO timestamp>"
    }
    """
    import datetime
    os.makedirs(artifact_dir, exist_ok=True)
    out_path = os.path.join(artifact_dir, "deployment.json")

    record = {
        "address":     address,
        "abi":         abi,
        "deployed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(record, fh, indent=2)

    print(f"[deploy] Saved deployment.json -> {out_path}")
    print(f"\n  export CONTRACT_ADDRESS={address}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    ganache_url  = os.environ.get("GANACHE_URL", "http://127.0.0.1:7545")
    private_key  = os.environ.get("PRIVATE_KEY")

    _script_dir   = os.path.dirname(os.path.abspath(__file__))
    artifact_path = os.path.join(
        _script_dir, "..", "blockchain", "artifacts",
        "contracts", "StegoChain.sol", "StegoChain.json"
    )
    artifact_dir  = os.path.join(_script_dir, "..", "blockchain", "artifacts")

    print(f"[deploy] Ganache URL : {ganache_url}")
    print(f"[deploy] Artifact    : {os.path.normpath(artifact_path)}")
    print("[deploy] Waiting for Ganache...")

    w3 = wait_for_ganache(ganache_url)

    if private_key:
        try:
            account = w3.eth.account.from_key(private_key).address
        except Exception as exc:
            print(f"[deploy] Invalid PRIVATE_KEY: {exc}")
            sys.exit(1)
        print(f"[deploy] Deploying from (private key): {account}")
    else:
        accounts = w3.eth.accounts
        if not accounts:
            print("[deploy] ERROR: No unlocked accounts available in Ganache.")
            sys.exit(1)
        account     = accounts[0]
        private_key = None
        print(f"[deploy] No PRIVATE_KEY set — using Ganache account[0]: {account}")

    abi, bytecode = load_abi_and_bytecode(artifact_path)
    address, tx_hash = deploy_contract(w3, abi, bytecode, account, private_key)

    print(f"[deploy] Contract deployed at : {address}")
    print(f"[deploy] Transaction hash     : {tx_hash}")

    save_deployment(address, abi, artifact_dir)

    print("\n[deploy] Add this to your .env or pass as Docker env var:")
    print(f"  CONTRACT_ADDRESS={address}")
    print("\n[deploy] Done. Exit 0.")


if __name__ == "__main__":
    main()
