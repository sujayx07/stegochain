import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import { getBlockchainStats, getGraphSummary } from "../utils/api";

/* ── Count-up hook ─────────────────────────────────────────── */
function useCountUp(target, duration = 1600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let raf;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(ease * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf); // cleanup on unmount
  }, [target]);
  return val;
}

/* ── Animated stat card — CSS animation, no JS observer ──── */
function StatCard({ label, value, icon, link, delay = 0 }) {
  const animated = useCountUp(typeof value === "number" ? value : null);
  return (
    <div
      className="card card-hover"
      style={{ padding: "24px 28px", flex: 1, minWidth: 180, position: "relative", overflow: "hidden", animation: `fadeUp 0.5s ease forwards ${delay}s`, opacity: 0 }}
    >
      <div style={{ position: "absolute", top: -20, right: -20, fontSize: 64, opacity: 0.04, userSelect: "none" }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#F97316", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {typeof value === "number" ? animated.toLocaleString() : (value || "—")}
      </div>
      <div style={{ fontSize: 13, color: "#78716C", marginTop: 6, fontWeight: 500 }}>{label}</div>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#F97316", textDecoration: "none", marginTop: 8, fontWeight: 600, letterSpacing: "0.02em" }}>
          View on Etherscan <span style={{ fontSize: 12 }}>↗</span>
        </a>
      )}
    </div>
  );
}

/* ── Feature card — CSS animation ───────────────────────── */
function FeatureCard({ icon, title, sub, desc, delay }) {
  return (
    <div
      className="card card-hover"
      style={{ padding: "32px 28px", cursor: "default", animation: `fadeUp 0.5s ease forwards ${delay + 0.1}s`, opacity: 0 }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#FFF0E6,#FFE4CC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 18, border: "1px solid #FED7AA" }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#F97316", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{sub}</div>
      <h3 style={{ fontSize: 19, fontWeight: 700, color: "#1C1917", marginBottom: 10, letterSpacing: "-0.01em" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#78716C", lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </div>
  );
}

/* ── Pipeline step — CSS animation ───────────────────── */
function PipeStep({ n, icon, label, desc, active, delay }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 130, textAlign: "center", animation: `fadeUp 0.4s ease forwards ${delay}s`, opacity: 0 }}
    >
      <div
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(249,115,22,0.25)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
        style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#FFF0E6,#FFE4CC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "2px solid #FED7AA", position: "relative", transition: "all 0.25s ease", cursor: "default" }}
      >
        {icon}
        <div style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: "#F97316", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1917" }}>{label}</div>
      <div style={{ fontSize: 12, color: "#78716C", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

/* ── Floating orb — pure CSS, no JS animation, no blur ────── */
// REMOVED: filter:blur + JS animate was causing GPU jank on every frame
function FloatingOrb({ size, x, y, delay, color }) {
  return (
    <div style={{
      position: "absolute", width: size, height: size, borderRadius: "50%",
      background: color, top: y, left: x, pointerEvents: "none", zIndex: 0,
      animation: `float ${6}s ease-in-out ${delay}s infinite`,
    }}/>
  );
}

/* ── Tech badge — plain div with CSS hover ────────────────── */
function TechBadge({ label }) {
  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "white", border: "1.5px solid #E7E5E4", fontSize: 12, fontWeight: 600, color: "#1C1917", boxShadow: "0 2px 6px rgba(0,0,0,0.04)", cursor: "default", transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#FED7AA"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E7E5E4"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {label}
    </div>
  );
}

const TECH_STACK = ["Ethereum Sepolia", "Solidity 0.8.19", "IPFS + Pinata", "AES-256-GCM", "ECC P-256", "PyTorch Geometric", "Next.js 14", "MetaMask"];

export default function Home() {
  const [stats, setStats] = useState(null);
  const [graph, setGraph] = useState(null);
  const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const BASESCAN = process.env.NEXT_PUBLIC_BASESCAN_URL;

  useEffect(() => {
    // Load stats immediately (lightweight call)
    getBlockchainStats().then(setStats).catch(() => {});
    // Defer graph summary — it's slower and not needed for first paint
    const t = setTimeout(() => getGraphSummary().then(setGraph).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", background: "#F8F7F5", overflowX: "hidden" }}>

        {/* ── Hero ──────────────────────────────────────────── */}
        <section style={{ position: "relative", maxWidth: 1100, margin: "0 auto", padding: "90px 24px 70px", textAlign: "center", overflow: "hidden" }}>
          {/* Background orbs */}
          <FloatingOrb size={400} x="-10%" y="-5%" delay={0} color="rgba(249,115,22,0.06)" />
          <FloatingOrb size={300} x="70%" y="10%" delay={2} color="rgba(245,158,11,0.05)" />
          <FloatingOrb size={200} x="40%" y="50%" delay={4} color="rgba(249,115,22,0.04)" />

          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#FFF0E6", border: "1.5px solid #FED7AA", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: "#F97316", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 28 }}
          >
            <div className="pulse-dot-orange" style={{ width: 6, height: 6 }}/> Live on Ethereum Sepolia
          </motion.div>

          {/* Heading */}
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ fontSize: "clamp(38px,7vw,66px)", fontWeight: 900, color: "#1C1917", lineHeight: 1.08, marginBottom: 24, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}
          >
            Secret Messages,{" "}
            <span style={{ background: "linear-gradient(135deg,#F97316 0%,#F59E0B 50%,#EA6C0A 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Hidden in Plain Sight
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            style={{ fontSize: 18, color: "#78716C", maxWidth: 600, margin: "0 auto 44px", lineHeight: 1.75, position: "relative", zIndex: 1 }}
          >
            StegoChain embeds encrypted messages inside ordinary images and audio files, then anchors cryptographic proof on the Ethereum blockchain — <strong style={{ color: "#1C1917" }}>invisible to everyone</strong> except the intended receiver.
          </motion.p>

          {/* CTA buttons */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", position: "relative", zIndex: 1 }}
          >
            <Link href="/send" style={{ textDecoration: "none" }}>
              <motion.button whileHover={{ scale: 1.04, boxShadow: "0 12px 32px rgba(249,115,22,0.3)" }} whileTap={{ scale: 0.97 }}
                className="btn-primary" style={{ padding: "15px 36px", fontSize: 16, borderRadius: 12 }}
              >
                📤 Send a Message
              </motion.button>
            </Link>
            <Link href="/receive" style={{ textDecoration: "none" }}>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="btn-secondary" style={{ padding: "15px 36px", fontSize: 16, borderRadius: 12 }}
              >
                📥 Retrieve Message
              </motion.button>
            </Link>
          </motion.div>

          {/* Hero visual */}
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            style={{ marginTop: 60, position: "relative", zIndex: 1 }}
          >
            <div style={{ background: "white", borderRadius: 20, border: "1.5px solid #E7E5E4", padding: 24, maxWidth: 540, margin: "0 auto", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                {["#FF5F57","#FEBC2E","#28C840"].map((c,i) => <div key={i} style={{ width:12,height:12,borderRadius:"50%",background:c }}/>)}
                <div style={{ flex:1, background:"#F8F7F5", borderRadius:6, padding:"4px 12px", fontSize:11, color:"#78716C", fontFamily:"monospace" }}>stegochain.app/send</div>
              </div>
              {/* Mini pipeline visualization */}
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {["📁 Upload","🔒 Encrypt","📡 IPFS","⛓ Chain","🔑 Key Frags"].map((step, i, arr) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.12 }}
                      style={{ flex: 1, textAlign: "center", padding: "8px 4px", background: i === 2 ? "#FFF0E6" : "#F8F7F5", borderRadius: 8, fontSize: 10, fontWeight: 600, color: i === 2 ? "#F97316" : "#78716C", border: i === 2 ? "1.5px solid #FED7AA" : "1px solid transparent", whiteSpace: "nowrap" }}
                    >
                      {step}
                    </motion.div>
                    {i < arr.length - 1 && (
                      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.7 + i * 0.12 }}
                        style={{ width: 16, height: 2, background: "linear-gradient(to right,#FED7AA,#F97316)", flexShrink: 0, transformOrigin: "left" }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: "#F0FDF4", borderRadius: 3, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: "0%" }} animate={{ width: "67%" }} transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                    style={{ height: "100%", background: "linear-gradient(90deg,#16A34A,#22C55E)", borderRadius: 3 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>67%</span>
                <span style={{ fontSize: 11, color: "#78716C" }}>Encrypting…</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Stats Bar ─────────────────────────────────────── */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 70px" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Messages on Chain" value={stats?.total_records ?? null} icon="⛓" delay={0} />
            <StatCard label="Network Nodes" value={graph?.total_nodes ?? null} icon="◈" delay={0.1} />
            <StatCard label="Ethereum Sepolia" value="StegoChainV2" icon="⬡" link={CONTRACT ? `${BASESCAN}/address/${CONTRACT}` : null} delay={0.2} />
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              style={{ fontSize: 11, fontWeight: 700, color: "#F97316", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}
            >Seven Layers of Protection</motion.div>
            <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{ fontSize: "clamp(24px,4vw,38px)", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}
            >
              Security you can <span className="gradient-text">verify on-chain</span>
            </motion.h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
            {[
              { icon: "👁", title: "Steganographic Hiding", sub: "LSB + Echo Hiding", desc: "Your message is embedded inside pixel data (LSB for images) or echo delays (audio). The file looks and sounds completely normal to any observer.", delay: 0 },
              { icon: "🔒", title: "AES-256-GCM Encryption", sub: "Military-grade cipher", desc: "Before hiding, your message is encrypted with AES-256-GCM — the same cipher used by governments and banks. 2²⁵⁶ possible keys. Brute force is impossible.", delay: 0.1 },
              { icon: "🔑", title: "ECC Key Exchange", sub: "P-256 ECDH + ECDSA", desc: "Your AES key is derived via Elliptic Curve Diffie-Hellman. Keys are never transmitted — both parties derive the same secret independently.", delay: 0.2 },
              { icon: "⛓", title: "Blockchain Verified", sub: "Ethereum Sepolia • Immutable", desc: "A Merkle root of encrypted key fragments is permanently registered on-chain. The smart contract is the judge — no admin can override it.", delay: 0.3 },
              { icon: "📡", title: "IPFS Decentralised Storage", sub: "Content-addressed • Pinata", desc: "Files live on IPFS identified by cryptographic CIDs. Any tampering changes the hash instantly. No central server can delete or alter your files.", delay: 0.4 },
              { icon: "🧠", title: "Graph AI Monitoring", sub: "PyTorch Geometric GAE", desc: "A Graph Autoencoder continuously analyses communication patterns. Anomalous nodes — spam, data exfiltration, compromised devices — are flagged automatically.", delay: 0.5 },
            ].map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────── */}
        <section style={{ background: "white", padding: "80px 24px", borderTop: "1px solid #F0EDE9", borderBottom: "1px solid #F0EDE9" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                style={{ fontSize: 11, fontWeight: 700, color: "#F97316", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}
              >The Complete Pipeline</motion.div>
              <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                style={{ fontSize: "clamp(24px,4vw,38px)", fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}
              >How it works</motion.h2>
            </div>

            {/* Send pipeline */}
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#78716C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 24, textAlign: "center" }}>📤 Send Flow</div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", gap: 12 }}>
                {[
                  { n:1, icon:"📁", label:"Upload", desc:"Cover image or audio file" },
                  { n:2, icon:"🗝", label:"Embed", desc:"LSB / Echo hiding" },
                  { n:3, icon:"🔒", label:"Encrypt", desc:"AES-256-GCM" },
                  { n:4, icon:"📡", label:"IPFS", desc:"Upload encrypted file" },
                  { n:5, icon:"🧩", label:"Fragment", desc:"Split AES key → ECC encrypt" },
                  { n:6, icon:"⛓", label:"Chain", desc:"Register Merkle root on-chain" },
                ].map((s, i, arr) => (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <PipeStep {...s} delay={i * 0.08} />
                    {i < arr.length - 1 && (
                      <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 + 0.2 }}
                        style={{ width: 32, height: 2, background: "linear-gradient(to right,#F97316,#FED7AA)", margin: "0 4px", flexShrink: 0, marginBottom: 40, transformOrigin: "left" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Receive pipeline */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#78716C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 24, textAlign: "center" }}>📥 Receive Flow</div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", gap: 12 }}>
                {[
                  { n:1, icon:"🔍", label:"Lookup", desc:"Session ID → blockchain record" },
                  { n:2, icon:"🦊", label:"Sign", desc:"MetaMask identity proof" },
                  { n:3, icon:"✅", label:"Verify", desc:"On-chain Merkle proof + ecrecover" },
                  { n:4, icon:"🗝", label:"Reconstruct", desc:"ECDH → AES key" },
                  { n:5, icon:"🔓", label:"Decrypt", desc:"AES-GCM + steganography extract" },
                  { n:6, icon:"💬", label:"Reveal", desc:"Hidden message appears" },
                ].map((s, i, arr) => (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <PipeStep {...s} delay={i * 0.08 + 0.3} />
                    {i < arr.length - 1 && (
                      <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 + 0.5 }}
                        style={{ width: 32, height: 2, background: "linear-gradient(to right,#16A34A,#BBF7D0)", margin: "0 4px", flexShrink: 0, marginBottom: 40, transformOrigin: "left" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Tech Stack ────────────────────────────────────── */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "70px 24px" }}>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            style={{ textAlign: "center", marginBottom: 32 }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#F97316", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Built With</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em" }}>Production-grade stack</h2>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}
          >
            {TECH_STACK.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <TechBadge label={t} />
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── CTA Banner ────────────────────────────────────── */}
        <section style={{ padding: "0 24px 80px" }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ maxWidth: 700, margin: "0 auto", background: "linear-gradient(135deg,#1C1917 0%,#292524 100%)", borderRadius: 24, padding: "48px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}
          >
            <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(249,115,22,0.1)", filter: "blur(60px)" }}/>
            <div style={{ position: "absolute", bottom: -40, left: -40, width: 150, height: 150, borderRadius: "50%", background: "rgba(245,158,11,0.08)", filter: "blur(50px)" }}/>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🛡️</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "white", marginBottom: 12, letterSpacing: "-0.02em" }}>Ready to send your first hidden message?</h2>
              <p style={{ fontSize: 15, color: "#A8A29E", marginBottom: 28, lineHeight: 1.7 }}>Connect your MetaMask wallet and experience blockchain-verified steganographic communication.</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/send" style={{ textDecoration: "none" }}>
                  <motion.button whileHover={{ scale: 1.05, boxShadow: "0 12px 32px rgba(249,115,22,0.4)" }} whileTap={{ scale: 0.97 }}
                    className="btn-primary" style={{ padding: "13px 32px", fontSize: 15, borderRadius: 12 }}
                  >📤 Send a Message</motion.button>
                </Link>
                <Link href="/register" style={{ textDecoration: "none" }}>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: "13px 32px", fontSize: 15, background: "rgba(255,255,255,0.1)", color: "white", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 12, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                  >Create Account</motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Footer ────────────────────────────────────────── */}
        <footer style={{ borderTop: "1px solid #E7E5E4", padding: "36px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" fill="#F97316" opacity="0.15"/>
                <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" stroke="#F97316" strokeWidth="1.5"/>
                <path d="M9 14l3.5 3.5L19 11" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#1C1917" }}>Stego<span style={{ color: "#F97316" }}>Chain</span></span>
              <span style={{ fontSize: 12, color: "#A8A29E", marginLeft: 8 }}>Final Year Project · Blockchain + Steganography + AI</span>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {CONTRACT && (
                <a href={`${BASESCAN}/address/${CONTRACT}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#F97316", textDecoration: "none", fontWeight: 600 }}>
                  Contract ↗
                </a>
              )}
              <Link href="/ledger" style={{ fontSize: 12, color: "#78716C", textDecoration: "none" }}>Ledger</Link>
              <Link href="/anomaly" style={{ fontSize: 12, color: "#78716C", textDecoration: "none" }}>Anomaly AI</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
