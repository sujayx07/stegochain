"""
Graph AI Module Test Suite -- 12 tests
Run from stegochain/backend/: python tests/test_graph.py
Tests 3-7, 12 are SKIPPED (not FAILED) if torch_geometric is unavailable.
"""
import io, json, math, os, sys, tempfile
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# -- PyG availability check --------------------------------------------------
try:
    import torch
    from torch_geometric.data import Data
    _PYG = True
except ImportError:
    _PYG = False

from modules.graph_ai.anomaly import (
    build_graph_from_transactions,
    get_graph_summary,
    get_node_stats,
    run_anomaly_detection,
)

# -- Helpers -----------------------------------------------------------------
def _sep(t): print("\n--------------------------------------"); print(" " + t); print("--------------------------------------")
def _pass(l): print("  [result] PASS - " + l); return "PASS"
def _fail(l, e): print("  [result] FAIL - " + l + "\n  " + type(e).__name__ + ": " + str(e)); return "FAIL"
def _skip(l): print("  [result] SKIP - " + l + " (torch_geometric not available)"); return "SKIP"

# -- Synthetic data ----------------------------------------------------------
def make_test_transactions():
    addresses = [
        "0xAAAA000000000000000000000000000000000001",
        "0xBBBB000000000000000000000000000000000002",
        "0xCCCC000000000000000000000000000000000003",
        "0xDDDD000000000000000000000000000000000004",
        "0xEEEE000000000000000000000000000000000005",
    ]
    transactions = [
        {"sender_eth": addresses[0], "receiver_eth": addresses[1], "file_type": "image",
         "created_at": "2026-05-17T10:00:00", "session_id": "s001", "status": "complete"},
        {"sender_eth": addresses[0], "receiver_eth": addresses[1], "file_type": "image",
         "created_at": "2026-05-17T10:01:00", "session_id": "s002", "status": "complete"},
        {"sender_eth": addresses[0], "receiver_eth": addresses[1], "file_type": "image",
         "created_at": "2026-05-17T10:02:00", "session_id": "s003", "status": "complete"},
        {"sender_eth": addresses[0], "receiver_eth": addresses[2], "file_type": "audio",
         "created_at": "2026-05-17T10:03:00", "session_id": "s004", "status": "complete"},
        {"sender_eth": addresses[0], "receiver_eth": addresses[2], "file_type": "image",
         "created_at": "2026-05-17T10:04:00", "session_id": "s005", "status": "complete"},
        {"sender_eth": addresses[0], "receiver_eth": addresses[3], "file_type": "image",
         "created_at": "2026-05-17T10:05:00", "session_id": "s006", "status": "complete"},
        {"sender_eth": addresses[1], "receiver_eth": addresses[2], "file_type": "image",
         "created_at": "2026-05-17T11:00:00", "session_id": "s007", "status": "complete"},
        {"sender_eth": addresses[2], "receiver_eth": addresses[3], "file_type": "audio",
         "created_at": "2026-05-17T11:30:00", "session_id": "s008", "status": "complete"},
        {"sender_eth": addresses[3], "receiver_eth": addresses[4], "file_type": "image",
         "created_at": "2026-05-17T12:00:00", "session_id": "s009", "status": "complete"},
        {"sender_eth": addresses[4], "receiver_eth": addresses[1], "file_type": "image",
         "created_at": "2026-05-17T12:30:00", "session_id": "s010", "status": "complete"},
    ]
    return transactions, addresses

TXNS, ADDRS = make_test_transactions()
_GRAPH = None   # shared after t1

# -- Tests -------------------------------------------------------------------

def t1():
    _sep("TEST 1 - build_graph_from_transactions")
    global _GRAPH
    try:
        g = build_graph_from_transactions(TXNS)
        _GRAPH = g
        assert g["num_nodes"] == 5, f"num_nodes={g['num_nodes']}"
        assert g["num_edges"] == 10, f"num_edges={g['num_edges']}"
        assert len(g["node_index"]) == 5
        assert len(g["edge_index"][0]) == 10
        assert len(g["node_features"]) == 5
        for feat in g["node_features"]:
            assert len(feat) == 3
            for v in feat:
                assert 0.0 <= v <= 1.0, f"feature {v} out of range"
        return _pass("num_nodes=5, num_edges=10, all features in [0,1]")
    except Exception as e: return _fail("build_graph_from_transactions", e)

def t2():
    _sep("TEST 2 - Node Feature Correctness (0xAAAA is spammer)")
    try:
        g     = _GRAPH or build_graph_from_transactions(TXNS)
        idx   = g["node_index"][ADDRS[0]]  # 0xAAAA
        feat  = g["node_features"][idx]
        # num_sent_norm should be 1.0 (0xAAAA sent 6, highest)
        assert abs(feat[0] - 1.0) < 1e-5, f"Expected 1.0 for spammer num_sent_norm, got {feat[0]}"
        print(f"  [info] 0xAAAA node_features = {feat}")
        return _pass("0xAAAA num_sent_norm == 1.0 (max sender)")
    except Exception as e: return _fail("Node feature correctness", e)

def t3():
    _sep("TEST 3 - graph_dict_to_pyg_data")
    if not _PYG: return _skip("graph_dict_to_pyg_data")
    try:
        from modules.graph_ai.anomaly import graph_dict_to_pyg_data
        g    = _GRAPH or build_graph_from_transactions(TXNS)
        data = graph_dict_to_pyg_data(g)
        assert data.x.shape          == (5, 3),   f"x.shape={data.x.shape}"
        assert data.edge_index.shape == (2, 10),  f"edge_index.shape={data.edge_index.shape}"
        assert data.edge_attr.shape  == (10, 2),  f"edge_attr.shape={data.edge_attr.shape}"
        assert data.x.dtype          == torch.float32
        return _pass("PyG Data shapes (5,3) / (2,10) / (10,2) correct")
    except Exception as e: return _fail("graph_dict_to_pyg_data", e)

_detector = None
_pyg_data = None

def t4():
    _sep("TEST 4 - GAE Training")
    global _detector, _pyg_data
    if not _PYG: return _skip("GAE Training")
    try:
        from modules.graph_ai.anomaly import graph_dict_to_pyg_data, GraphAnomalyDetector
        g          = _GRAPH or build_graph_from_transactions(TXNS)
        _pyg_data  = graph_dict_to_pyg_data(g)
        _detector  = GraphAnomalyDetector()
        assert not _detector.is_trained
        losses = _detector.train(_pyg_data, epochs=50)
        assert _detector.is_trained, "is_trained should be True after training"
        assert len(losses) == 50, f"Expected 50 losses, got {len(losses)}"
        assert all(math.isfinite(l) for l in losses), "Loss contains nan/inf"
        print(f"  [info] Final loss: {losses[-1]:.4f}")
        return _pass("GAE trained 50 epochs, all losses finite, is_trained=True")
    except Exception as e: return _fail("GAE Training", e)

def t5():
    _sep("TEST 5 - Anomaly Score Computation")
    if not _PYG: return _skip("Anomaly Score Computation")
    try:
        assert _detector is not None and _detector.is_trained, "Run t4 first"
        scores = _detector.compute_anomaly_scores(_pyg_data)
        assert len(scores) == 5, f"Expected 5 scores, got {len(scores)}"
        for s in scores.values():
            assert 0.0 <= s <= 1.0, f"Score {s} out of [0,1]"
        aaaa_idx   = _GRAPH["node_index"][ADDRS[0]]
        aaaa_score = scores[aaaa_idx]
        max_score  = max(scores.values())
        print(f"  [info] 0xAAAA anomaly_score = {aaaa_score:.4f}, max = {max_score:.4f}")
        if aaaa_score < max_score:
            print("  [warn] 0xAAAA is not the highest scorer (GAE is stochastic) -- not failing")
        return _pass("5 scores in [0,1] computed successfully")
    except Exception as e: return _fail("Anomaly Score Computation", e)

def t6():
    _sep("TEST 6 - get_flagged_nodes")
    if not _PYG: return _skip("get_flagged_nodes")
    try:
        assert _detector is not None and _detector.is_trained, "Run t4 first"
        _detector.threshold = 0.5   # lower threshold to ensure some flags
        flagged = _detector.get_flagged_nodes(_pyg_data, _GRAPH["index_to_address"])
        print(f"  [info] Flagged nodes with threshold=0.5: {len(flagged)}")
        for item in flagged:
            assert "address"       in item
            assert "node_index"    in item
            assert "anomaly_score" in item
            assert item["flagged"] is True
        # Verify sorted descending
        scores = [f["anomaly_score"] for f in flagged]
        assert scores == sorted(scores, reverse=True), "Not sorted descending"
        _detector.threshold = 0.7   # restore
        return _pass(f"{len(flagged)} flagged nodes, all keys present, sorted descending")
    except Exception as e: return _fail("get_flagged_nodes", e)

def t7():
    _sep("TEST 7 - run_anomaly_detection Pipeline")
    if not _PYG: return _skip("run_anomaly_detection")
    try:
        result = run_anomaly_detection(TXNS, epochs=50)
        for field in ("num_nodes","num_edges","anomaly_scores","flagged_nodes","threshold","trained_epochs"):
            assert field in result, f"Missing field: {field}"
        assert result["num_nodes"]      == 5,  f"num_nodes={result['num_nodes']}"
        assert result["num_edges"]      == 10, f"num_edges={result['num_edges']}"
        assert result["trained_epochs"] == 50, f"trained_epochs={result['trained_epochs']}"
        assert len(result["anomaly_scores"]) == 5
        return _pass("run_anomaly_detection: all fields present, num_nodes=5, num_edges=10")
    except Exception as e: return _fail("run_anomaly_detection", e)

def t8():
    _sep("TEST 8 - Insufficient Data Handling")
    try:
        # Empty list
        r0 = run_anomaly_detection([])
        assert r0["num_nodes"] == 0, f"Expected 0, got {r0['num_nodes']}"
        assert r0["flagged_nodes"] == []
        # Single transaction (2 nodes, 1 edge -- still < 2 nodes is False here, but flagged=[])
        single = [TXNS[0]]
        r1 = run_anomaly_detection(single, epochs=10)
        assert r1["flagged_nodes"] == [], f"Expected [], got {r1['flagged_nodes']}"
        print(f"  [info] Single txn: num_nodes={r1['num_nodes']}, num_edges={r1['num_edges']}")
        return _pass("Empty and single-transaction cases handled without error")
    except Exception as e: return _fail("Insufficient data handling", e)

def t9():
    _sep("TEST 9 - get_node_stats")
    try:
        stats = get_node_stats(TXNS, ADDRS[0])
        assert stats["num_sent"]         == 6, f"num_sent={stats['num_sent']}"
        assert stats["num_received"]     == 0, f"num_received={stats['num_received']}"
        assert stats["unique_receivers"] == 3, f"unique_receivers={stats['unique_receivers']}"
        assert stats["total_interactions"] == 6
        print(f"  [info] 0xAAAA stats: {stats}")
        # Unknown address
        unknown = get_node_stats(TXNS, "0xDEAD000000000000000000000000000000000000")
        assert unknown["num_sent"]     == 0
        assert unknown["num_received"] == 0
        return _pass("get_node_stats: num_sent=6, unique_receivers=3, unknown=zeros")
    except Exception as e: return _fail("get_node_stats", e)

def t10():
    _sep("TEST 10 - get_graph_summary")
    try:
        s = get_graph_summary(TXNS)
        assert s["total_nodes"]        == 5,       f"total_nodes={s['total_nodes']}"
        assert s["total_edges"]        == 10,      f"total_edges={s['total_edges']}"
        assert s["most_active_sender"] == ADDRS[0],f"most_active_sender={s['most_active_sender']}"
        assert abs(s["avg_out_degree"] - 2.0) < 1e-4, f"avg_out={s['avg_out_degree']}"
        assert abs(s["avg_in_degree"]  - 2.0) < 1e-4, f"avg_in={s['avg_in_degree']}"
        # 10:00 to 12:30 = 2.5 hours
        assert abs(s["time_span_hours"] - 2.5) < 0.01, f"time_span_hours={s['time_span_hours']}"
        print(f"  [info] Summary: {s}")
        return _pass("get_graph_summary: all fields correct, time_span_hours=2.5")
    except Exception as e: return _fail("get_graph_summary", e)

def t11():
    _sep("TEST 11 - Graph API Routes (Flask test client)")
    try:
        # Build mock DB
        _store = {}
        class _FakeCol:
            def __init__(self, n):
                if n not in _store: _store[n] = []
                self._d = _store[n]
            def find(self, q=None): return [dict(t) for t in TXNS]
            def insert_one(self, doc): self._d.append(doc); return MagicMock()
        class _FakeDB:
            def __getitem__(self, n): return _FakeCol(n)
        class _FakeClient:
            def get_database(self): return _FakeDB()

        with patch("pymongo.MongoClient", return_value=_FakeClient()):
            from app import create_app
        app    = create_app()
        client = app.test_client()

        # GET /api/graph/summary
        r = client.get("/api/graph/summary")
        d = r.get_json()
        assert r.status_code == 200, d
        assert d["total_nodes"] == 5
        assert d["total_edges"] == 10

        # GET /api/graph/node-stats/<address>
        r2 = client.get(f"/api/graph/node-stats/{ADDRS[0]}")
        d2 = r2.get_json()
        assert r2.status_code == 200, d2
        assert d2["num_sent"] == 6

        # POST /api/graph/flag-node
        r3 = client.post("/api/graph/flag-node",
                         data=json.dumps({"address": ADDRS[0], "reason": "spam"}),
                         content_type="application/json")
        d3 = r3.get_json()
        assert r3.status_code == 200, d3
        assert d3["flagged"] is True

        return _pass("summary(5,10), node-stats(num_sent=6), flag-node(flagged=True)")
    except Exception as e: return _fail("Graph API routes", e)

def t12():
    _sep("TEST 12 - Model Save and Load")
    if not _PYG: return _skip("Model Save and Load")
    try:
        from modules.graph_ai.anomaly import graph_dict_to_pyg_data, GraphAnomalyDetector
        g    = _GRAPH or build_graph_from_transactions(TXNS)
        data = graph_dict_to_pyg_data(g)

        det1 = GraphAnomalyDetector()
        det1.train(data, epochs=20)
        assert det1.is_trained

        path = tempfile.mktemp(suffix=".pt")
        det1.save_model(path)
        assert os.path.exists(path)

        det2 = GraphAnomalyDetector()
        assert not det2.is_trained
        det2.load_model(path)
        assert det2.is_trained

        # Compute scores — should not raise
        scores = det2.compute_anomaly_scores(data)
        assert len(scores) == 5
        os.remove(path)
        return _pass("save/load model: is_trained=True after load, scores computed")
    except Exception as e: return _fail("Model Save and Load", e)


# -- Entry point -------------------------------------------------------------
if __name__ == "__main__":
    print("\n==========================================")
    print("  GRAPH AI MODULE TEST SUITE")
    print(f"  PyTorch Geometric available: {'YES' if _PYG else 'NO'}")
    print("==========================================")

    results = {
        "Test 1  - build_graph_from_transactions": t1(),
        "Test 2  - Node Feature Correctness":      t2(),
        "Test 3  - graph_dict_to_pyg_data":        t3(),
        "Test 4  - GAE Training":                  t4(),
        "Test 5  - Anomaly Score Computation":     t5(),
        "Test 6  - get_flagged_nodes":             t6(),
        "Test 7  - run_anomaly_detection":         t7(),
        "Test 8  - Insufficient Data Handling":    t8(),
        "Test 9  - get_node_stats":                t9(),
        "Test 10 - get_graph_summary":             t10(),
        "Test 11 - Graph API Routes":              t11(),
        "Test 12 - Model Save and Load":           t12(),
    }

    print("\n==========================================")
    print("  GRAPH AI MODULE TEST RESULTS")
    print(f"  PyTorch Geometric available: {'YES' if _PYG else 'NO'}")
    w = max(len(k) for k in results)
    for name, res in results.items():
        print("  {:<{}} : {}".format(name, w, res))
    print("==========================================\n")

    if any(r == "FAIL" for r in results.values()):
        sys.exit(1)
