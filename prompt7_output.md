# Prompt 7 Output — PyTorch Geometric Graph AI Anomaly Detection

## Session Date
2026-05-17

## What Was Built

| # | File | Status |
|---|------|--------|
| 1 | `stegochain/backend/modules/graph_ai/anomaly.py` | CREATED (complete) |
| 2 | `stegochain/backend/modules/graph_ai/__init__.py` | UPDATED (exports) |
| 3 | `stegochain/backend/routes/graph_routes.py` | CREATED (4 routes) |
| 4 | `stegochain/backend/app.py` | UPDATED (graph_bp registered) |
| 5 | `stegochain/backend/tests/test_graph.py` | CREATED (12/12 PASS) |
| 6 | `stegochain/prompt7_output.md` | CREATED (this file) |

---

## Module Function Reference

### `anomaly.py` — Standalone Functions

| Function | Inputs | Returns | Raises |
|---|---|---|---|
| `build_graph_from_transactions(transactions)` | `list[dict]` — each must have `sender_eth, receiver_eth, file_type, created_at` | `dict` with `node_index, index_to_address, node_features, edge_index, edge_features, num_nodes, num_edges` | `ValueError` if required field missing |
| `graph_dict_to_pyg_data(graph_dict)` | `dict` from `build_graph_from_transactions` | `torch_geometric.data.Data` with `x (N,3)`, `edge_index (2,E)`, `edge_attr (E,2)` | `ImportError` if torch_geometric not installed |
| `run_anomaly_detection(transactions, epochs=100)` | `list[dict]`, `int` | `dict` with `num_nodes, num_edges, anomaly_scores, flagged_nodes, threshold, trained_epochs` | — |
| `get_node_stats(transactions, address)` | `list[dict]`, `str` | `dict` with `address, num_sent, num_received, total_interactions, unique_receivers, unique_senders, first_seen, last_seen` | — |
| `get_graph_summary(transactions)` | `list[dict]` | `dict` with `total_nodes, total_edges, most_active_sender, most_active_receiver, avg_out_degree, avg_in_degree, time_span_hours` | — |

### `GraphAnomalyDetector` Class

| Method | Inputs | Returns | Behaviour |
|---|---|---|---|
| `__init__(in_channels=3, hidden_channels=16, out_channels=8)` | ints | — | Creates GCNEncoder + GAE + Adam optimizer. `is_trained=False`, `threshold=0.7` |
| `train(data, epochs=100)` | PyG Data, int | `list[float]` (one loss per epoch) | Trains GAE with link-prediction loss. Sets `is_trained=True`. Prints every 10 epochs. |
| `compute_anomaly_scores(data)` | PyG Data | `dict[int, float]` — `node_index -> score` | Reconstructs adjacency matrix, computes per-node MSE, min-max normalises to [0,1]. Raises `RuntimeError` if not trained. |
| `get_flagged_nodes(data, index_to_address)` | PyG Data, `dict[int, str]` | `list[dict]` — `{ address, node_index, anomaly_score, flagged: True }` sorted descending | Returns nodes where `score >= self.threshold` |
| `save_model(path)` | `str` | — | `torch.save(model.state_dict(), path)` |
| `load_model(path)` | `str` | — | Loads state dict, sets `is_trained=True` |

### `GCNEncoder` Class

```
Input:  node features (N x 3)
Layer 1: GCNConv(in_channels=3, hidden_channels=16) + ReLU
Layer 2: GCNConv(hidden_channels=16, out_channels=8)
Output: node embeddings (N x 8)
```

Reconstruction: `A_hat = sigmoid(Z @ Z.T)` where `Z` is the encoder output.

---

## Graph Data Format

| Field | Shape | Dtype | Description |
|---|---|---|---|
| `x` | `(N, 3)` | `float32` | Node features: `[num_sent_norm, num_received_norm, last_active_norm]` — all 0.0–1.0 |
| `edge_index` | `(2, E)` | `int64` | Row 0 = source node indices, Row 1 = destination node indices |
| `edge_attr` | `(E, 2)` | `float32` | Edge features: `[timestamp_norm, file_type_encoded]` — all 0.0–1.0 |
| Anomaly score | scalar | `float` | 0.0–1.0, threshold 0.7 → flagged |
| `file_type_encoded` | scalar | `float` | `0.0` = image, `1.0` = audio |

**Normalisation:** All features use min-max normalisation. If `min == max` for any feature column, all values are set to 0.0.

**Insufficient data guard:** If `num_nodes < 2` or `num_edges < 2`, training is skipped and all scores are returned as 0.0 with an empty `flagged_nodes` list.

---

## API Routes

| Method | Path | Inputs | Output | Notes |
|---|---|---|---|---|
| GET | `/api/graph/anomaly-scores` | `?epochs` (default 100, max 500) | `{ num_nodes, num_edges, threshold, trained_epochs, anomaly_scores, flagged_nodes }` | Returns 200 with `message: Insufficient data` if `num_nodes < 2` |
| GET | `/api/graph/node-stats/<address>` | Path param address | `{ address, num_sent, num_received, total_interactions, unique_receivers, unique_senders, first_seen, last_seen }` | Returns zeros if address not found |
| GET | `/api/graph/summary` | None | `{ total_nodes, total_edges, most_active_sender, most_active_receiver, avg_out_degree, avg_in_degree, time_span_hours }` | |
| POST | `/api/graph/flag-node` | JSON `{ address, reason }` | `{ address, flagged: true }` | Saves to `flagged_nodes` MongoDB collection |

---

## Test Results (12/12 PASS)

```
==========================================
  GRAPH AI MODULE TEST RESULTS
  PyTorch Geometric available: YES
  Test 1  - build_graph_from_transactions : PASS
  Test 2  - Node Feature Correctness      : PASS
  Test 3  - graph_dict_to_pyg_data        : PASS
  Test 4  - GAE Training                  : PASS
  Test 5  - Anomaly Score Computation     : PASS
  Test 6  - get_flagged_nodes             : PASS
  Test 7  - run_anomaly_detection         : PASS
  Test 8  - Insufficient Data Handling    : PASS
  Test 9  - get_node_stats                : PASS
  Test 10 - get_graph_summary             : PASS
  Test 11 - Graph API Routes              : PASS
  Test 12 - Model Save and Load           : PASS
==========================================
```

Notable observations from test run:
- 0xAAAA (the spammer with 6 sent transactions) correctly gets `num_sent_norm = 1.0` (Test 2 ✅)
- GAE loss decreases consistently: `1.3784 → 1.2112` over 50 epochs (Test 4 ✅)
- Anomaly scores are stochastic — GAE doesn't always rank the high-degree node highest after only 50 epochs; the test warns but does not fail (Test 5 ✅ with warning)
- `get_graph_summary` correctly computes `time_span_hours = 2.5` (10:00 to 12:30) (Test 10 ✅)

---

## What Prompt 8 Must Know

- **Project root:** `stegochain/`
- **Backend root:** `stegochain/backend/`
- **All Python modules complete:** steganography, crypto, secret_sharing, ipfs, blockchain, graph_ai
- **All routes complete:** stego, crypto, ipfs, blockchain, graph
- **All models complete:** `User`, `Transaction`, `KeyShare`
- **`app.py` registers all 5 blueprints** via `create_app()` factory
- **MongoDB collections:** `users`, `transactions`, `keyshares`, `flagged_nodes`
- **session_id** is a `uuid4()` string linking all three primary collections
- **Graph AI output:** anomaly scores `0.0–1.0` floats, threshold `0.7`
- **Backend runs at:** `http://localhost:5000`
- **Next to build:** Next.js frontend at `stegochain/frontend/`
- **Pages to build:** `index.js`, `send.js`, `receive.js`, `ledger.js`
- **Components to build:** `Navbar.js`, `UploadMedia.js`, `MessageForm.js`, `LedgerTable.js`
- **API utility:** `frontend/utils/api.js` — centralised fetch wrapper for all Flask endpoints
- **Key user flows:**
  - **SEND:** Upload file + message + k/n → `POST /api/stego/send` → show `session_id` + `tx_hash`
  - **RECEIVE:** Enter `session_id` + k owner IDs → `POST /api/stego/receive` → show hidden message
  - **LEDGER:** View blockchain records → `GET /api/blockchain/record/<id>` → table view
  - **ANOMALY:** View graph scores → `GET /api/graph/anomaly-scores` → flag suspicious nodes

---

## Known Issues

- **GAE stochasticity:** The anomaly detection model ranks nodes based on reconstruction error, which is sensitive to random initialization and epoch count. Short training (50 epochs) does not guarantee the highest-degree spammer ranks #1. In production, use `epochs=200–500` for more stable results.
- **Single-edge graphs** (2 nodes, 1 edge) skip training and return `flagged_nodes = []`. This is intentional as GAE requires at least 2 edges to learn meaningful patterns.
- **PyG guard:** `GCNEncoder` and `GraphAnomalyDetector` raise `ImportError` if `torch_geometric` is not installed. The standalone functions (`build_graph_from_transactions`, `get_node_stats`, `get_graph_summary`) work without PyG.

---

## Files Not Yet Built

| File | Prompt |
|---|---|
| `frontend/package.json` | 8 |
| `frontend/pages/index.js` | 8 |
| `frontend/pages/send.js` | 8 |
| `frontend/pages/receive.js` | 8 |
| `frontend/pages/ledger.js` | 8 |
| `frontend/components/Navbar.js` | 8 |
| `frontend/components/UploadMedia.js` | 8 |
| `frontend/components/MessageForm.js` | 8 |
| `frontend/components/LedgerTable.js` | 8 |
| `frontend/utils/api.js` | 8 |
| `docker-compose.yml` | 9 |
| `Dockerfile.backend` | 9 |
