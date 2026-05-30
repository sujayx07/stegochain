import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import HashDisplay from "../components/HashDisplay";
import { getGraphSummary, getAnomalyScores, getNodeStats, flagNode } from "../utils/api";
import { truncateAddress } from "../utils/crypto";
import { Cpu } from "../components/Icons";

const TRAINING_MESSAGES = [
  "Building communication graph…",
  "Computing node embeddings…",
  "Reconstructing adjacency matrix…",
  "Scoring anomalies…",
];

function ScoreBar({ score }) {
  const color = score < 0.5 ? "#1A9F4A" : score < 0.7 ? "#CF8100" : "#E03131";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#F5F5F5", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${score * 100}%`, height: "100%", background: color, transition: "width 0.5s ease", borderRadius: 4 }}/>
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 40 }}>{score.toFixed(3)}</span>
    </div>
  );
}

export default function Anomaly() {
  const [summary, setSummary] = useState(null);
  const [epochs, setEpochs] = useState(100);
  const [running, setRunning] = useState(false);
  const [trainingMsg, setTrainingMsg] = useState(0);
  const [results, setResults] = useState(null);
  const [lookup, setLookup] = useState("");
  const [nodeStats, setNodeStats] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [flagModal, setFlagModal] = useState(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    getGraphSummary().then(setSummary).catch(() => {});
  }, []);

  useEffect(() => {
    if (!running) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % TRAINING_MESSAGES.length;
      setTrainingMsg(i);
    }, 1200);
    return () => clearInterval(interval);
  }, [running]);

  async function handleRun() {
    setRunning(true);
    setResults(null);
    setTrainingMsg(0);
    try {
      const data = await getAnomalyScores(epochs);
      setResults(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleLookup() {
    if (!lookup.trim()) return;
    setLookupLoading(true);
    try {
      const data = await getNodeStats(lookup.trim());
      setNodeStats(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLookupLoading(false); }
  }

  async function handleFlag() {
    setFlagging(true);
    try {
      await flagNode({ address: flagModal, reason: flagReason });
      toast.success("Node flagged successfully");
      setFlagModal(null);
      setFlagReason("");
    } catch (err) {
      toast.error(err.message);
    } finally { setFlagging(false); }
  }

  const scores = results?.scores || [];
  const flagged = scores.filter(s => s.score > 0.7);

  return (
    <>
      <Navbar/>
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111111", marginBottom: 4 }}>Network Anomaly Detection</h1>
          <p style={{ fontSize: 14, color: "#888888" }}>AI-powered communication pattern analysis using Graph Neural Networks</p>
        </motion.div>

        {/* Network Summary */}
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Total Nodes", value: summary.total_nodes },
              { label: "Total Edges", value: summary.total_edges },
              { label: "Most Active", value: summary.most_active_sender ? truncateAddress(summary.most_active_sender) : "—" },
              { label: "Time Span", value: summary.time_span || "—" },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: "14px 18px" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#E8680C", fontFamily: i === 2 ? "monospace" : undefined }}>{s.value ?? "—"}</div>
                <div style={{ fontSize: 12, color: "#888888", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Run Analysis */}
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111111", marginBottom: 16 }}>Run Anomaly Analysis</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#111111", display: "block", marginBottom: 6 }}>Epochs</label>
              <input
                type="number" min={50} max={500} value={epochs}
                onChange={e => setEpochs(Number(e.target.value))}
                className="input-field" style={{ width: 100 }}
              />
            </div>
            <button className="btn-primary" style={{ alignSelf: "flex-end", padding: "10px 24px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={handleRun} disabled={running}>
              {running ? "Analysing…" : <><Cpu size={14} /> Run Analysis</>}
            </button>
          </div>
          {running && (
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid #FFF4EB", borderTopColor: "#E8680C", animation: "spin 0.8s linear infinite" }}/>
              <span style={{ fontSize: 14, color: "#888888" }}>{TRAINING_MESSAGES[trainingMsg]}</span>
            </div>
          )}
        </div>

        {/* Results */}
        <AnimatePresence>
          {results && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 28, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111111" }}>Analysis Results</h2>
                <span style={{ fontSize: 13, color: flagged.length > 0 ? "#E03131" : "#1A9F4A" }}>
                  {flagged.length} of {scores.length} nodes flagged (threshold 0.7)
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #EBEBEB" }}>
                      {["#", "Address", "Anomaly Score", "Status", "Action"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#888888", fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F5F5F5" }}>
                        <td style={{ padding: "10px 12px", color: "#BBBBBB" }}>{i + 1}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span className="mono" style={{ fontSize: 11 }}>{truncateAddress(s.address || s.node)}</span>
                        </td>
                        <td style={{ padding: "10px 12px", minWidth: 160 }}><ScoreBar score={s.score}/></td>
                        <td style={{ padding: "10px 12px" }}>
                          {s.score > 0.7 ? <span className="badge-danger">Flagged</span> : <span className="badge-success">Normal</span>}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => setFlagModal(s.address || s.node)} style={{
                            background: "none", border: "1px solid #EBEBEB", color: "#888888",
                            borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer"
                          }}>
                            Flag
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Node Lookup */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111111", marginBottom: 16 }}>Node Lookup</h2>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input className="input-field mono" placeholder="0x… Ethereum address" value={lookup}
              onChange={e => setLookup(e.target.value)} style={{ flex: 1 }}/>
            <button className="btn-primary" onClick={handleLookup} disabled={lookupLoading}>
              {lookupLoading ? "…" : "Lookup"}
            </button>
          </div>
          {nodeStats && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                {[
                  ["Sent", nodeStats.sent],
                  ["Received", nodeStats.received],
                  ["Interactions", nodeStats.total_interactions],
                  ["Unique Contacts", nodeStats.unique_contacts],
                  ["First Seen", nodeStats.first_seen],
                  ["Last Seen", nodeStats.last_seen],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: "#FAFAFA", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#111111" }}>{v ?? "—"}</div>
                    <div style={{ fontSize: 11, color: "#888888", marginTop: 2 }}>{k}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Flag Modal */}
      <AnimatePresence>
        {flagModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 400, width: "100%" }}>
              <h3 style={{ fontWeight: 700, color: "#111111", marginBottom: 8 }}>Flag Node</h3>
              <div className="mono" style={{ fontSize: 11, color: "#888888", marginBottom: 16 }}>{flagModal}</div>
              <textarea className="input-field" rows={3} placeholder="Reason for flagging…" value={flagReason}
                onChange={e => setFlagReason(e.target.value)} style={{ resize: "none", marginBottom: 14 }}/>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setFlagModal(null); setFlagReason(""); }}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleFlag} disabled={flagging || !flagReason}>
                  {flagging ? "Flagging…" : "Flag Node"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
