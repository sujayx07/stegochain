"""
Graph AI Routes
================
Blueprint: graph_bp    prefix: /api/graph

Endpoints:
  GET  /api/graph/anomaly-scores
  GET  /api/graph/node-stats/<address>
  GET  /api/graph/summary
  POST /api/graph/flag-node
"""
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

from modules.graph_ai.anomaly import (
    get_graph_summary,
    get_node_stats,
    run_anomaly_detection,
)

graph_bp = Blueprint("graph_bp", __name__, url_prefix="/api/graph")


def _err(msg, code=400): return jsonify({"error": msg, "status": code}), code
def _ok(data):
    data["status"] = 200
    return jsonify(data), 200

def _fetch_transactions():
    """Fetch complete transactions from MongoDB, strip ObjectId."""
    docs = list(current_app.db["transactions"].find({"status": "complete"}))
    clean = []
    for doc in docs:
        doc.pop("_id", None)
        clean.append(doc)
    return clean


@graph_bp.route("/anomaly-scores", methods=["GET"])
def anomaly_scores():
    try:
        epochs = min(int(request.args.get("epochs", 100)), 500)
    except ValueError:
        epochs = 100

    try:
        txns   = _fetch_transactions()
        result = run_anomaly_detection(txns, epochs=epochs)

        if result["num_nodes"] < 2:
            return _ok({
                "message":       "Insufficient data for analysis",
                "num_nodes":     result["num_nodes"],
                "flagged_nodes": [],
            })

        # Convert int keys to str for JSON serialisation
        scores_str = {str(k): v for k, v in result["anomaly_scores"].items()}
        return _ok({
            "num_nodes":      result["num_nodes"],
            "num_edges":      result["num_edges"],
            "threshold":      result["threshold"],
            "trained_epochs": result["trained_epochs"],
            "anomaly_scores": scores_str,
            "flagged_nodes":  result["flagged_nodes"],
        })
    except Exception as e:
        return _err(f"Anomaly detection failed: {e}", 500)


@graph_bp.route("/node-stats/<address>", methods=["GET"])
def node_stats(address):
    try:
        txns  = _fetch_transactions()
        stats = get_node_stats(txns, address)
        return _ok(stats)
    except Exception as e:
        return _err(f"Node stats failed: {e}", 500)


@graph_bp.route("/summary", methods=["GET"])
def summary():
    try:
        txns = _fetch_transactions()
        s    = get_graph_summary(txns)
        return _ok(s)
    except Exception as e:
        return _err(f"Graph summary failed: {e}", 500)


@graph_bp.route("/flag-node", methods=["POST"])
def flag_node():
    data    = request.get_json(force=True) or {}
    address = data.get("address", "").strip()
    reason  = data.get("reason", "").strip()

    if not address:
        return _err("address is required")

    record = {
        "address":    address,
        "reason":     reason or "no reason provided",
        "flagged_at": datetime.now(timezone.utc).isoformat(),
        "flagged_by": "system",
    }
    try:
        current_app.db["flagged_nodes"].insert_one(record)
    except Exception as e:
        return _err(f"Failed to save flag: {e}", 500)

    return _ok({"address": address, "flagged": True})
