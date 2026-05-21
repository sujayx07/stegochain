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
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em", margin: 0 }}>Blockchain Ledger</h1>
              <p style={{ fontSize: 14, color: "#78716C", margin: "4px 0 0" }}>All your on-chain steganographic records</p>
            </div>
            <motion.button onClick={handleRefresh} className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <motion.svg animate={{ rotate: refreshing ? 360 : 0 }} transition={{ duration: 0.6, repeat: refreshing ? Infinity : 0, ease: "linear" }}
                width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12 7A5 5 0 1 1 2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 7V3.5M12 3.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </motion.svg>
              Refresh
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <motion.div className="card card-hover" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            style={{ padding: "18px 22px", flex: 1, minWidth: 150, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -16, right: -16, fontSize: 48, opacity: 0.04 }}>⛓</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#F97316", letterSpacing: "-0.02em" }}>{stats?.total_records ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#78716C", marginTop: 3, fontWeight: 500 }}>Total Records</div>
          </motion.div>
          <motion.div className="card card-hover" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ padding: "18px 22px", flex: 1, minWidth: 150, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -16, right: -16, fontSize: 48, opacity: 0.04 }}>👤</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#F97316", letterSpacing: "-0.02em" }}>{stats?.total_users ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#78716C", marginTop: 3, fontWeight: 500 }}>Registered Users</div>
          </motion.div>
          <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ padding: "18px 22px", flex: 2, minWidth: 240 }}>
            <div style={{ fontSize: 11, color: "#78716C", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Contract Address</div>
            {CONTRACT && <HashDisplay value={CONTRACT} type="address"/>}
          </motion.div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#A8A29E", pointerEvents: "none" }}>
              <circle cx="6" cy="6" r="4" stroke="#A8A29E" strokeWidth="1.5"/>
              <path d="M10 10l2 2" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input className="input-field" placeholder="Search by record ID or session…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }}/>
          </div>
          <div style={{ display: "flex", background: "#F8F7F5", borderRadius: 10, padding: 4, border: "1.5px solid #E7E5E4", gap: 2 }}>
            {[
              { id: "all",      label: `All (${sent.length + received.length})` },
              { id: "sent",     label: `Sent (${sent.length})` },
              { id: "received", label: `Received (${received.length})` },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                padding: "7px 14px", borderRadius: 8, border: "none",
                background: filter === f.id ? "white" : "transparent",
                color: filter === f.id ? "#1C1917" : "#78716C",
                fontWeight: filter === f.id ? 700 : 500, cursor: "pointer", fontSize: 13,
                boxShadow: filter === f.id ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.18s", fontFamily: "Inter, sans-serif",
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Records list */}
        {isLoading ? (
          <LoadingSkeleton type="card" count={4}/>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1917", marginBottom: 6 }}>No records found</div>
            <div style={{ fontSize: 14, color: "#78716C" }}>
              {search ? `No results for "${search}"` : "Your blockchain records will appear here"}
            </div>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <RecordCard record={r} showActions onVerify={handleVerify} onRevoke={r => setRevokeTarget(r)}/>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Revoke Modal */}
      <AnimatePresence>
        {revokeTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={e => e.target === e.currentTarget && setRevokeTarget(null)}
          >
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ background: "white", borderRadius: 24, padding: 36, maxWidth: 440, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#DC2626,#EF4444)", borderRadius: "24px 24px 0 0" }} />
              <div style={{ fontSize: 44, textAlign: "center", marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#1C1917", textAlign: "center", marginBottom: 12 }}>Revoke Record?</h3>
              <p style={{ fontSize: 14, color: "#78716C", textAlign: "center", lineHeight: 1.7, marginBottom: 28 }}>
                Are you sure you want to revoke record <strong style={{ color: "#1C1917" }}>#{revokeTarget.record_id || revokeTarget.id}</strong>?{" "}
                This action is <strong>permanent</strong>. The receiver will no longer be able to decrypt this message.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button className="btn-secondary" style={{ flex: 1 }} whileHover={{ scale: 1.02 }} onClick={() => setRevokeTarget(null)}>Cancel</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleRevoke} disabled={revoking}
                  style={{ flex: 1, background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "white", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14, opacity: revoking ? 0.7 : 1, fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {revoking ? <><div className="spinner spinner-sm" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: "white", borderColor: "rgba(255,255,255,0.3)" }}/> Revoking…</> : "🚫 Revoke"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
