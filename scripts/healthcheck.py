"""
healthcheck.py
Run before starting backend to verify all external services are reachable.
Usage: python scripts/healthcheck.py
Exit code 0 if all required services up, 1 if any required service down.
"""
import os
import sys
import requests
from web3 import Web3
from pymongo import MongoClient
from dotenv import load_dotenv

# Load .env.production
this_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(this_dir, "..", ".env.production")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path, override=True)
else:
    load_dotenv()

def check_mongo():
    try:
        uri = os.environ.get("MONGO_URI", "")
        if not uri:
            print("  MongoDB Atlas        : NOT CONFIGURED (MONGO_URI empty)")
            return False
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        print("  MongoDB Atlas        : CONNECTED")
        return True
    except Exception as e:
        print(f"  MongoDB Atlas        : FAILED ({e})")
        return False

def check_base_sepolia():
    try:
        url = os.environ.get("BASE_SEPOLIA_RPC_URL", "")
        if not url:
            print("  Base Sepolia RPC     : NOT CONFIGURED (BASE_SEPOLIA_RPC_URL empty)")
            return False
        w3 = Web3(Web3.HTTPProvider(url))
        block = w3.eth.block_number
        print(f"  Base Sepolia RPC     : CONNECTED (block {block})")
        return True
    except Exception as e:
        print(f"  Base Sepolia RPC     : FAILED ({e})")
        return False

def check_pinata():
    try:
        key = os.environ.get("PINATA_API_KEY", "")
        secret = os.environ.get("PINATA_SECRET_KEY", "")
        if not key or key == "your_pinata_api_key_here":
            print("  Pinata IPFS          : NOT CONFIGURED")
            return False
        res = requests.get(
            "https://api.pinata.cloud/data/testAuthentication",
            headers={"pinata_api_key": key, "pinata_secret_api_key": secret},
            timeout=5
        )
        if res.status_code == 200:
            print("  Pinata IPFS          : AUTHENTICATED")
            return True
        print(f"  Pinata IPFS          : AUTH FAILED ({res.status_code})")
        return False
    except Exception as e:
        print(f"  Pinata IPFS          : FAILED ({e})")
        return False

def check_contract():
    try:
        url = os.environ.get("BASE_SEPOLIA_RPC_URL", "")
        address = os.environ.get("CONTRACT_ADDRESS", "")
        if not url or not address:
            print("  Smart Contract       : NOT CONFIGURED (RPC or CONTRACT_ADDRESS empty)")
            return False
        w3 = Web3(Web3.HTTPProvider(url))
        code = w3.eth.get_code(Web3.to_checksum_address(address))
        if len(code) > 2:
            print(f"  Smart Contract       : DEPLOYED at {address[:10]}...{address[-6:]}")
            return True
        print(f"  Smart Contract       : NO CODE at {address}")
        return False
    except Exception as e:
        print(f"  Smart Contract       : FAILED ({e})")
        return False

def main():
    print("\n" + "="*50)
    print("  STEGOCHAIN SERVICE HEALTH CHECK")
    print("="*50)

    results = {
        "MongoDB Atlas": check_mongo(),
        "Base Sepolia": check_base_sepolia(),
        "Pinata IPFS": check_pinata(),
        "Smart Contract": check_contract()
    }

    print("="*50)

    failed = [k for k, v in results.items() if not v]
    required_failed = [f for f in failed if f in ["MongoDB Atlas", "Base Sepolia", "Smart Contract"]]

    if not required_failed:
        print("  ALL REQUIRED SERVICES UP — backend can start")
        print("="*50 + "\n")
        sys.exit(0)
    else:
        print(f"  FAILED: {', '.join(required_failed)}")
        print("  Fix these before starting backend")
        print("="*50 + "\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
