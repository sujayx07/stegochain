import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import { getBlockchainStats, getGraphSummary } from "../utils/api";
import { Send, Receive, Lock, Unlock, Eye, Key, Network, Cloud, Cpu, Shield, Search } from "../components/Icons";
import dynamic from "next/dynamic";
import LiveCodingIDE from "../components/LiveCodingIDE";
import logoImg from "../Images/1.png";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import lottieData from "../lottie/e26c037a-117d-11ee-b994-57a4c574d94e.json";

/* ── Count-up hook ─────────────────────────────────────────── */
function useCountUp(target, duration = 1400) {
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
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

/* ── Stat card ─────────────────────────────────────────────── */
function StatCard({ label, value, icon: IconComponent, link, fallback, delay = 0, hasPortLeft = false, hasPortRight = false, hasPortTop = false, hasPortBottom = false }) {
  const activeValue = value !== null && value !== undefined ? value : fallback;
  const isFallback = (value === null || value === undefined) && fallback !== null && fallback !== undefined;
  const animated = useCountUp(typeof activeValue === "number" ? activeValue : null);
  
  const statusColor = isFallback ? "#E8680C" : "#1A9F4A";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.35 }}
      style={{
        flex: 1.2, minWidth: 200, padding: "26px 22px",
        background: "white", borderRadius: 14, border: "1.5px solid #EBEBEB",
        position: "relative", overflow: "visible",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.06)"; 
        e.currentTarget.style.transform = "translateY(-2px)"; 
        e.currentTarget.style.borderColor = "#F5B888"; 
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.boxShadow = "none"; 
        e.currentTarget.style.transform = "translateY(0)"; 
        e.currentTarget.style.borderColor = "#EBEBEB"; 
      }}
    >
      {/* Border connection ports */}
      {hasPortLeft && (
        <div className="port-horizontal port-glow" style={{ position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%", background: statusColor, border: "2.5px solid white", boxShadow: `0 0 6px ${statusColor}`, zIndex: 10, animation: isFallback ? "pulse-ring-orange 2.2s infinite" : "pulse-ring 2.2s infinite" }} />
      )}
      {hasPortRight && (
        <div className="port-horizontal port-glow" style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%", background: statusColor, border: "2.5px solid white", boxShadow: `0 0 6px ${statusColor}`, zIndex: 10, animation: isFallback ? "pulse-ring-orange 2.2s infinite" : "pulse-ring 2.2s infinite" }} />
      )}
      {hasPortTop && (
        <div className="port-vertical port-glow" style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, borderRadius: "50%", background: statusColor, border: "2.5px solid white", boxShadow: `0 0 6px ${statusColor}`, zIndex: 10, animation: isFallback ? "pulse-ring-orange 2.2s infinite" : "pulse-ring 2.2s infinite" }} />
      )}
      {hasPortBottom && (
        <div className="port-vertical port-glow" style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, borderRadius: "50%", background: statusColor, border: "2.5px solid white", boxShadow: `0 0 6px ${statusColor}`, zIndex: 10, animation: isFallback ? "pulse-ring-orange 2.2s infinite" : "pulse-ring 2.2s infinite" }} />
      )}

      <div style={{ position: "absolute", top: 14, right: 14, color: "#E8680C", opacity: 0.05, pointerEvents: "none" }}>
        {IconComponent && <IconComponent size={44} />}
      </div>
      
      <div style={{ 
        fontSize: typeof activeValue === "string" && activeValue.length > 8 ? 26 : 38, 
        fontWeight: 800, 
        color: "#E8680C", 
        letterSpacing: "-0.03em", 
        lineHeight: 1.1, 
        fontFamily: "'Outfit', sans-serif",
        whiteSpace: "nowrap"
      }}>
        {typeof activeValue === "number" ? animated.toLocaleString() : (activeValue || "\u2014")}
      </div>
      
      <div style={{ fontSize: 13, color: "#555", marginTop: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <span 
          style={{ 
            width: 7, 
            height: 7, 
            borderRadius: "50%", 
            background: statusColor, 
            display: "inline-block", 
            boxShadow: `0 0 4px ${statusColor}` 
          }} 
          title={isFallback ? "Live Simulation" : "On-Chain Live"}
        />
        {label}
      </div>
      
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "#E8680C", textDecoration: "none", marginTop: 12, fontWeight: 700 }}>
          View on Etherscan
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 7L7 3M7 3H4.5M7 3v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>
      )}

      <style>{`
        @media (max-width: 768px) {
          .port-horizontal { display: none !important; }
          .port-vertical { display: block !important; }
        }
        @media (min-width: 769px) {
          .port-horizontal { display: block !important; }
          .port-vertical { display: none !important; }
        }
      `}</style>
    </motion.div>
  );
}

/* ── Stats Connector ────────────────────────────────────────── */
function StatsConnector({ color = "#E8680C", isLive = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }} className="stats-connector-container">
      {/* Horizontal connector on desktop */}
      <svg className="connector-horizontal" viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: "100%", height: 20, display: "block" }}>
        <defs>
          <linearGradient id={`grad-h-${isLive}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
          <filter id="glow-h" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path d="M 0 10 L 100 10" stroke={color} strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="4 4" />
        <path d="M 0 10 L 100 10" stroke={`url(#grad-h-${isLive})`} strokeWidth="2.5" filter="url(#glow-h)" />
        <circle r="4" fill={color} filter="url(#glow-h)">
          <animateMotion dur="2.8s" repeatCount="indefinite" path="M 0 10 L 100 10" />
        </circle>
        <circle r="2.5" fill="#FFF">
          <animateMotion dur="2.8s" repeatCount="indefinite" path="M 0 10 L 100 10" />
        </circle>
      </svg>

      {/* Vertical connector on mobile */}
      <svg className="connector-vertical" viewBox="0 0 20 100" preserveAspectRatio="none" style={{ width: 20, height: 40, display: "none" }}>
        <defs>
          <linearGradient id={`grad-v-${isLive}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
          <filter id="glow-v" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path d="M 10 0 L 10 100" stroke={color} strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="4 4" />
        <path d="M 10 0 L 10 100" stroke={`url(#grad-v-${isLive})`} strokeWidth="2.5" filter="url(#glow-v)" />
        <circle r="4" fill={color} filter="url(#glow-v)">
          <animateMotion dur="2.8s" repeatCount="indefinite" path="M 10 0 L 10 100" />
        </circle>
        <circle r="2.5" fill="#FFF">
          <animateMotion dur="2.8s" repeatCount="indefinite" path="M 10 0 L 10 100" />
        </circle>
      </svg>

      <style>{`
        .stats-connector-container {
          flex: 1;
          min-width: 40px;
          max-width: 90px;
        }
        @media (max-width: 768px) {
          .stats-connector-container {
            flex: none;
            width: 100%;
            height: 40px;
            max-width: none;
            margin: 4px 0;
          }
          .connector-horizontal {
            display: none !important;
          }
          .connector-vertical {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ── Feature card ────────────────────────────────────────── */
function FeatureCard({ icon: IconComponent, title, sub, desc, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      style={{
        padding: "28px 24px", cursor: "default",
        background: "white", borderRadius: 14, border: "1px solid #EBEBEB",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "#F5B888"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#EBEBEB"; }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFF4EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#E8680C", marginBottom: 16 }}>
        {IconComponent && <IconComponent size={20} />}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#E8680C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{sub}</div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 1.3, fontFamily: "'Outfit', sans-serif" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </motion.div>
  );
}

/* ── Pipeline step ─────────────────────────────────────── */
function PipeStep({ n, icon: IconComponent, label, desc, delay, isActive, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        maxWidth: 110, textAlign: "center", cursor: "pointer"
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: "50%",
          background: isActive ? "#FFF4EB" : "#FCFCFC",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: isActive ? "#E8680C" : "#BBB",
          border: isActive ? "2px solid #E8680C" : "1.5px solid #EBEBEB",
          position: "relative",
          boxShadow: isActive ? "0 4px 12px rgba(232,104,12,0.15)" : "none",
          transition: "all 0.25s ease",
          transform: isActive ? "scale(1.08)" : "scale(1)"
        }}
      >
        {IconComponent && <IconComponent size={20} />}
        <div style={{
          position: "absolute", top: -3, right: -3, width: 18, height: 18,
          borderRadius: "50%", background: isActive ? "#E8680C" : "#DDD",
          color: "white", fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.25s ease"
        }}>{n}</div>
      </div>
      <div style={{
        fontWeight: 700, fontSize: 13,
        color: isActive ? "#E8680C" : "#555",
        fontFamily: "'Outfit', sans-serif",
        transition: "color 0.25s ease"
      }}>{label}</div>
      <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }} className="hidden-mobile">{desc}</div>
    </motion.div>
  );
}

/* ── Tech badge ─────────────────────────────────────────── */
function TechBadge({ label }) {
  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 20, background: "white", border: "1px solid #EBEBEB", fontSize: 13, fontWeight: 600, color: "#444", cursor: "default", transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#F5B888"; e.currentTarget.style.color = "#E8680C"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#EBEBEB"; e.currentTarget.style.color = "#444"; }}
    >
      {label}
    </div>
  );
}

const TECH_STACK = ["Ethereum Sepolia", "Solidity 0.8.19", "IPFS + Pinata", "AES-256-GCM", "ECC P-256", "PyTorch Geometric", "Next.js 14", "MetaMask"];

/* ── Hero illustration (Lottie Player) ──────────────────────── */
function HeroIllustration() {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 450, aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Subtle circular backing orbs */}
      <div style={{ position: "absolute", width: "85%", height: "85%", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,104,12,0.06) 0%, transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: "0%", borderRadius: "50%", border: "1px dashed rgba(232,104,12,0.12)", animation: "spin 120s linear infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: "8%", borderRadius: "50%", border: "1px solid rgba(232,104,12,0.06)", pointerEvents: "none" }} />
      
      <div style={{ width: "95%", height: "95%", position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Lottie 
          animationData={lottieData} 
          loop={true} 
          autoplay={true} 
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}

const SEND_STEP_EXPLANATIONS = [
  {
    title: "1. Select & Upload Cover File",
    details: "First choose a cover file (PNG, JPG, or WAV). StegoChain maps the pixels/audio frequency headers to establish an structural carrier capacity.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF8", border: "1px dashed #F5B888", borderRadius: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Cloud size={32} style={{ color: "#E8680C", animation: "float 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>CoverFile.png parsed (1024 x 1024 px)</span>
        </div>
      </div>
    )
  },
  {
    title: "2. Least Significant Bit (LSB) Embedding",
    details: "The bits of your secret are injected sequentially into the color channels. For instance, modifying a pixel's blue value from 182 (10110110) to 183 (10110111) is mathematically defined but physically invisible to the eye.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF8F3", border: "1px solid #FFF0E3", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, width: "100%" }}>
          <div style={{ border: "1.5px solid #F5B888", padding: "6px 8px", background: "white", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontWeight: 700 }}>R: 142</div>
            <div style={{ color: "#888", fontSize: 9 }}>1000111<strong style={{ color: "#E8680C" }}>0</strong></div>
          </div>
          <div style={{ border: "1.5px solid #F5B888", padding: "6px 8px", background: "white", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontWeight: 700 }}>G: 211</div>
            <div style={{ color: "#888", fontSize: 9 }}>1101001<strong style={{ color: "#E8680C" }}>1</strong></div>
          </div>
          <div style={{ border: "1.5px solid #F5B888", padding: "6px 8px", background: "white", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontWeight: 700 }}>B: 88</div>
            <div style={{ color: "#888", fontSize: 9 }}>0101100<strong style={{ color: "#E8680C" }}>0</strong></div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "3. Military-grade AES-256-GCM Encryption",
    details: "Your payload is encrypted with symmetric AES-256-GCM, incorporating dynamic tags to protect the integrity of the data and verify that it has not been modified or corrupted.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", border: "1px solid #EBEBEB", borderRadius: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "center", padding: "0 10px" }}>
          <div style={{ color: "#888", textDecoration: "line-through", fontSize: 11 }}>"Secret payload payload"</div>
          <div style={{ fontSize: 13, color: "#E8680C", fontWeight: 800, marginTop: 6, letterSpacing: "-0.01em" }}>➜ "7f8c2e91b4df0a9..."</div>
        </div>
      </div>
    )
  },
  {
    title: "4. Decentralized IPFS Storage",
    details: "The stego-cover containing the secret is uploaded directly to the decentralized IPFS network, pin-cached by Pinata. The file is represented by a unique Content Identifier (CID).",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF8", border: "1px solid #F5B888", borderRadius: 12 }}>
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <Cpu size={24} style={{ color: "#E8680C", animation: "spin 3s linear infinite" }} />
          <div style={{ color: "#E8680C", fontWeight: 700, marginTop: 8 }}>CID: QmXo5eFh...fW2A</div>
        </div>
      </div>
    )
  },
  {
    title: "5. Cryptographic Key Fragments",
    details: "The symmetric key is split mathematically via ECDH corresponding to the recipient's Elliptic Curve public key coordinates. The keys are never directly transmitted.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF8F3", border: "1px solid #FFF0E3", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ padding: "6px 12px", background: "white", border: "1.5px solid #F5B888", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#E8680C" }}>Fragment 1</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#888" }}>+</div>
          <div style={{ padding: "6px 12px", background: "white", border: "1.5px solid #F5B888", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#E8680C" }}>Fragment 2</div>
        </div>
      </div>
    )
  },
  {
    title: "6. Blockchain Anchoring Registration",
    details: "The Merkle root of the key fragments is registered permanently on the Ethereum Sepolia smart contract. This establishes cryptographic, immutable proof of the transaction.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#111", borderRadius: 12 }}>
        <div style={{ color: "white", fontFamily: "var(--font-mono)", fontSize: 10, textAlign: "center" }}>
          <div style={{ color: "#27C93F", fontWeight: 800, letterSpacing: "0.05em" }}>ANCHORED ON ETHEREUM</div>
          <div style={{ color: "#888", fontSize: 9, marginTop: 6 }}>Root: 0x82ae41bc...7104f291</div>
        </div>
      </div>
    )
  }
];

const RECEIVE_STEP_EXPLANATIONS = [
  {
    title: "1. Database Ledger Lookup",
    details: "The recipient inputs the Session ID. StegoChain query indexing checks the Sepolia contract mapping to confirm anchor status.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF8", border: "1px dashed #F5B888", borderRadius: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Search size={32} style={{ color: "#E8680C" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>Scanning session records...</span>
        </div>
      </div>
    )
  },
  {
    title: "2. Cryptographic MetaMask Identity Signature",
    details: "The recipient signs a challenge string using their private keys in MetaMask (100% gas-free). This cryptographically proves ownership.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF8F3", border: "1px solid #FFF0E3", borderRadius: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Shield size={32} style={{ color: "#1A9F4A" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1A9F4A" }}>Sign challenge to verify identity</span>
        </div>
      </div>
    )
  },
  {
    title: "3. Blockchain Verification Proof",
    details: "The Sepolia smart contract verifies the cryptographic signature matches the message's recipient address using mathematical proofs.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#111", borderRadius: 12 }}>
        <div style={{ color: "white", fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "center" }}>
          <div style={{ color: "#27C93F", fontWeight: 800 }}>PROOF VALIDATED</div>
          <div style={{ color: "#888", fontSize: 9, marginTop: 4 }}>msg.sender == authorized_receiver</div>
        </div>
      </div>
    )
  },
  {
    title: "4. ECDH Key Reconstruction",
    details: "The recipient's private key is mathematically combined with the sender's public key coordinates using P-256 ECDH to reconstruct the exact symmetric AES decryption key.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF8", border: "1px solid #F5B888", borderRadius: 12 }}>
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <Key size={24} style={{ color: "#E8680C" }} />
          <div style={{ color: "#E8680C", fontWeight: 700, marginTop: 6 }}>Symmetric Key derived</div>
        </div>
      </div>
    )
  },
  {
    title: "5. LSB Payload Extraction",
    details: "The restored AES-256 key decrypts the steganographic payload hidden inside the cover file downloaded from IPFS.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF8F3", border: "1px solid #FFF0E3", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Unlock size={24} style={{ color: "#E8680C" }} />
          <span style={{ fontSize: 11, fontWeight: 700 }}>Extracting secret bits...</span>
        </div>
      </div>
    )
  },
  {
    title: "6. Text Reveal",
    details: "The verified, decrypted binary payload is converted back into plain readable text format and securely presented to the recipient.",
    graphic: (
      <div style={{ width: "100%", height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", border: "1px solid #EBEBEB", borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1A9F4A", fontFamily: "var(--font-mono)" }}>
          "Message: Meet at safehouse"
        </div>
      </div>
    )
  }
];

export default function Home() {
  const [stats, setStats] = useState(null);
  const [graph, setGraph] = useState(null);
  const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const BASESCAN = process.env.NEXT_PUBLIC_BASESCAN_URL;

  const [activeSendStep, setActiveSendStep] = useState(0);
  const [activeReceiveStep, setActiveReceiveStep] = useState(0);

  const [isSendHovered, setIsSendHovered] = useState(false);
  const [isReceiveHovered, setIsReceiveHovered] = useState(false);

  const sendIntervalRef = useRef(null);
  const receiveIntervalRef = useRef(null);

  const startSendCycling = () => {
    if (sendIntervalRef.current) return;
    sendIntervalRef.current = setInterval(() => {
      setActiveSendStep((prev) => (prev + 1) % 6);
    }, 4000);
  };

  const stopSendCycling = () => {
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
  };

  const startReceiveCycling = () => {
    if (receiveIntervalRef.current) return;
    receiveIntervalRef.current = setInterval(() => {
      setActiveReceiveStep((prev) => (prev + 1) % 6);
    }, 4000);
  };

  const stopReceiveCycling = () => {
    if (receiveIntervalRef.current) {
      clearInterval(receiveIntervalRef.current);
      receiveIntervalRef.current = null;
    }
  };

  useEffect(() => {
    getBlockchainStats().then(setStats).catch(() => {});
    const t = setTimeout(() => getGraphSummary().then(setGraph).catch(() => {}), 1500);
    
    // Start cycling from the start/first load
    startSendCycling();
    startReceiveCycling();

    return () => {
      clearTimeout(t);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      if (receiveIntervalRef.current) clearInterval(receiveIntervalRef.current);
    };
  }, []);

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", background: "transparent", overflowX: "hidden" }}>

        {/* ── Hero ──────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 20px 56px" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
            
            {/* Left Column: Text & CTAs */}
            <div style={{ flex: 1.2, minWidth: 300, textAlign: "left" }}>
              {/* Status badge */}
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: "1px solid #EBEBEB", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "#888", letterSpacing: "0.02em", marginBottom: 20 }}
              >
                <div className="pulse-dot-orange" style={{ width: 5, height: 5 }}/> Live on Ethereum Sepolia
              </motion.div>

              {/* Heading */}
              <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
                style={{ fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 800, color: "#111", lineHeight: 1.1, marginBottom: 16, letterSpacing: "-0.03em", fontFamily: "'Outfit', sans-serif" }}
              >
                Secret Messages,{" "}
                <span className="gradient-text">
                  Hidden in Plain Sight
                </span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
                style={{ fontSize: 16, color: "#666", maxWidth: 520, marginBottom: 32, lineHeight: 1.7 }}
              >
                StegoChain embeds encrypted messages inside ordinary images and audio files, then anchors cryptographic proof on the Ethereum blockchain — <strong style={{ color: "#111" }}>invisible to everyone</strong> except the intended receiver.
              </motion.p>

              {/* CTA buttons */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}
                style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
              >
                <Link href="/send" style={{ textDecoration: "none" }}>
                  <button className="btn-primary" style={{ padding: "13px 26px", fontSize: 15, borderRadius: 10 }}>
                    <Send size={15} /> Send a Message
                  </button>
                </Link>
                <Link href="/receive" style={{ textDecoration: "none" }}>
                  <button className="btn-secondary" style={{ padding: "13px 26px", fontSize: 15, borderRadius: 10 }}>
                    <Receive size={15} /> Retrieve Message
                  </button>
                </Link>
              </motion.div>
            </div>

            {/* Right Column: Dynamic Lottie hero illustration */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{ flex: 0.8, minWidth: 300, display: "flex", justifyContent: "center", alignItems: "center" }}
            >
              <HeroIllustration />
            </motion.div>

          </div>
        </section>

        {/* ── Stats Bar ─────────────────────────────────────── */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 32px" }}>
          <div className="stats-ledger-row">
            <StatCard 
              label="Messages on Chain" 
              value={stats?.total_records ?? null} 
              fallback={17} 
              icon={Network} 
              delay={0}
              hasPortRight={true}
              hasPortBottom={true}
            />
            <StatsConnector color="#E8680C" isLive={stats?.total_records !== null && stats?.total_records !== undefined} />
            <StatCard 
              label="Network Nodes" 
              value={graph?.total_nodes ?? null} 
              fallback={8} 
              icon={Cpu} 
              delay={0.08}
              hasPortLeft={true}
              hasPortRight={true}
              hasPortTop={true}
              hasPortBottom={true}
            />
            <StatsConnector color="#E8680C" isLive={graph?.total_nodes !== null && graph?.total_nodes !== undefined} />
            <StatCard 
              label="Ethereum Sepolia" 
              value="StegoChainV2" 
              fallback={null} 
              icon={Shield} 
              link={CONTRACT ? `${BASESCAN}/address/${CONTRACT}` : null} 
              delay={0.16}
              hasPortLeft={true}
              hasPortTop={true}
            />
          </div>
        </section>

        {/* ── Live Developer IDE Simulator Section ───────────── */}
        <section style={{ padding: "0 0 56px" }}>
          <LiveCodingIDE />
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section style={{ maxWidth: 1060, margin: "0 auto", padding: "0 20px 88px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-label">Seven Layers of Protection</div>
            <h2 className="section-title">
              Security you can <span className="gradient-text">verify on-chain</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
            {[
              { icon: Eye, title: "Steganographic Hiding", sub: "LSB + Echo Hiding", desc: "Your message is embedded inside pixel data (LSB for images) or echo delays (audio). The file looks and sounds completely normal to any observer." },
              { icon: Lock, title: "AES-256-GCM Encryption", sub: "Military-grade cipher", desc: "Before hiding, your message is encrypted with AES-256-GCM. 2^256 possible keys. Brute force is computationally impossible." },
              { icon: Key, title: "ECC Key Exchange", sub: "P-256 ECDH + ECDSA", desc: "Your AES key is derived via Elliptic Curve Diffie-Hellman. Keys are never transmitted — both parties derive the same secret independently." },
              { icon: Network, title: "Blockchain Verified", sub: "Ethereum Sepolia", desc: "A Merkle root of encrypted key fragments is permanently registered on-chain. The smart contract is the judge — no admin can override it." },
              { icon: Cloud, title: "IPFS Decentralised Storage", sub: "Content-addressed via Pinata", desc: "Files live on IPFS identified by cryptographic CIDs. Any tampering changes the hash instantly. No central server can delete or alter your files." },
              { icon: Cpu, title: "Graph AI Monitoring", sub: "PyTorch Geometric GAE", desc: "A Graph Autoencoder continuously analyses communication patterns. Anomalous nodes — spam, data exfiltration — are flagged automatically." },
            ].map((f, i) => <FeatureCard key={i} {...f} index={i} />)}
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────── */}
        <section style={{ background: "#FAFAFA", padding: "88px 20px", borderTop: "1px solid #EBEBEB", borderBottom: "1px solid #EBEBEB" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div className="section-label">Interactive Sandbox</div>
              <h2 className="section-title">How the pipelines work</h2>
              <p style={{ fontSize: 14, color: "#888", marginTop: 8 }}>Click on any pipeline step below to see a live visual explanation of the process.</p>
              <div style={{ fontSize: 13, color: "#E8680C", fontWeight: 700, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <div className="pulse-dot-orange" style={{ width: 6, height: 6 }} /> Hover over a card to see the flow
              </div>
            </div>

            {/* Send pipeline */}
            <motion.div 
              style={{ 
                position: "relative",
                overflow: "hidden",
                marginBottom: 48,
                borderRadius: 16,
                padding: "24px 16px",
                background: isSendHovered
                  ? "linear-gradient(115deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.7) 45%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0.7) 55%, rgba(255, 255, 255, 0.4) 100%)"
                  : "rgba(255, 255, 255, 0.45)",
                backgroundSize: "200% 100%",
                backgroundPosition: isSendHovered ? "0% 0" : "100% 0",
                border: isSendHovered ? "1.5px solid rgba(232, 104, 12, 0.35)" : "1.5px solid #EBEBEB",
                boxShadow: isSendHovered 
                  ? "0 16px 48px rgba(232, 104, 12, 0.1), inset 0 0 12px rgba(255, 255, 255, 0.6)" 
                  : "0 4px 20px rgba(0, 0, 0, 0.02)",
                cursor: "default"
              }}
              whileHover={{ y: -6, scale: 1.015 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              onMouseEnter={() => setIsSendHovered(true)}
              onMouseLeave={() => setIsSendHovered(false)}
            >
              {/* Rotating background orange bubble */}
              <motion.div
                style={{
                  position: "absolute",
                  top: "-40px",
                  right: "-40px",
                  width: 170,
                  height: 170,
                  borderRadius: "38%",
                  background: "radial-gradient(circle, rgba(232, 104, 12, 0.15) 0%, rgba(255, 240, 225, 0) 70%)",
                  filter: "blur(14px)",
                  zIndex: 0,
                  pointerEvents: "none"
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24, textAlign: "center" }}>Send Flow</div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
                  {[
                    { n:1, icon:Cloud, label:"Upload", desc:"Cover image or audio" },
                    { n:2, icon:Eye, label:"Embed", desc:"LSB / Echo hiding" },
                    { n:3, icon:Lock, label:"Encrypt", desc:"AES-256-GCM" },
                    { n:4, icon:Cloud, label:"IPFS", desc:"Upload encrypted file" },
                    { n:5, icon:Key, label:"Fragment", desc:"Split AES key via ECC" },
                    { n:6, icon:Network, label:"Chain", desc:"Register Merkle root" },
                  ].map((s, i, arr) => (
                    <div key={i} style={{ display: "flex", alignItems: "center" }}>
                      <PipeStep 
                        {...s} 
                        delay={i * 0.04} 
                        isActive={activeSendStep === i} 
                        onClick={() => setActiveSendStep(i)} 
                      />
                      {i < arr.length - 1 && (
                        <div 
                          style={{ 
                            width: 24, height: 2, 
                            background: activeSendStep > i ? "linear-gradient(to right,#E8680C,#F5B888)" : "#EBEBEB", 
                            margin: "0 3px", flexShrink: 0, marginBottom: 36,
                            transition: "background 0.3s ease"
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Explainer card for active send step */}
                <div style={{ maxWidth: 640, margin: "24px auto 0", background: "white", border: "1.5px solid #F5B888", borderRadius: 16, padding: "20px 24px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: 1.2, minWidth: 260 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: "#E8680C", marginBottom: 6, fontFamily: "var(--font-heading)" }}>
                      {SEND_STEP_EXPLANATIONS[activeSendStep].title}
                    </h4>
                    <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
                      {SEND_STEP_EXPLANATIONS[activeSendStep].details}
                    </p>
                  </div>
                  <div style={{ flex: 0.8, minWidth: 160 }}>
                    {SEND_STEP_EXPLANATIONS[activeSendStep].graphic}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Receive pipeline */}
            <motion.div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 16,
                padding: "24px 16px",
                background: isReceiveHovered
                  ? "linear-gradient(115deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.7) 45%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0.7) 55%, rgba(255, 255, 255, 0.4) 100%)"
                  : "rgba(255, 255, 255, 0.45)",
                backgroundSize: "200% 100%",
                backgroundPosition: isReceiveHovered ? "0% 0" : "100% 0",
                border: isReceiveHovered ? "1.5px solid rgba(26, 159, 74, 0.35)" : "1.5px solid #EBEBEB",
                boxShadow: isReceiveHovered 
                  ? "0 16px 48px rgba(26, 159, 74, 0.1), inset 0 0 12px rgba(255, 255, 255, 0.6)" 
                  : "0 4px 20px rgba(0, 0, 0, 0.02)",
                cursor: "default"
              }}
              whileHover={{ y: -6, scale: 1.015 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              onMouseEnter={() => setIsReceiveHovered(true)}
              onMouseLeave={() => setIsReceiveHovered(false)}
            >
              {/* Rotating background orange bubble */}
              <motion.div
                style={{
                  position: "absolute",
                  top: "-40px",
                  right: "-40px",
                  width: 170,
                  height: 170,
                  borderRadius: "38%",
                  background: "radial-gradient(circle, rgba(232, 104, 12, 0.15) 0%, rgba(255, 240, 225, 0) 70%)",
                  filter: "blur(14px)",
                  zIndex: 0,
                  pointerEvents: "none"
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24, textAlign: "center" }}>Receive Flow</div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
                  {[
                    { n:1, icon:Search, label:"Lookup", desc:"Session ID to record" },
                    { n:2, icon:Send, label:"Sign", desc:"MetaMask identity proof" },
                    { n:3, icon:Shield, label:"Verify", desc:"On-chain Merkle proof" },
                    { n:4, icon:Key, label:"Reconstruct", desc:"ECDH to AES key" },
                    { n:5, icon:Unlock, label:"Decrypt", desc:"AES-GCM + stego extract" },
                    { n:6, icon:Receive, label:"Reveal", desc:"Hidden message appears" },
                  ].map((s, i, arr) => (
                    <div key={i} style={{ display: "flex", alignItems: "center" }}>
                      <PipeStep 
                        {...s} 
                        delay={i * 0.04 + 0.1} 
                        isActive={activeReceiveStep === i} 
                        onClick={() => setActiveReceiveStep(i)} 
                      />
                      {i < arr.length - 1 && (
                        <div 
                          style={{ 
                            width: 24, height: 2, 
                            background: activeReceiveStep > i ? "linear-gradient(to right,#1A9F4A,#B4EDCC)" : "#EBEBEB", 
                            margin: "0 3px", flexShrink: 0, marginBottom: 36,
                            transition: "background 0.3s ease" 
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Explainer card for active receive step */}
                <div style={{ maxWidth: 640, margin: "24px auto 0", background: "white", border: "1.5px solid #B4EDCC", borderRadius: 16, padding: "20px 24px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: 1.2, minWidth: 260 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: "#1A9F4A", marginBottom: 6, fontFamily: "var(--font-heading)" }}>
                      {RECEIVE_STEP_EXPLANATIONS[activeReceiveStep].title}
                    </h4>
                    <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
                      {RECEIVE_STEP_EXPLANATIONS[activeReceiveStep].details}
                    </p>
                  </div>
                  <div style={{ flex: 0.8, minWidth: 160 }}>
                    {RECEIVE_STEP_EXPLANATIONS[activeReceiveStep].graphic}
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* ── Tech Stack ────────────────────────────────────── */}
        <section style={{ maxWidth: 860, margin: "0 auto", padding: "72px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="section-label">Built With</div>
            <h2 className="section-title" style={{ fontSize: 26 }}>Production-grade stack</h2>
          </div>
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}
          >
            {TECH_STACK.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }}>
                <TechBadge label={t} />
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── CTA Banner ────────────────────────────────────── */}
        <section style={{ padding: "0 20px 88px" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ 
              maxWidth: 680, margin: "0 auto", 
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 246, 238, 0.7) 100%)", 
              borderRadius: 20, padding: "52px 40px", textAlign: "center", position: "relative", overflow: "hidden",
              border: "1.5px solid rgba(232, 104, 12, 0.15)",
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              boxShadow: "0 12px 40px rgba(232, 104, 12, 0.06)"
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#E8680C,#F09C00)" }} />
            <motion.div 
              style={{ 
                position: "absolute", 
                top: -60, right: -60, 
                width: 220, height: 220, 
                borderRadius: "42%", 
                background: "linear-gradient(135deg, rgba(232, 104, 12, 0.16) 0%, rgba(240, 156, 0, 0.02) 80%)", 
                filter: "blur(24px)", 
                pointerEvents: "none" 
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ color: "#E8680C", display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <Shield size={40} />
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 12, letterSpacing: "-0.02em", fontFamily: "'Outfit', sans-serif" }}>Ready to send your first hidden message?</h2>
              <p style={{ fontSize: 15, color: "#666", marginBottom: 28, lineHeight: 1.7 }}>Connect your MetaMask wallet and experience blockchain-verified steganographic communication.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/send" style={{ textDecoration: "none" }}>
                  <button className="btn-primary" style={{ padding: "13px 28px", fontSize: 15, borderRadius: 10 }}>
                    <Send size={15} /> Send a Message
                  </button>
                </Link>
                <Link href="/register" style={{ textDecoration: "none" }}>
                  <button
                    style={{ 
                      padding: "13px 28px", fontSize: 15, 
                      background: "rgba(232, 104, 12, 0.05)", color: "#E8680C", 
                      border: "1px solid rgba(232, 104, 12, 0.15)", borderRadius: 10, 
                      cursor: "pointer", fontWeight: 600, transition: "all 0.15s", fontFamily: "'Inter', sans-serif" 
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(232, 104, 12, 0.1)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(232, 104, 12, 0.05)"}
                  >Create Account</button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Footer ────────────────────────────────────────── */}
        <footer style={{ borderTop: "1px solid #EBEBEB", padding: "28px 20px", background: "white" }}>
          <div style={{ maxWidth: 1060, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={logoImg.src} alt="StegoChain" style={{ height: 28, width: "auto" }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 15, color: "#111" }}>Stego<span style={{ color: "#E8680C" }}>Chain</span></span>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {CONTRACT && (
                <a href={`${BASESCAN}/address/${CONTRACT}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#E8680C", textDecoration: "none", fontWeight: 600 }}>
                  Contract ↗
                </a>
              )}
              <Link href="/ledger" style={{ fontSize: 11, color: "#888", textDecoration: "none" }}>Ledger</Link>
              <Link href="/anomaly" style={{ fontSize: 11, color: "#888", textDecoration: "none" }}>Anomaly</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

