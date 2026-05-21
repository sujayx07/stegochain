"""
app.py — StegoChain Flask Application V2
=========================================
JWT auth, V2 blockchain, no Shamir blueprint.
"""
import os
import pathlib
import logging
import traceback
import gc
import tempfile

from dotenv import load_dotenv
from flask import Flask, jsonify, send_file
from flask_cors import CORS
from pymongo import MongoClient

_HERE     = pathlib.Path(__file__).resolve().parent
_ENV_FILE = _HERE.parent / ".env.production"
if _ENV_FILE.exists():
    load_dotenv(dotenv_path=_ENV_FILE, override=True)
else:
    load_dotenv()


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get("SECRET_KEY", "changeme-in-production")
    
    # Limit file uploads to 50MB max
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        supports_credentials=False,
    )

    # Explicit handler for OPTIONS preflight on all routes
    @app.after_request
    def after_request(response):
        response.headers["Access-Control-Allow-Origin"]  = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        # Force garbage collection after each request
        gc.collect()
        return response

    # ── MongoDB ─────────────────────────────────────────────────────────────
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/stegochain")
    client    = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
    db        = client.get_database()
    app.db    = db
    
    # Store client for teardown
    @app.teardown_appcontext
    def cleanup_db(exception):
        pass  # MongoDB client is closed on shutdown

    # ── Blueprints ───────────────────────────────────────────────────────────
    from routes.auth_routes       import auth_bp
    from routes.stego_routes      import stego_bp
    from routes.crypto_routes     import crypto_bp
    from routes.ipfs_routes       import ipfs_bp
    from routes.blockchain_routes import blockchain_bp
    from routes.graph_routes      import graph_bp

    app.register_blueprint(auth_bp,       url_prefix="/api/auth")
    app.register_blueprint(stego_bp,      url_prefix="/api/stego")
    app.register_blueprint(crypto_bp,     url_prefix="/api/crypto")
    app.register_blueprint(ipfs_bp,       url_prefix="/api/ipfs")
    app.register_blueprint(blockchain_bp, url_prefix="/api/blockchain")
    app.register_blueprint(graph_bp)

    # ── Serve decrypted media by session ─────────────────────────────────────
    @app.route("/api/media/<session_id>")
    def serve_media(session_id):
        txn_doc = db["transactions"].find_one({"session_id": session_id})
        if not txn_doc:
            return jsonify({"error": "session not found", "status": 404}), 404
        # Media is served via the /receive endpoint (base64 encoded).
        # This endpoint returns metadata only.
        return jsonify({
            "session_id": session_id,
            "ipfs_cid":   txn_doc.get("ipfs_cid", ""),
            "file_type":  txn_doc.get("file_type", "image"),
            "status":     txn_doc.get("status", "unknown"),
        }), 200

    # ── Health check ─────────────────────────────────────────────────────────
    @app.route("/health")
    def health():
        return jsonify({
            "status":  "ok",
            "service": "StegoChain Backend V2",
            "version": "2.0.0",
            "modules": ["steganography", "crypto", "ipfs", "blockchain_v2", "auth_jwt", "graph_ai"],
            "contract": os.environ.get("CONTRACT_ADDRESS", "not-set"),
            "network":  "Ethereum Sepolia",
        })

    # ── Error handlers ───────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "endpoint not found", "status": 404}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "method not allowed", "status": 405}), 405

    @app.errorhandler(500)
    def internal_error(e):
        tb = traceback.format_exc()
        print(f"[ERROR 500] {tb}")
        return jsonify({"error": "internal server error", "status": 500}), 500

    return app


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    app  = create_app()
    # Use production-safe settings
    app.run(debug=False, use_reloader=False, host="0.0.0.0", port=int(os.environ.get("FLASK_PORT", 5000)))
