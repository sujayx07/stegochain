// frontend/pages/ledger.js
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import LedgerTable from "../components/LedgerTable";
import Navbar from "../components/Navbar";
import { getBlockchainRecord, getBlockchainStats, revokeRecord, verifyRecord } from "../utils/api";

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 right-6 px-5 py-3 rounded-lg font-medium text-sm z-50"
      style={{ backgroundColor: type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
               border: `1px solid ${type === "success" ? "#22c55e" : "#ef4444"}`,
               color:  type === "success" ? "#22c55e" : "#ef4444" }}>
      {msg}
    </div>
  );
}

export default function LedgerPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total,   setTotal]   = useState(0);
  const [jumpId,  setJumpId]  = useState("");
  const [toast,   setToast]   = useState({ msg: "", type: "success" });
  const [revokeModal, setRevokeModal] = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  }

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await getBlockchainStats();
      const n = Math.min(Number(stats.total_records) || 0, 50);
      setTotal(n);
      const fetched = await Promise.allSettled(
        Array.from({ length: n }, (_, i) => getBlockchainRecord(i))
      );
      setRecords(fetched.filter(r => r.status === "fulfilled").map(r => r.value));
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function handleVerify(id) {
    try {
      const rec = records.find(r => (r.record_id ?? r.id) === id);
      await verifyRecord({ record_id: id, cid: rec?.cid || "", merkle_root: rec?.merkle_root || "" });
      showToast("Record verified ✅");
    } catch { showToast("Verification failed ❌", "error"); }
  }

  async function confirmRevoke() {
    const id = revokeModal; setRevokeModal(null);
    try { await revokeRecord(id); showToast(`Record #${id} revoked`); loadRecords(); }
    catch (e) { showToast(e.message || "Revoke failed", "error"); }
  }

  return (
    <>
      <Head><title>Blockchain Ledger — StegoChain</title></Head>
      <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0f" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: "#e2e8f0" }}>Blockchain Ledger</h1>
              <p style={{ color: "#94a3b8" }}>{total} record{total !== 1 ? "s" : ""} on-chain</p>
            </div>
            <button onClick={loadRecords}
              style={{ padding: "8px 16px", backgroundColor: "#13131a", border: "1px solid #1e1e2e", color: "#94a3b8", borderRadius: "8px", cursor: "pointer" }}>
              🔄 Refresh
            </button>
          </div>
          <form onSubmit={e => { e.preventDefault(); document.querySelector(`[data-testid="record-row-${jumpId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
            className="flex gap-3 mb-6">
            <input value={jumpId} onChange={e => setJumpId(e.target.value)} placeholder="Jump to Record ID..."
              style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e", color: "#e2e8f0", borderRadius: "6px", padding: "8px 12px", fontSize: "14px", width: "220px" }} />
            <button type="submit" style={{ padding: "8px 16px", backgroundColor: "#6366f1", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Jump</button>
          </form>
          <LedgerTable records={records} loading={loading} onVerify={handleVerify} onRevoke={setRevokeModal} />
        </main>

        {revokeModal !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
            <div className="rounded-xl p-8 max-w-sm w-full" style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e" }}>
              <h3 className="text-lg font-semibold mb-3" style={{ color: "#e2e8f0" }}>Confirm Revocation</h3>
              <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>Revoke record <span className="mono" style={{ color: "#ef4444" }}>#{revokeModal}</span>? This is permanent.</p>
              <div className="flex gap-3">
                <button onClick={() => setRevokeModal(null)} style={{ flex: 1, padding: "10px", backgroundColor: "#1e1e2e", color: "#94a3b8", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
                <button onClick={confirmRevoke} style={{ flex: 1, padding: "10px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Revoke</button>
              </div>
            </div>
          </div>
        )}
        <Toast msg={toast.msg} type={toast.type} />
      </div>
    </>
  );
}
