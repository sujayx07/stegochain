"""
Graph AI Anomaly Detection Module
===================================
Uses a Graph Autoencoder (GAE) with a GCN encoder trained on the
transaction graph to detect anomalous Ethereum addresses (spammers /
unusual high-volume senders).

PyTorch Geometric import is guarded so this module can be imported
even when torch_geometric is not installed — the guard is only triggered
on the ML-specific functions.

Public API
----------
build_graph_from_transactions(transactions)  -> dict
graph_dict_to_pyg_data(graph_dict)           -> pyg Data
run_anomaly_detection(transactions, epochs)  -> dict
get_node_stats(transactions, address)        -> dict
get_graph_summary(transactions)              -> dict

Classes
-------
GCNEncoder              -- two-layer GCN encoder
GraphAnomalyDetector    -- trains GAE, scores nodes, flags anomalies
"""

import math
from collections import defaultdict
from datetime import datetime, timezone


# ── PyTorch / PyG optional import ────────────────────────────────────────────

try:
    import torch
    import torch.nn.functional as F
    from torch_geometric.data import Data
    from torch_geometric.nn import GAE, GCNConv
    _PYG_AVAILABLE = True
except ImportError:
    _PYG_AVAILABLE = False


# ── Constants ─────────────────────────────────────────────────────────────────

_REQUIRED_FIELDS = ("sender_eth", "receiver_eth", "file_type", "created_at")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_ts(ts_str: str) -> float:
    """Parse ISO timestamp string to Unix float. Handles naive + aware."""
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(ts_str, fmt)
            return dt.replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            pass
    return 0.0


def _minmax(values: list) -> list:
    """Min-max normalise a list of floats to [0, 1]. All-same -> all 0."""
    mn, mx = min(values), max(values)
    if mx == mn:
        return [0.0] * len(values)
    return [(v - mn) / (mx - mn) for v in values]


# ── Section 1 — Graph Builder ─────────────────────────────────────────────────

def build_graph_from_transactions(transactions: list) -> dict:
    """
    Convert a list of transaction dicts into a graph representation.

    Parameters
    ----------
    transactions : list of dicts, each must have:
                   sender_eth, receiver_eth, file_type, created_at

    Returns
    -------
    dict with keys:
        node_index, index_to_address, node_features,
        edge_index, edge_features, num_nodes, num_edges

    Raises
    ------
    ValueError if any transaction dict is missing a required field.
    """
    if not transactions:
        return {
            "node_index":       {},
            "index_to_address": {},
            "node_features":    [],
            "edge_index":       [[], []],
            "edge_features":    [],
            "num_nodes":        0,
            "num_edges":        0,
        }

    # Validate and collect addresses
    for txn in transactions:
        for field in _REQUIRED_FIELDS:
            if field not in txn:
                raise ValueError(f"Transaction missing required field: '{field}'")

    # Build node index
    all_addrs = []
    for txn in transactions:
        for addr in (txn["sender_eth"], txn["receiver_eth"]):
            if addr not in all_addrs:
                all_addrs.append(addr)

    node_index       = {addr: i for i, addr in enumerate(all_addrs)}
    index_to_address = {i: addr for addr, i in node_index.items()}
    N = len(node_index)

    # Raw node feature accumulators
    num_sent     = defaultdict(int)
    num_received = defaultdict(int)
    last_active  = defaultdict(float)

    # Build edges
    edge_src, edge_dst = [], []
    edge_ts, edge_ft   = [], []

    for txn in transactions:
        s = node_index[txn["sender_eth"]]
        d = node_index[txn["receiver_eth"]]
        ts = _parse_ts(str(txn["created_at"]))
        ft = 1.0 if str(txn.get("file_type", "image")).lower() == "audio" else 0.0

        edge_src.append(s); edge_dst.append(d)
        edge_ts.append(ts); edge_ft.append(ft)

        num_sent[s]     += 1
        num_received[d] += 1
        last_active[s]   = max(last_active[s], ts)
        last_active[d]   = max(last_active[d], ts)

    # Raw node feature lists (same order as node_index)
    raw_sent    = [float(num_sent[i])     for i in range(N)]
    raw_recv    = [float(num_received[i]) for i in range(N)]
    raw_active  = [last_active[i]         for i in range(N)]

    # Normalise
    norm_sent   = _minmax(raw_sent)
    norm_recv   = _minmax(raw_recv)
    norm_active = _minmax(raw_active)

    node_features = [
        [norm_sent[i], norm_recv[i], norm_active[i]] for i in range(N)
    ]

    # Normalise edge timestamps
    norm_ets = _minmax(edge_ts) if edge_ts else []
    edge_features = [[norm_ets[i], edge_ft[i]] for i in range(len(edge_src))]

    return {
        "node_index":       node_index,
        "index_to_address": index_to_address,
        "node_features":    node_features,
        "edge_index":       [edge_src, edge_dst],
        "edge_features":    edge_features,
        "num_nodes":        N,
        "num_edges":        len(edge_src),
    }


def graph_dict_to_pyg_data(graph_dict: dict):
    """
    Convert the dict from build_graph_from_transactions to a PyG Data object.

    Returns
    -------
    torch_geometric.data.Data with x (N,3), edge_index (2,E), edge_attr (E,2)

    Raises
    ------
    ImportError if torch_geometric is not installed.
    """
    if not _PYG_AVAILABLE:
        raise ImportError("torch_geometric is not installed")

    N = graph_dict["num_nodes"]
    E = graph_dict["num_edges"]

    if N == 0:
        x          = torch.zeros((0, 3), dtype=torch.float32)
        edge_index = torch.zeros((2, 0), dtype=torch.long)
        edge_attr  = torch.zeros((0, 2), dtype=torch.float32)
        return Data(x=x, edge_index=edge_index, edge_attr=edge_attr)

    x = torch.tensor(graph_dict["node_features"], dtype=torch.float32)

    if E == 0:
        edge_index = torch.zeros((2, 0), dtype=torch.long)
        edge_attr  = torch.zeros((0, 2), dtype=torch.float32)
    else:
        edge_index = torch.tensor(graph_dict["edge_index"], dtype=torch.long)
        edge_attr  = torch.tensor(graph_dict["edge_features"], dtype=torch.float32)

    return Data(x=x, edge_index=edge_index, edge_attr=edge_attr)


# ── Section 2 — GCN Encoder and Graph Autoencoder ───────────────────────────

if _PYG_AVAILABLE:
    class GCNEncoder(torch.nn.Module):
        """Two-layer GCN encoder for the Graph Autoencoder."""

        def __init__(self, in_channels: int, hidden_channels: int, out_channels: int):
            super().__init__()
            self.conv1 = GCNConv(in_channels,  hidden_channels)
            self.conv2 = GCNConv(hidden_channels, out_channels)

        def forward(self, x, edge_index):
            x = F.relu(self.conv1(x, edge_index))
            x = self.conv2(x, edge_index)
            return x

else:
    # Stub so the name is importable even without PyG
    class GCNEncoder:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            raise ImportError("torch_geometric is not installed")


class GraphAnomalyDetector:
    """
    Wraps PyTorch Geometric GAE for training and inference.
    Uses adjacency reconstruction error as the anomaly score.
    """

    def __init__(
        self,
        in_channels:     int = 3,
        hidden_channels: int = 16,
        out_channels:    int = 8,
    ):
        if not _PYG_AVAILABLE:
            raise ImportError("torch_geometric is not installed")
        self.encoder   = GCNEncoder(in_channels, hidden_channels, out_channels)
        self.model     = GAE(self.encoder)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=0.01)
        self.is_trained = False
        self.threshold  = 0.7

    # ── Training ──────────────────────────────────────────────────────────

    def train(self, data, epochs: int = 100) -> list:
        """
        Train the GAE using link-prediction loss.

        Parameters
        ----------
        data   : PyG Data object (from graph_dict_to_pyg_data)
        epochs : number of training epochs

        Returns
        -------
        list of float loss values (one per epoch)
        """
        self.model.train()
        losses = []

        for epoch in range(1, epochs + 1):
            self.optimizer.zero_grad()
            z    = self.model.encode(data.x, data.edge_index)
            loss = self.model.recon_loss(z, data.edge_index)
            loss.backward()
            self.optimizer.step()
            losses.append(float(loss))

            if epoch % 10 == 0:
                print(f"  [GAE] Epoch {epoch:03d} | Loss: {float(loss):.4f}")

        self.is_trained = True
        return losses

    # ── Scoring ───────────────────────────────────────────────────────────

    def compute_anomaly_scores(self, data) -> dict:
        """
        Compute per-node reconstruction error as anomaly score.

        Returns
        -------
        dict mapping node_index (int) -> anomaly_score (float 0.0-1.0)

        Raises
        ------
        RuntimeError if model has not been trained yet.
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before computing anomaly scores")

        self.model.eval()
        N = data.x.shape[0]

        with torch.no_grad():
            z     = self.model.encode(data.x, data.edge_index)
            a_hat = torch.sigmoid(z @ z.T)   # (N, N) reconstructed adj

        # Build dense actual adjacency
        a_real = torch.zeros(N, N, dtype=torch.float32)
        if data.edge_index.shape[1] > 0:
            src = data.edge_index[0]
            dst = data.edge_index[1]
            a_real[src, dst] = 1.0

        # Per-node MSE between reconstructed and actual row
        errors = ((a_hat - a_real) ** 2).mean(dim=1).cpu().numpy()

        # Min-max normalise to [0, 1]
        mn, mx = float(errors.min()), float(errors.max())
        if mx == mn:
            scores_norm = [0.0] * N
        else:
            scores_norm = [(float(e) - mn) / (mx - mn) for e in errors]

        return {i: round(float(s), 6) for i, s in enumerate(scores_norm)}

    def get_flagged_nodes(self, data, index_to_address: dict) -> list:
        """
        Return nodes with anomaly_score >= threshold, sorted descending.

        Returns
        -------
        list of dicts: { address, node_index, anomaly_score, flagged: True }
        """
        scores = self.compute_anomaly_scores(data)
        flagged = []
        for idx, score in scores.items():
            if score >= self.threshold:
                flagged.append({
                    "address":      index_to_address.get(idx, f"node_{idx}"),
                    "node_index":   idx,
                    "anomaly_score": score,
                    "flagged":      True,
                })
        flagged.sort(key=lambda x: x["anomaly_score"], reverse=True)
        return flagged

    # ── Persistence ───────────────────────────────────────────────────────

    def save_model(self, path: str) -> None:
        """Save model state dict to path."""
        torch.save(self.model.state_dict(), path)

    def load_model(self, path: str) -> None:
        """Load model state dict from path and mark as trained."""
        self.model.load_state_dict(torch.load(path, weights_only=True))
        self.is_trained = True


# ── Section 3 — High-Level Pipeline Functions ─────────────────────────────────

def run_anomaly_detection(transactions: list, epochs: int = 100) -> dict:
    """
    Full pipeline: build graph -> train GAE -> score -> flag.

    If fewer than 2 nodes or 0 edges, skips training and returns all
    scores as 0.0 with empty flagged list.

    Returns
    -------
    dict: num_nodes, num_edges, anomaly_scores, flagged_nodes, threshold, trained_epochs
    """
    graph_dict = build_graph_from_transactions(transactions)
    N, E = graph_dict["num_nodes"], graph_dict["num_edges"]

    if N < 2 or E < 2:
        scores = {i: 0.0 for i in range(N)}
        return {
            "num_nodes":      N,
            "num_edges":      E,
            "anomaly_scores": scores,
            "flagged_nodes":  [],
            "threshold":      0.7,
            "trained_epochs": 0,
        }

    data      = graph_dict_to_pyg_data(graph_dict)
    detector  = GraphAnomalyDetector()
    detector.train(data, epochs=epochs)
    scores    = detector.compute_anomaly_scores(data)
    flagged   = detector.get_flagged_nodes(data, graph_dict["index_to_address"])

    return {
        "num_nodes":      N,
        "num_edges":      E,
        "anomaly_scores": scores,
        "flagged_nodes":  flagged,
        "threshold":      detector.threshold,
        "trained_epochs": epochs,
    }


def get_node_stats(transactions: list, address: str) -> dict:
    """
    Return statistics for a specific Ethereum address.

    Returns
    -------
    dict: address, num_sent, num_received, total_interactions,
          unique_receivers, unique_senders, first_seen, last_seen
    """
    sent, received = [], []
    for txn in transactions:
        if txn.get("sender_eth") == address:
            sent.append(txn)
        if txn.get("receiver_eth") == address:
            received.append(txn)

    if not sent and not received:
        return {
            "address":            address,
            "num_sent":           0,
            "num_received":       0,
            "total_interactions": 0,
            "unique_receivers":   0,
            "unique_senders":     0,
            "first_seen":         None,
            "last_seen":          None,
        }

    all_txns = sent + received
    timestamps = sorted([str(t.get("created_at", "")) for t in all_txns])

    return {
        "address":            address,
        "num_sent":           len(sent),
        "num_received":       len(received),
        "total_interactions": len(sent) + len(received),
        "unique_receivers":   len({t["receiver_eth"] for t in sent}),
        "unique_senders":     len({t["sender_eth"]   for t in received}),
        "first_seen":         timestamps[0],
        "last_seen":          timestamps[-1],
    }


def get_graph_summary(transactions: list) -> dict:
    """
    Return overall network statistics.

    Returns
    -------
    dict: total_nodes, total_edges, most_active_sender, most_active_receiver,
          avg_out_degree, avg_in_degree, time_span_hours
    """
    if not transactions:
        return {
            "total_nodes":         0,
            "total_edges":         0,
            "most_active_sender":  None,
            "most_active_receiver": None,
            "avg_out_degree":      0.0,
            "avg_in_degree":       0.0,
            "time_span_hours":     0.0,
        }

    addrs       = set()
    out_degree  = defaultdict(int)
    in_degree   = defaultdict(int)
    timestamps  = []

    for txn in transactions:
        s = txn.get("sender_eth", "")
        d = txn.get("receiver_eth", "")
        addrs.add(s); addrs.add(d)
        out_degree[s] += 1
        in_degree[d]  += 1
        ts = _parse_ts(str(txn.get("created_at", "")))
        if ts > 0:
            timestamps.append(ts)

    N = len(addrs)
    E = len(transactions)

    most_sender   = max(out_degree, key=out_degree.get) if out_degree else None
    most_receiver = max(in_degree,  key=in_degree.get)  if in_degree  else None

    span_hours = 0.0
    if len(timestamps) >= 2:
        span_hours = (max(timestamps) - min(timestamps)) / 3600.0

    return {
        "total_nodes":          N,
        "total_edges":          E,
        "most_active_sender":   most_sender,
        "most_active_receiver": most_receiver,
        "avg_out_degree":       round(E / N, 6) if N else 0.0,
        "avg_in_degree":        round(E / N, 6) if N else 0.0,
        "time_span_hours":      round(span_hours, 4),
    }
