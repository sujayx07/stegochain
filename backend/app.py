"""
app.py — StegoChain Flask Application
=======================================
Complete application with MongoDB init, blueprint registration, and error handlers.
"""
import os
import pathlib

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient

# Load .env.production from the project root (stegochain/)
# Works regardless of which directory python app.py is invoked from.
_HERE = pathlib.Path(__file__).resolve().parent          # stegochain/backend/
_ENV_FILE = _HERE.parent / ".env.production"             # stegochain/.env.production
if _ENV_FILE.exists():
    load_dotenv(dotenv_path=_ENV_FILE, override=True)
else:
    load_dotenv()  # fallback: look for plain .env


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get("SECRET_KEY", "changeme-in-production")
    CORS(app)

    # ── MongoDB ───────────────────────────────────────────────────────────
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/stegochain")
    client    = MongoClient(mongo_uri)
    db        = client.get_database()
    app.db    = db   # accessible via current_app.db in blueprints

    # ── Blueprints ─────────────────────────────────────────────────────────
    from routes.stego_routes      import stego_bp
    from routes.crypto_routes     import crypto_bp
    from routes.ipfs_routes       import ipfs_bp
    from routes.blockchain_routes import blockchain_bp
    from routes.graph_routes      import graph_bp

    app.register_blueprint(stego_bp,      url_prefix="/api/stego")
    app.register_blueprint(crypto_bp,     url_prefix="/api/crypto")
    app.register_blueprint(ipfs_bp,       url_prefix="/api/ipfs")
    app.register_blueprint(blockchain_bp, url_prefix="/api/blockchain")
    app.register_blueprint(graph_bp)

    # ── Health check ───────────────────────────────────────────────────────
    @app.route("/health")
    def health():
        return jsonify({
            "status":  "ok",
            "service": "StegoChain Backend",
            "version": "1.0.0",
            "modules": ["steganography", "crypto", "secret_sharing", "ipfs", "blockchain", "graph_ai"],
        })

    # ── Global error handlers ──────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "endpoint not found", "status": 404}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "method not allowed", "status": 405}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "internal server error", "status": 500}), 500

    return app


if __name__ == "__main__":
    app  = create_app()
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
