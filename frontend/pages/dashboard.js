import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import RecordCard from "../components/RecordCard";
import HashDisplay from "../components/HashDisplay";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { getMySent, getMyReceived, getMe, api } from "../utils/api";

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const { address, registerOnChain } = useWallet();
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [loadingSent, setLoadingSent] = useState(true);
  const [loadingRec, setLoadingRec] = useState(true);
  const [chainStatus, setChainStatus] = useState(null); // null=unknown, true=registered, false=not registered
  const [registeringChain, setRegisteringChain] = useState(false);
  const prevRecCount = useRef(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/login");
  }, [loading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    // Check on-chain registration status
    getMe().then(me => {
      setChainStatus(me.chain_registered === true);
    }).catch(() => {});

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
    setRegisteringChain(true);
    try {
      // Fetch the user's public keys from the backend
      const me = await getMe();
      if (!me.public_key_x || !me.public_key_y) {
        toast.error("No ECC key pair found. Please re-register."); return;
      }
      toast("MetaMask will ask you to sign the on-chain registration transaction.", { icon: "🦊" });
      const chainRes = await registerOnChain(me.public_key_x, me.public_key_y);
      // Notify backend
      await api.post("/api/auth/register-chain-manual", { tx_hash: chainRes.txHash });
      setChainStatus(true);
      toast.success(`✅ On-chain registration confirmed! Tx: ${chainRes.txHash.slice(0,10)}…`);
    } catch (err) {
      toast.error("Chain registration failed: " + err.message);
    } finally {
      setRegisteringChain(false);
    }
  }

  async function fetchData() {
    setLoadingSent(true); setLoadingRec(true);
    try {
      const s = await getMySent();
      setSent(s.records || s || []);
    } catch {} finally { setLoadingSent(false); }
    try {
      const r = await getMyReceived();
      const recs = r.records || r || [];
      prevRecCount.current = recs.length;
      setReceived(recs);
    } catch {} finally { setLoadingRec(false); }
  }

  const BASESCAN = process.env.NEXT_PUBLIC_BASESCAN_URL || "https://sepolia.etherscan.io";

  if (loading) return null;

  return (
    <>
      <Navbar/>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 26, fontWeight: 700, color: "#1C1917", marginBottom: 24 }}>
          Dashboard
        </motion.h1>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>

          {/* Left — Profile */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, fontWeight: 700, color: "white"
                }}>
                  {user?.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1917" }}>{user?.username}</div>
                  <div style={{ fontSize: 13, color: "#78716C" }}>{user?.email}</div>
                </div>
                {address && <HashDisplay value={address} type="address"/>}
                {chainStatus === true && (
                  <span className="badge-success">✓ Registered on-chain</span>
                )}
                {chainStatus === false && (
                  <div style={{ width: "100%" }}>
                    <div style={{ padding: "10px 14px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#C2410C", marginBottom: 6 }}>⚠️ Not registered on blockchain</div>
                      <div style={{ fontSize: 11, color: "#78716C", marginBottom: 8 }}>You must register on-chain before you can send or receive messages.</div>
                      <button
                        className="btn-primary"
                        style={{ width: "100%", fontSize: 12, padding: "8px 12px" }}
                        onClick={completeChainReg}
                        disabled={registeringChain}
                      >
                        {registeringChain ? "Waiting for MetaMask…" : "🦊 Complete On-Chain Registration"}
                      </button>
                    </div>
                  </div>
                )}
                {chainStatus === null && (
                  <span style={{ fontSize: 12, color: "#A8A29E" }}>Checking chain status…</span>
                )}
                {address && (
                  <a href={`${BASESCAN}/address/${address}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#F97316", textDecoration: "none" }}>
                    View on Etherscan →
                  </a>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1C1917", marginBottom: 14 }}>Quick Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link href="/send"><button className="btn-primary" style={{ width: "100%" }}>📤 Send Message</button></Link>
                <Link href="/receive"><button className="btn-secondary" style={{ width: "100%" }}>📥 Receive Message</button></Link>
                <Link href="/ledger"><button className="btn-secondary" style={{ width: "100%" }}>📋 View Ledger</button></Link>
              </div>
            </div>
          </div>

          {/* Right — Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Sent */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#1C1917" }}>Sent Messages</div>
                <Link href="/ledger" style={{ fontSize: 13, color: "#F97316", textDecoration: "none" }}>View all →</Link>
              </div>
              {loadingSent ? <LoadingSkeleton type="card" count={2}/> : sent.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#A8A29E" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
                  <div style={{ fontSize: 14 }}>No messages sent yet</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sent.slice(0, 5).map((r, i) => <RecordCard key={i} record={r}/>)}
                </div>
              )}
            </div>

            {/* Received */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#1C1917", marginBottom: 16 }}>Received Messages</div>
              {loadingRec ? <LoadingSkeleton type="card" count={2}/> : received.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#A8A29E" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📥</div>
                  <div style={{ fontSize: 14 }}>No messages received yet</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {received.slice(0, 5).map((r, i) => <RecordCard key={i} record={r}/>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
