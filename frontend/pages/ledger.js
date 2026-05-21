import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import RecordCard from "../components/RecordCard";
import HashDisplay from "../components/HashDisplay";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useAuth } from "../context/AuthContext";
import { getMySent, getMyReceived, getBlockchainStats, verifyIntegrity, revokeRecord } from "../utils/api";

export default function Ledger() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const BASESCAN = process.env.NEXT_PUBLIC_BASESCAN_URL;

  useEffect(() => { if (!loading && !isAuthenticated) router.push("/login"); }, [loading, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchAll();
  }, [isAuthenticated]);

  async function fetchAll() {
    setIsLoading(true);
    try {
      const [s, r, st] = await Promise.allSettled([getMySent(), getMyReceived(), getBlockchainStats()]);
      if (s.status === "fulfilled") setSent(s.value.records || s.value || []);
      if (r.status === "fulfilled") setReceived(r.value.records || r.value || []);
      if (st.status === "fulfilled") setStats(st.value);
    } finally { setIsLoading(false); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
    toast.success("Refreshed");
  }

  async function handleVerify(record) {
    try {
      const res = await verifyIntegrity({ record_id: record.record_id || record.id });
      toast.success(res.valid ? "✓ Integrity verified" : "⚠ Integrity check failed");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeRecord(revokeTarget.record_id || revokeTarget.id);
      toast.success("Record revoked");
      setSent(prev => prev.map(r => r.record_id === revokeTarget.record_id ? { ...r, revoked: true } : r));
      setRevokeTarget(null);
    } catch (err) {
      toast.error(err.message);
    } finally { setRevoking(false); }
  }

  const allRecords = filter === "sent" ? sent : filter === "received" ? received : [...sent, ...received];
  const filtered = allRecords.filter(r => !search || (r.record_id || r.session_id || "").toLowerCase().includes(search.toLowerCase()));

  if (loading) return null;

  return (
    <>
      <Navbar/>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ fontSize: 24, fontWeight: 700, color: "#1C1917", marginBottom: 4 }}>
              Blockchain Ledger
            </motion.h1>
            <p style={{ fontSize: 14, color: "#78716C" }}>All your on-chain records</p>
          </div>
          <button onClick={handleRefresh} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
              <path d="M12 7A5 5 0 1 1 2 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M12 7V3.5M12 3.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <div className="card" style={{ padding: "12px 20px", flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#F97316" }}>{stats?.total_records ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#78716C" }}>Total Records</div>
          </div>
          <div className="card" style={{ padding: "12px 20px", flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#F97316" }}>{stats?.total_users ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#78716C" }}>Registered Users</div>
          </div>
          <div className="card" style={{ padding: "12px 20px", flex: 2, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: "#78716C", marginBottom: 4 }}>Contract Address</div>
            {CONTRACT && <HashDisplay value={CONTRACT} type="address"/>}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input className="input-field" placeholder="Search by record ID or session…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }}/>
          {["all", "sent", "received"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "9px 18px", borderRadius: 9, border: "1px solid",
              borderColor: filter === f ? "#F97316" : "#E7E5E4",
              background: filter === f ? "#FFF0E6" : "white",
              color: filter === f ? "#F97316" : "#78716C",
              fontWeight: filter === f ? 600 : 400, cursor: "pointer", fontSize: 13,
              textTransform: "capitalize"
            }}>
              {f}
            </button>
          ))}
        </div>

        {/* Records */}
        {isLoading ? (
          <LoadingSkeleton type="card" count={3}/>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "#A8A29E" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16 }}>No records found</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((r, i) => (
              <RecordCard key={i} record={r} showActions onVerify={handleVerify} onRevoke={r => setRevokeTarget(r)}/>
            ))}
          </div>
        )}
      </main>

      {/* Revoke Modal */}
      <AnimatePresence>
        {revokeTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              style={{ background: "white", borderRadius: 20, padding: 32, maxWidth: 420, width: "100%" }}>
              <div style={{ fontSize: 40, textAlign: "center", marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1C1917", textAlign: "center", marginBottom: 12 }}>Revoke Record?</h3>
              <p style={{ fontSize: 14, color: "#78716C", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>
                Are you sure you want to revoke record <strong>#{revokeTarget.record_id || revokeTarget.id}</strong>?
                This action is permanent and cannot be undone. The receiver will no longer be able to decrypt this message.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setRevokeTarget(null)}>Cancel</button>
                <button onClick={handleRevoke} disabled={revoking} style={{
                  flex: 1, background: "#DC2626", color: "white", border: "none",
                  borderRadius: 10, padding: "10px 20px", fontWeight: 500, cursor: "pointer",
                  opacity: revoking ? 0.7 : 1
                }}>
                  {revoking ? "Revoking…" : "Revoke"}
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
