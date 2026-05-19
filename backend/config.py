"""
config.py — StegoChain Application Configuration
=================================================
Loads all environment variables from a .env file and exposes them
as class-level attributes on the `Config` object.

Usage:
    from config import Config
    mongo_uri = Config.MONGO_URI
"""

import os
import pathlib
from dotenv import load_dotenv

# Load .env.production from stegochain/ root
_HERE     = pathlib.Path(__file__).resolve().parent
_ENV_FILE = _HERE.parent / ".env.production"
if _ENV_FILE.exists():
    load_dotenv(dotenv_path=_ENV_FILE, override=True)
else:
    load_dotenv()


class Config:
    # Flask
    SECRET_KEY: str = os.getenv("SECRET_KEY", "changeme-in-production")
    FLASK_ENV: str  = os.getenv("FLASK_ENV", "development")
    FLASK_PORT: int = int(os.getenv("FLASK_PORT", 5000))

    # MongoDB
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/stegochain")

    # Pinata / IPFS
    PINATA_API_KEY:    str = os.getenv("PINATA_API_KEY", "")
    PINATA_SECRET_KEY: str = os.getenv("PINATA_SECRET_KEY", "")
    PINATA_BASE_URL:   str = os.getenv("PINATA_BASE_URL", "https://api.pinata.cloud")

    # Blockchain / Ganache
    GANACHE_URL:       str = os.getenv("GANACHE_URL", "http://127.0.0.1:7545")
    CONTRACT_ADDRESS:  str = os.getenv("CONTRACT_ADDRESS", "")
    PRIVATE_KEY:       str = os.getenv("PRIVATE_KEY", "")

    # Debug helper
    @classmethod
    def summary(cls) -> dict:
        """Return a sanitised summary (no secrets) for logging purposes."""
        return {
            "FLASK_ENV":      cls.FLASK_ENV,
            "FLASK_PORT":     cls.FLASK_PORT,
            "MONGO_URI":      cls.MONGO_URI,
            "PINATA_BASE_URL": cls.PINATA_BASE_URL,
            "GANACHE_URL":    cls.GANACHE_URL,
            "CONTRACT_ADDRESS": cls.CONTRACT_ADDRESS,
        }
