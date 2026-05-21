import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import { getBlockchainStats, getGraphSummary } from "../utils/api";

function useCountUp(target, duration = 1500) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

function StatCard({ label, value, link }) {
  const animated = useCountUp(typeof value === "number" ? value : null);
  return (
    <div className="card" style={{ padding: "20px 24px", flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#F97316" }}>
        {typeof value === "number" ? animated.toLocaleString() : (value || "—")}
      </div>
      <div style={{ fontSize: 13, color: "#78716C", marginTop: 4 }}>{label}</div>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#F97316", textDecoration: "none", marginTop: 4, display: "block" }}>View on Etherscan →</a>}
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);
  const [graph, setGraph] = useState(null);
  const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const BASESCAN = process.env.NEXT_PUBLIC_BASESCAN_URL;

  useEffect(() => {
    getBlockchainStats().then(setStats).catch(() => {});
    getGraphSummary().then(setGraph).catch(() => {});
  }, []);

  return (
    <>
      <Navbar/>
      <main style={{ minHeight: "100vh", background: "#F8F7F5" }}>

        {/* Hero */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          {/* Particle decorations */}
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 8 + (i * 4), height: 8 + (i * 4),
              borderRadius: "50%",
              background: "#F97316",
              opacity: 0.07 + i * 0.015,
              top: `${15 + i * 12}%`,
              left: `${5 + i * 15}%`,
              animation: `float${i} ${4 + i}s ease-in-out infinite`,
              pointerEvents: "none"
            }}/>
          ))}

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            {/* Hero SVG illustration */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                <rect x="10" y="10" width="100" height="80" rx="12" stroke="#E7E5E4" strokeWidth="3" fill="white"/>
                <rect x="30" y="30" width="60" height="40" rx="6" fill="#FFF0E6"/>
                <rect x="40" y="40" width="40" height="6" rx="3" fill="#F97316" opacity="0.4"/>
                <rect x="40" y="52" width="28" height="6" rx="3" fill="#F97316" opacity="0.25"/>
                <circle cx="80" cy="80" r="28" fill="white" stroke="#E7E5E4" strokeWidth="2"/>
                <rect x="66" y="76" width="28" height="20" rx="4" fill="#F97316"/>
                <path d="M70 76v-5a10 10 0 0 1 20 0v5" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="80" cy="85" r="2.5" fill="white"/>
              </svg>
            </div>

            <h1 style={{ fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 800, color: "#1C1917", lineHeight: 1.1, marginBottom: 20 }}>
              Secure{" "}
              <span style={{
                background: "linear-gradient(135deg, #F97316, #EA6C0A)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
              }}>
                Hidden
              </span>{" "}
              Communication
            </h1>

            <p style={{ fontSize: 18, color: "#78716C", maxWidth: 580, margin: "0 auto 36px", lineHeight: 1.7 }}>
              StegoChain embeds encrypted secret messages inside ordinary images and audio files,
              then anchors proof of delivery on the Ethereum Sepolia blockchain — invisible to everyone except the intended receiver.
            </p>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/send">
                <button className="btn-primary" style={{ padding: "14px 32px", fontSize: 16 }}>
                  📤 Send a Message
                </button>
              </Link>
              <Link href="/receive">
                <button className="btn-secondary" style={{ padding: "14px 32px", fontSize: 16 }}>
                  📥 Retrieve Message
                </button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Stats Bar */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 60px" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Messages on Chain" value={stats?.total_records ?? null}/>
            <StatCard label="Network Nodes" value={graph?.total_nodes ?? null}/>
            <StatCard label="Contract on Ethereum Sepolia" value="StegoChainV2" link={CONTRACT ? `${BASESCAN}/address/${CONTRACT}` : null}/>
          </div>
        </section>

        {/* Feature Cards */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 70px" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 700, marginBottom: 36, color: "#1C1917" }}>Three layers of protection</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              {
                icon: "👁‍🗨",
                title: "Steganography",
                sub: "Hide in plain sight",
                desc: "Your message is embedded directly into pixel data (LSB for images) or echo delays (audio) — the media file looks and sounds completely normal."
              },
              {
                icon: "⛓",
                title: "Blockchain Verified",
                sub: "Tamper-proof ledger",
                desc: "A Merkle root of your encrypted key fragments is registered on Ethereum Sepolia. Any tampering breaks the Merkle proof and is instantly detected."
              },
              {
                icon: "🔑",
                title: "Threshold Encryption",
                sub: "Fragmented key access",
                desc: "Your AES key is split into fragments stored on IPFS. Only the receiver can reconstruct the key by proving ownership on-chain with a MetaMask signature."
              }
            ].map((card, i) => (
              <motion.div
                key={i}
                className="card"
                whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                style={{ padding: 28, transition: "all 0.2s" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.3 }}
              >
                <div style={{ fontSize: 36, marginBottom: 14 }}>{card.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1C1917", marginBottom: 4 }}>{card.title}</h3>
                <div style={{ fontSize: 13, color: "#F97316", fontWeight: 500, marginBottom: 10 }}>{card.sub}</div>
                <p style={{ fontSize: 14, color: "#78716C", lineHeight: 1.65, margin: 0 }}>{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section style={{ background: "white", padding: "60px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 700, marginBottom: 48, color: "#1C1917" }}>How it works</h2>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", gap: 0 }}>
              {[
                { n: 1, icon: "📁", label: "Upload", desc: "Upload a cover image or audio file" },
                { n: 2, icon: "🔒", label: "Hide", desc: "Message is hidden using steganography" },
                { n: 3, icon: "⛓", label: "Anchor", desc: "Encrypted & stored on IPFS with blockchain proof" },
                { n: 4, icon: "🔓", label: "Decrypt", desc: "Receiver proves identity on-chain to decrypt" },
              ].map((step, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 140, textAlign: "center" }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%",
                      background: "#FFF0E6", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24, border: "2px solid #FED7AA"
                    }}>
                      {step.icon}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1917" }}>
                      <span style={{ color: "#F97316" }}>{step.n}. </span>{step.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#78716C", lineHeight: 1.5 }}>{step.desc}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: 48, height: 2, background: "linear-gradient(to right, #F97316, #FED7AA)", margin: "0 8px", flexShrink: 0 }}/>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: "1px solid #E7E5E4", padding: "30px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" fill="#F97316" opacity="0.15"/>
              <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" stroke="#F97316" strokeWidth="1.5" fill="none"/>
            </svg>
            <span style={{ fontWeight: 700, color: "#1C1917" }}>StegoChain</span>
          </div>
          <div style={{ fontSize: 12, color: "#78716C", marginBottom: 8 }}>Final Year Project — Blockchain + Steganography + AI</div>
          {CONTRACT && (
            <a href={`${BASESCAN}/address/${CONTRACT}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#F97316", textDecoration: "none" }}>
              View Contract on Etherscan →
            </a>
          )}
        </footer>

        <style>{`
          @keyframes float0 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
          @keyframes float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
          @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
          @keyframes float3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-15px)} }
          @keyframes float4 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
          @keyframes float5 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        `}</style>
      </main>
    </>
  );
}
