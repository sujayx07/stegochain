import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import RecordCard from "../components/RecordCard";
import HashDisplay from "../components/HashDisplay";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { getMySent, getMyReceived, getMe, api } from "../utils/api";

/* ── Stat mini card ─────────────────────────────────────── */
function MiniStat({ icon, label, value, color }) {
  return (
    <motion.div whileHover={{ y: -2 }}
      style={{ flex: 1, minWidth: 90, padding: "14px 16px", background: "white", borderRadius: 12, border: "1.5px solid #E7E5E4", textAlign: "center", cursor: "default" }}
    >
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "#F97316", lineHeight: 1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 11, color: "#78716C", marginTop: 3, fontWeight: 500 }}>{label}</div>
    </motion.div>
  );
}

/* ── Avatar ─────────────────────────────────────────────── */
function Avatar({ letter, size = 64 }) {
  const colors = ["#F97316","#3B82F6","#8B5CF6","#EC4899","#10B981","#F59E0B"];
  const color  = colors[letter?.charCodeAt(0) % colors.length] || "#F97316";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: "white", boxShadow: `0 4px 14px ${color}40`, letterSpacing: "-0.02em", flexShrink: 0 }}>
      {letter?.toUpperCase() || "?"}
    </div>
  );
}

/* ── Quick action button ────────────────────────────────── */
function QuickBtn({ href, icon, label, sub, primary }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          background: primary ? "linear-gradient(135deg,#F97316,#EA6C0A)" : "white",
          border: `1.5px solid ${primary ? "transparent" : "#E7E5E4"}`,
          borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
          boxShadow: primary ? "0 4px 14px rgba(249,115,22,0.25)" : "none",
        }}
      >
        <div style={{ fontSize: 20, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: primary ? "white" : "#1C1917" }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: primary ? "rgba(255,255,255,0.75)" : "#78716C", marginTop: 1 }}>{sub}</div>}
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: "auto", opacity: 0.6 }}>
          <path d="M4 7h6M8 5l2 2-2 2" stroke={primary ? "white" : "#78716C"} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </motion.div>
    </Link>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const { address, registerOnChain, isConnected, isCorrectChain, connect, switchToSepolia } = useWallet();
  const [sent, setSent]                   = useState([]);
  const [received, setReceived]           = useState([]);
  const [loadingSent, setLoadingSent]     = useState(true);
  const [loadingRec, setLoadingRec]       = useState(true);
  const [chainStatus, setChainStatus]     = useState(null);
  const [registeringChain, setRegisteringChain] = useState(false);
  const [activeTab, setActiveTab]         = useState("sent");
  const prevRecCount = useRef(0);

  const BASESCAN = process.env.NEXT_PUBLIC_BASESCAN_URL || "https://sepolia.etherscan.io";

  useEffect(() => { if (!loading && !isAuthenticated) router.push("/login"); }, [loading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    getMe().then(me => setChainStatus(me.chain_registered === true)).catch(() => {});
    const interval = setInterval(async () => {
      try {
        const data = await getMyReceived();
        const recs = data.records || data || [];
        if (recs.length > prevRecCount.current) toast("📨 New message received!", { icon: "🔔" });
        prevRecCount.current = recs.length;
        setReceived(recs);
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  async function completeChainReg() {
    if (!user) return;
    if (!isConnected) { try { await connect(); } catch { toast.error("Connect MetaMask first."); return; } }
    if (!isCorrectChain) {
      toast("Switching to Ethereum Sepolia…", { icon: "🔄" });
      try { await switchToSepolia(); } catch { toast.error("Switch MetaMask to Ethereum Sepolia."); return; }
    }
    setRegisteringChain(true);
    try {
      const me = await getMe();
      if (!me.public_key_x || !me.public_key_y) { toast.error("No ECC key pair found. Please re-register."); return; }
      toast("MetaMask will open — confirm the transaction.", { icon: "🦊" });
      const chainRes = await registerOnChain(me.public_key_x, me.public_key_y);
      if (chainRes.alreadyRegistered) {
        await api.post("/api/auth/register-chain-manual", { tx_hash: "already-registered" });
        setChainStatus(true);
        toast.success("✅ Already registered on-chain! Status synced.");
      } else {
        await api.post("/api/auth/register-chain-manual", { tx_hash: chainRes.txHash });
        setChainStatus(true);
        toast.success(`✅ Registered on-chain! Tx: ${chainRes.txHash.slice(0,10)}…`);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes("user rejected") || msg.includes("User denied")) toast("Transaction cancelled.", { icon: "❌" });
      else toast.error("Registration failed: " + msg);
    } finally { setRegisteringChain(false); }
  }

  async function fetchData() {
    setLoadingSent(true); setLoadingRec(true);
    try { const s = await getMySent(); setSent(s.records || s || []); } catch {} finally { setLoadingSent(false); }
    try {
      const r = await getMyReceived();
      const recs = r.records || r || [];
      prevRecCount.current = recs.length; setReceived(recs);
    } catch {} finally { setLoadingRec(false); }
  }

  if (loading) return null;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em", margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: "#78716C", margin: "4px 0 0" }}>Your StegoChain activity and account overview</p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,320px) 1fr", gap: 24, alignItems: "start" }}>

          {/* ── Left sidebar ──────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Profile card */}
            <motion.div className="card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              style={{ padding: 24, overflow: "hidden", position: "relative" }}
            >
              {/* Decorative bg */}
              <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.08),transparent 70%)", pointerEvents: "none" }} />

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, position: "relative" }}>
                <Avatar letter={user?.username?.[0]} size={68} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "#1C1917", letterSpacing: "-0.01em" }}>{user?.username}</div>
                  <div style={{ fontSize: 13, color: "#78716C", marginTop: 2 }}>{user?.email}</div>
                </div>

                {address && <HashDisplay value={address} type="address" />}

                {/* Chain status */}
                {chainStatus === true && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="badge badge-success" style={{ fontSize: 12 }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    Registered on-chain
                  </motion.div>
                )}

                {chainStatus === false && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: "100%" }}>
                    <div style={{ padding: "12px 14px", background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 12, marginBottom: 10, animation: "borderPulse 2s ease infinite" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#C2410C", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>⚠️</span> Not registered on blockchain
                      </div>
                      <div style={{ fontSize: 11, color: "#78716C", lineHeight: 1.6, marginBottom: 10 }}>
                        You must register on-chain before you can send or receive messages.
                      </div>
                      <motion.button className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        style={{ width: "100%", fontSize: 12, padding: "9px 14px" }}
                        onClick={completeChainReg} disabled={registeringChain}
                      >
                        {registeringChain ? (
                          <><div className="spinner spinner-sm" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: "white", flexShrink: 0 }}/> Waiting for MetaMask…</>
                        ) : "🦊 Complete On-Chain Registration"}
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {chainStatus === null && (
                  <div style={{ fontSize: 12, color: "#A8A29E", display: "flex", alignItems: "center", gap: 6 }}>
                    <div className="spinner spinner-sm" style={{ width: 12, height: 12, borderWidth: 2 }}/> Checking chain status…
                  </div>
                )}

                {address && (
                  <a href={`${BASESCAN}/address/${address}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#F97316", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    View on Etherscan <span>↗</span>
                  </a>
                )}
              </div>
            </motion.div>

            {/* Stats mini */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            >
              <MiniStat icon="📤" label="Sent" value={loadingSent ? "…" : sent.length} color="#F97316" />
              <MiniStat icon="📥" label="Received" value={loadingRec ? "…" : received.length} color="#16A34A" />
            </motion.div>

            {/* Quick actions */}
            <motion.div className="card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              style={{ padding: 20 }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#78716C", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Quick Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <QuickBtn href="/send"    icon="📤" label="Send Message"    sub="Hide a message in media"  primary />
                <QuickBtn href="/receive" icon="📥" label="Retrieve Message" sub="Decrypt with MetaMask" />
                <QuickBtn href="/ledger"  icon="📋" label="View Ledger"     sub="All on-chain records" />
                <QuickBtn href="/anomaly" icon="🧠" label="AI Anomaly"      sub="Graph neural network" />
              </div>
            </motion.div>
          </div>

          {/* ── Right content ─────────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "#F8F7F5", borderRadius: 12, padding: 4, border: "1.5px solid #E7E5E4" }}>
              {[{ id: "sent", label: "📤 Sent", count: sent.length }, { id: "received", label: "📥 Received", count: received.length }].map(tab => (
                <motion.button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: activeTab === tab.id ? "white" : "transparent",
                    color: activeTab === tab.id ? "#1C1917" : "#78716C",
                    fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 14, fontFamily: "Inter, sans-serif",
                    boxShadow: activeTab === tab.id ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {tab.label}
                  <span style={{
                    background: activeTab === tab.id ? "#FFF0E6" : "#F0EDE9",
                    color: activeTab === tab.id ? "#F97316" : "#A8A29E",
                    borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700,
                  }}>
                    {tab.count}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {activeTab === "sent" && (
                <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                  <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917" }}>Sent Messages</div>
                      <Link href="/ledger" style={{ fontSize: 13, color: "#F97316", textDecoration: "none", fontWeight: 600 }}>View all →</Link>
                    </div>
                    {loadingSent ? <LoadingSkeleton type="card" count={3} /> : sent.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "48px 0" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", marginBottom: 4 }}>No messages sent yet</div>
                        <div style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>Send your first hidden message</div>
                        <Link href="/send" style={{ textDecoration: "none" }}>
                          <motion.button className="btn-primary" whileHover={{ scale: 1.02 }} style={{ padding: "10px 24px" }}>📤 Send Message</motion.button>
                        </Link>
                      </motion.div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {sent.slice(0, 8).map((r, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <RecordCard record={r} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "received" && (
                <motion.div key="received" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                  <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917" }}>Received Messages</div>
                      {received.length > 0 && (
                        <span className="badge badge-success">{received.length} messages</span>
                      )}
                    </div>
                    {loadingRec ? <LoadingSkeleton type="card" count={3} /> : received.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "48px 0" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📥</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", marginBottom: 4 }}>No messages received yet</div>
                        <div style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>Messages sent to your address will appear here</div>
                        <Link href="/receive" style={{ textDecoration: "none" }}>
                          <motion.button className="btn-secondary" whileHover={{ scale: 1.02 }} style={{ padding: "10px 24px" }}>Decrypt a Message</motion.button>
                        </Link>
                      </motion.div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {received.slice(0, 8).map((r, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <RecordCard record={r} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </>
  );
}
