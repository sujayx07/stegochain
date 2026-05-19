// frontend/pages/anomaly.js
import Head from "next/head";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { flagNode, getAnomalyScores, getGraphSummary, getNodeStats } from "../utils/api";

function ScoreBadge({ score }) {
  const color = score >= 0.7 ? "#ef4444" : score >= 0.5 ? "#f59e0b" : "#22c55e";
  const bg    = score >= 0.7 ? "rgba(239,68,68,0.12)" : score >= 0.5 ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)";
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color, backgroundColor: bg }}>
      {score.toFixed(3)}
    </span>
  );
}

export default function AnomalyPage() {
  const [summary,   setSummary]   = useState(null);
  const [epochs,    setEpochs]    = useState(100);
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [lookup,    setLookup]    = useState("");
  const [nodeStats, setNodeStats] = useState(null);
  const [flagModal, setFlagModal] = useState(null);
  const [flagReason, setFlagReason] = useState("");
  const [toast,     setToast]     = useState("");

  useEffect(() => { getGraphSummary().then(setSummary).catch(() => {}); }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function runAnalysis() {
    setLoading(true); setResult(null);
    try { setResult(await getAnomalyScores(epochs)); }
    catch (e) { showToast("Analysis failed: " + e.message); }
    finally { setLoading(false); }
  }

  async function handleLookup(e) {
    e.preventDefault();
    try { setNodeStats(await getNodeStats(lookup)); }
    catch (e) { showToast("Lookup failed: " + e.message); }
  }

  async function submitFlag() {
    try {
      await flagNode({ address: flagModal, reason: flagReason || "manual flag" });
      showToast(`Node ${flagModal.slice(0, 10)}... flagged`);
    } catch (e) { showToast("Flag failed: " + e.message); }
    finally { setFlagModal(null); setFlagReason(""); }
  }

  const scoreEntries = result?.anomaly_scores
    ? Object.entries(result.anomaly_scores).sort(([, a], [, b]) => b - a)
    : [];

  const statBox = (label, value) => (
    <div key={label} className="flex flex-col items-center gap-1 px-6 py-4"
      style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e", borderRadius: "10px" }}>
      <span className="text-xl font-bold mono" style={{ color: "#6366f1" }}>{value ?? "—"}</span>
      <span className="text-xs uppercase tracking-wider" style={{ color: "#94a3b8" }}>{label}</span>
    </div>
  );

  return (
    <>
      <Head><title>Anomaly Detection — StegoChain</title></Head>
      <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0f" }}>
        <Navbar />
        <main className="max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#e2e8f0" }}>Network Anomaly Detection</h1>
          <p className="mb-8" style={{ color: "#94a3b8" }}>Graph Autoencoder detects suspicious Ethereum addresses based on communication patterns.</p>

          {/* Summary stats */}
          {summary && (
            <div className="flex flex-wrap gap-4 mb-10">
              {statBox("Total Nodes",       summary.total_nodes)}
              {statBox("Total Edges",       summary.total_edges)}
              {statBox("Top Sender",        summary.most_active_sender ? summary.most_active_sender.slice(0, 10) + "..." : "—")}
              {statBox("Time Span (hrs)",   summary.time_span_hours?.toFixed(2))}
            </div>
          )}

          {/* Run analysis */}
          <div className="flex items-center gap-4 mb-8">
            <div>
              <label className="text-sm mr-2" style={{ color: "#94a3b8" }}>Epochs:</label>
              <input type="number" value={epochs} min={10} max={500}
                onChange={e => setEpochs(Number(e.target.value))}
                style={{ width: "80px", backgroundColor: "#13131a", border: "1px solid #1e1e2e", color: "#e2e8f0", borderRadius: "6px", padding: "6px 10px", fontSize: "14px" }} />
            </div>
            <button onClick={runAnalysis} disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold"
              style={{ backgroundColor: "#6366f1", color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? "Training Graph Autoencoder..." : "Run Analysis"}
            </button>
          </div>

          {/* Results table */}
          {result && (
            <div className="mb-10">
              <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)" }}>
                <p className="text-sm" style={{ color: "#e2e8f0" }}>
                  <strong>{result.flagged_nodes?.length}</strong> of <strong>{result.num_nodes}</strong> nodes flagged as anomalous
                  &nbsp;(threshold: <span style={{ color: "#f59e0b" }}>{result.threshold}</span>)
                  &nbsp;| Trained <span className="mono">{result.trained_epochs}</span> epochs
                </p>
              </div>
              <div style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e", borderRadius: "10px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#0a0a0f" }}>
                      {["Node", "Address", "Score", "Status", "Action"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #1e1e2e" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scoreEntries.map(([idx, score]) => {
                      const addr    = result.flagged_nodes?.find(f => String(f.node_index) === idx)?.address || `node_${idx}`;
                      const flagged = parseFloat(score) >= (result.threshold || 0.7);
                      return (
                        <tr key={idx}>
                          <td style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e2e", color: "#94a3b8", fontSize: "13px" }}>#{idx}</td>
                          <td style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e2e" }}>
                            <span className="mono text-xs" style={{ color: "#e2e8f0" }} title={addr}>{addr.slice(0, 16)}...</span>
                          </td>
                          <td style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e2e" }}><ScoreBadge score={parseFloat(score)} /></td>
                          <td style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e2e" }}>
                            {flagged
                              ? <span style={{ color: "#ef4444", fontSize: "12px" }}>⚠️ Flagged</span>
                              : <span style={{ color: "#22c55e", fontSize: "12px" }}>Normal</span>}
                          </td>
                          <td style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e2e" }}>
                            {flagged && (
                              <button onClick={() => setFlagModal(addr)}
                                style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "4px", backgroundColor: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}>
                                Flag Node
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Node lookup */}
          <div style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e", borderRadius: "12px", padding: "24px" }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: "#e2e8f0" }}>Node Lookup</h2>
            <form onSubmit={handleLookup} className="flex gap-3 mb-4">
              <input value={lookup} onChange={e => setLookup(e.target.value)} placeholder="0x Ethereum address..."
                style={{ flex: 1, backgroundColor: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", borderRadius: "6px", padding: "8px 12px", fontSize: "13px", fontFamily: "'JetBrains Mono', monospace" }} />
              <button type="submit" style={{ padding: "8px 16px", backgroundColor: "#6366f1", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Lookup</button>
            </form>
            {nodeStats && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[["Sent", nodeStats.num_sent], ["Received", nodeStats.num_received],
                  ["Unique Receivers", nodeStats.unique_receivers], ["Unique Senders", nodeStats.unique_senders],
                  ["First Seen", nodeStats.first_seen], ["Last Seen", nodeStats.last_seen]].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-2" style={{ borderBottom: "1px solid #1e1e2e" }}>
                    <span style={{ color: "#94a3b8" }}>{l}</span>
                    <span className="mono text-xs" style={{ color: "#e2e8f0" }}>{v ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Flag modal */}
        {flagModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
            <div className="rounded-xl p-8 max-w-sm w-full" style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e" }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "#e2e8f0" }}>Flag Node</h3>
              <p className="mono text-xs mb-4" style={{ color: "#ef4444" }}>{flagModal}</p>
              <input value={flagReason} onChange={e => setFlagReason(e.target.value)} placeholder="Reason (optional)"
                style={{ width: "100%", backgroundColor: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", borderRadius: "6px", padding: "8px 12px", fontSize: "13px", marginBottom: "16px" }} />
              <div className="flex gap-3">
                <button onClick={() => setFlagModal(null)} style={{ flex: 1, padding: "10px", backgroundColor: "#1e1e2e", color: "#94a3b8", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
                <button onClick={submitFlag} style={{ flex: 1, padding: "10px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Flag</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 px-5 py-3 rounded-lg text-sm" style={{ backgroundColor: "#13131a", border: "1px solid #6366f1", color: "#e2e8f0" }}>{toast}</div>
        )}
      </div>
    </>
  );
}
