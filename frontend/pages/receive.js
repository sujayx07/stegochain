import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import HashDisplay from "../components/HashDisplay";
import SecurityBadge from "../components/SecurityBadge";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { api, receiveMessage } from "../utils/api";
import { buildChallengeString, buildChallengeHash } from "../utils/crypto";

const CONTRACT_ABI = [
  {
    inputs: [
      { name: "recordId",     type: "uint256"   },
      { name: "merkleProof",  type: "bytes32[]"  },
      { name: "leafHash",     type: "bytes32"    },
      { name: "signature",    type: "bytes"      },
      { name: "challengeHash",type: "bytes32"    },
    ],
    name: "requestDecryption",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

/* ── Phases config ──────────────────────────────────────────── */
const PHASES = [
  { id: "fetching",   label: "Fetching blockchain record",     icon: "🔍" },
  { id: "signing",    label: "MetaMask identity proof",         icon: "🦊" },
  { id: "verifying",  label: "Signing challenge",               icon: "✍️" },
  { id: "assembling", label: "Submitting on-chain transaction", icon: "⛓"  },
  { id: "decrypting", label: "Decrypting & extracting",         icon: "🔓" },
  { id: "done",       label: "Message revealed",                icon: "💬" },
];

/* ── Lock animation component ───────────────────────────────── */
function LockReveal({ revealed, onDone }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 20 }}
    >
      {/* Lock with pulsing halo */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* Pulsing halo rings — only shown while waiting */}
        {!revealed && (<>
          <div style={{
            position: "absolute", width: 100, height: 100, borderRadius: "50%",
            border: "2px solid rgba(249,115,22,0.35)",
            animation: "ping 1.6s ease-out infinite",
          }}/>
          <div style={{
            position: "absolute", width: 100, height: 100, borderRadius: "50%",
            border: "2px solid rgba(249,115,22,0.2)",
            animation: "ping 1.6s ease-out 0.5s infinite",
          }}/>
        </>)}

        {/* Green success halo */}
        {revealed && (
          <div style={{
            position: "absolute", width: 110, height: 110, borderRadius: "50%",
            background: "radial-gradient(circle,rgba(22,163,74,0.15),transparent 70%)",
            animation: "scaleIn 0.5s ease forwards",
          }}/>
        )}

        {/* The lock emoji with CSS animation */}
        <motion.div
          animate={revealed
            ? { rotate: [0, -15, 15, -8, 8, 0], scale: [1, 1.15, 1] }
            : { y: [0, -4, 0] }
          }
          transition={revealed
            ? { duration: 0.6, ease: "easeInOut" }
            : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          }
          onAnimationComplete={() => revealed && onDone?.()}
          style={{
            fontSize: 64, userSelect: "none", lineHeight: 1,
            filter: revealed
              ? "drop-shadow(0 0 18px rgba(22,163,74,0.6))"
              : "drop-shadow(0 6px 14px rgba(249,115,22,0.35))",
            transition: "filter 0.6s ease",
          }}
        >
          {revealed ? "🔓" : "🔒"}
        </motion.div>
      </div>

      {/* Status text with blinking dots */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, color: revealed ? "#16A34A" : "#78716C", fontWeight: 600, transition: "color 0.5s ease" }}>
          {revealed ? "Decryption authorised" : "Awaiting authorisation"}
          {!revealed && (
            <span style={{ display: "inline-flex", gap: 2, marginLeft: 2 }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <span key={i} style={{
                  display: "inline-block", width: 3, height: 3, borderRadius: "50%",
                  background: "#F97316", marginBottom: 1,
                  animation: `breathe 1.2s ease-in-out ${delay}s infinite`,
                }}/>
              ))}
            </span>
          )}
        </div>
        {!revealed && (
          <div style={{ fontSize: 12, color: "#A8A29E", marginTop: 4 }}>
            MetaMask signature verification in progress
          </div>
        )}
      </div>

      {/* Orbiting rings — key prop fixed so React animates properly */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        {[
          { size: 0,  speed: "3s",   dir: "normal",  dash: "solid",  opacity: 0.30 },
          { size: 12, speed: "4.5s", dir: "reverse", dash: "dashed", opacity: 0.20 },
          { size: 24, speed: "6s",   dir: "normal",  dash: "dashed", opacity: 0.12 },
        ].map((ring, i) => (
          <div
            key={`ring-${i}`}
            style={{
              position: "absolute",
              top: ring.size, right: ring.size, bottom: ring.size, left: ring.size,
              borderRadius: "50%",
              border: `1.5px ${ring.dash} rgba(249,115,22,${ring.opacity})`,
              animation: `spin ${ring.speed} linear infinite`,
              animationDirection: ring.dir,
            }}
          />
        ))}
        {/* Centre dot */}
        <div style={{
          position: "absolute", inset: 36, borderRadius: "50%",
          background: revealed ? "rgba(22,163,74,0.15)" : "rgba(249,115,22,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.8s ease",
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            background: revealed ? "#16A34A" : "#F97316",
            transition: "background 0.8s ease",
            animation: "breathe 1.5s ease-in-out infinite",
          }}/>
        </div>
      </div>
    </motion.div>
  );
}


/* ── Step progress (vertical timeline) ──────────────────────── */
function StepProgress({ currentPhase }) {
  const STEPS = [
    { id: "fetching",    label: "Fetching from IPFS",        sub: "Retrieving encrypted file" },
    { id: "verifying",   label: "Verifying blockchain proof", sub: "Checking Merkle signature" },
    { id: "assembling",  label: "Assembling key fragments",   sub: "Threshold reconstruction" },
    { id: "decrypting",  label: "Decrypting message",         sub: "AES-256-GCM + steganography" },
  ];
  const idx = STEPS.findIndex(s => s.id === currentPhase);

  return (
    <div style={{ margin: "16px 0 8px" }}>
      {STEPS.map((s, i) => {
        const isDone    = i < idx;
        const isActive  = i === idx;
        const isPending = i > idx;
        const isLast    = i === STEPS.length - 1;

        return (
          <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

            {/* Left: circle + connector */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
              <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isDone ? "#16A34A" : isActive ? "white" : "#F0EDE9",
                  border: `2px solid ${isDone ? "#16A34A" : isActive ? "#FED7AA" : "#E7E5E4"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.35s ease",
                  position: "relative", zIndex: 1,
                }}>
                  {isDone && (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2 6.5l3 3 6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isActive && (
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: "2.5px solid #FED7AA",
                      borderTopColor: "#F97316",
                      animation: "spin 0.75s linear infinite",
                      position: "absolute",
                    }}/>
                  )}
                  {isPending && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#D1D5DB" }}/>
                  )}
                </div>
              </div>
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 14,
                  background: isDone ? "#16A34A" : "#E7E5E4",
                  transition: "background 0.5s ease",
                  margin: "3px 0",
                }}/>
              )}
            </div>

            {/* Right: labels */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12, paddingTop: 3 }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isDone ? "#16A34A" : isActive ? "#F97316" : "#A8A29E",
                transition: "color 0.3s ease",
              }}>
                {s.label}
                {isActive && (
                  <span style={{ display: "inline-flex", gap: 2, marginLeft: 5 }}>
                    {[0, 0.2, 0.4].map((d, j) => (
                      <span key={j} style={{
                        display: "inline-block", width: 3, height: 3, borderRadius: "50%",
                        background: "#F97316", animation: `breathe 1.2s ease-in-out ${d}s infinite`,
                      }}/>
                    ))}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#A8A29E", marginTop: 1 }}>{s.sub}</div>
            </div>

          </div>
        );
      })}
    </div>
  );
}


/* ── Confetti effect ────────────────────────────────────────── */
function Confetti() {
  const pieces = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ["#F97316","#F59E0B","#16A34A","#3B82F6","#EC4899","#8B5CF6"][Math.floor(Math.random() * 6)],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random(),
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 10 }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          initial={{ y: -20, x: `${p.x}%`, opacity: 1, rotate: 0 }}
          animate={{ y: "120%", opacity: 0, rotate: 360 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          style={{ position: "absolute", width: p.size, height: p.size, background: p.color, borderRadius: 2, top: 0 }}
        />
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function Receive() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { signer, isConnected, address } = useWallet();
  const [sessionId, setSessionId]     = useState("");
  const [fileType, setFileType]       = useState("image");
  const [phase, setPhase]             = useState("form");
  const [record, setRecord]           = useState(null);
  const [result, setResult]           = useState(null);
  const [revealed, setRevealed]       = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [errorMsg, setErrorMsg]       = useState("");
  const [statusMsg, setStatusMsg]     = useState("");
  const [txHash, setTxHash]           = useState("");
  const revealTimeout = useRef(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/login");
  }, [loading, isAuthenticated]);

  useEffect(() => () => clearTimeout(revealTimeout.current), []);

  async function handleDecrypt() {
    if (!sessionId.trim()) return;
    setPhase("fetching"); setErrorMsg(""); setStatusMsg("Fetching record from blockchain…");
    try {
      const res = await api.get(`/api/blockchain/decryption-prep?session_id=${encodeURIComponent(sessionId.trim())}`);
      setRecord(res.data || res);
      setPhase("signing");
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || "Failed to fetch record.");
      setPhase("error");
    }
  }

  async function handleSign() {
    if (!signer) { toast.error("Wallet not connected"); return; }
    setPhase("verifying");
    try {
      const { ethers } = await import("ethers");
      const sid = sessionId.trim();

      setStatusMsg("Waiting for MetaMask signature…");
      const challengeHash = buildChallengeHash(sid);
      const signature = await signer.signMessage(ethers.getBytes(challengeHash));

      setPhase("assembling");
      setStatusMsg("Sending requestDecryption transaction…\n⚠️ MetaMask will ask for gas confirmation.");

      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const merkleProofBytes32 = record.merkle_proof.map(p => p.startsWith("0x") ? p : "0x" + p);
      const leafHashBytes32    = record.leaf_hash.startsWith("0x") ? record.leaf_hash : "0x" + record.leaf_hash;

      let tx, receipt;
      try {
        tx = await contract.requestDecryption(record.record_id, merkleProofBytes32, leafHashBytes32, signature, challengeHash);
        setTxHash(tx.hash);
        setStatusMsg(`Transaction submitted ✓\nTx: ${tx.hash.slice(0,18)}…\nWaiting for confirmation…`);
        receipt = await tx.wait();
      } catch (contractErr) {
        throw new Error(`Contract call failed: ${contractErr?.reason || contractErr?.message || "Contract rejected"}`);
      }

      if (receipt.status !== 1) throw new Error("Transaction reverted on-chain.");

      setPhase("decrypting");
      setStatusMsg("Transaction confirmed ✓ — decrypting message…");

      const fragsRes  = await api.post("/api/blockchain/fragments-after-auth", { session_id: sid, tx_hash: tx.hash });
      const fragsData = fragsRes.data || fragsRes;
      if (!fragsData.authorised) throw new Error("Backend did not authorise fragment release.");

      const recvRes = await receiveMessage({ session_id: sid, fragments_b64: fragsData.fragments_b64, file_type: fileType });
      setResult({ ...recvRes, tx_hash: tx.hash });
      setPhase("done");

      revealTimeout.current = setTimeout(() => {
        setRevealed(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }, 1200);
    } catch (err) {
      console.error("[Receive]", err);
      setErrorMsg(err.message || "Decryption failed.");
      setPhase("error");
    }
  }

  async function handleDownload() {
    if (!result?.media_b64) return;
    const bytes = atob(result.media_b64);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const mime = fileType === "audio" ? "audio/wav" : "image/png";
    const blob = new Blob([arr], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `stegochain-${sessionId.slice(0,8)}.${fileType === "audio" ? "wav" : "png"}`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return null;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#FFF0E6,#FFE4CC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: "1.5px solid #FED7AA" }}>🔓</div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em", margin: 0 }}>Retrieve Message</h1>
              <p style={{ fontSize: 14, color: "#78716C", margin: 0 }}>Prove your identity on-chain to decrypt a hidden message</p>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── Form ──────────────────────────────────────────── */}
          {phase === "form" && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
              <div className="card" style={{ padding: 28, marginBottom: 0 }}>
                <div style={{ marginBottom: 22 }}>
                  <label className="label">Session ID</label>
                  <input
                    id="session-id" className="input-field mono"
                    placeholder="Enter session ID from sender…"
                    value={sessionId} onChange={e => setSessionId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sessionId.trim() && isConnected && handleDecrypt()}
                    style={{ fontSize: 14, letterSpacing: "0.5px" }}
                  />
                  <div style={{ fontSize: 12, color: "#A8A29E", marginTop: 6 }}>The session ID was shared by the message sender.</div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label className="label">Media Type</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[{ val: "image", icon: "🖼", label: "Image (PNG/BMP)" }, { val: "audio", icon: "🎵", label: "Audio (WAV)" }].map(ft => (
                      <motion.label key={ft.val} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                          padding: "12px 16px", borderRadius: 10, border: "1.5px solid",
                          borderColor: fileType === ft.val ? "#F97316" : "#E7E5E4",
                          background: fileType === ft.val ? "#FFF0E6" : "white",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <input type="radio" name="filetype" value={ft.val} checked={fileType === ft.val} onChange={() => setFileType(ft.val)} style={{ accentColor: "#F97316" }} />
                        <span style={{ fontSize: 18 }}>{ft.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: fileType === ft.val ? "#F97316" : "#1C1917" }}>{ft.label}</span>
                      </motion.label>
                    ))}
                  </div>
                </div>

                {!isConnected && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ padding: "12px 16px", background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 10, fontSize: 13, color: "#C2410C", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    🦊 Connect your MetaMask wallet to continue
                  </motion.div>
                )}

                <motion.button
                  id="decrypt-button" className="btn-primary"
                  style={{ width: "100%", padding: "14px 20px", fontSize: 15, borderRadius: 12 }}
                  disabled={!sessionId.trim() || !isConnected}
                  onClick={handleDecrypt}
                  whileHover={sessionId.trim() && isConnected ? { scale: 1.01 } : {}}
                  whileTap={sessionId.trim() && isConnected ? { scale: 0.98 } : {}}
                >
                  {!isConnected ? "Connect wallet first" : "🔓 Decrypt Message"}
                </motion.button>
              </div>

              {/* Info card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                style={{ marginTop: 16, padding: "16px 20px", background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 14, display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>🛡️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A", marginBottom: 4 }}>Zero-trust decryption</div>
                  <div style={{ fontSize: 12, color: "#78716C", lineHeight: 1.65 }}>
                    Your identity is verified purely by cryptographic proof on the smart contract. MetaMask will sign a challenge (free) then submit one small transaction to authorise decryption on-chain.
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── Signing confirmation ─────────────────────────── */}
          {phase === "signing" && record && (
            <motion.div key="signing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
              <div className="card" style={{ padding: 28 }}>

                {/* Record found badge */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ marginBottom: 20, padding: 16, background: "#F0FDF4", borderRadius: 12, border: "1.5px solid #BBF7D0" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#16A34A" }}>Record found on blockchain</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, color: "#78716C" }}>
                    {record.sender && <div>From: <span className="mono" style={{ color: "#1C1917" }}>{record.sender.slice(0,16)}…</span></div>}
                    <div>Record ID: <span className="mono" style={{ color: "#1C1917" }}>#{record.record_id}</span></div>
                  </div>
                </motion.div>

                {/* Steps info */}
                <div style={{ marginBottom: 24, padding: 16, background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#C2410C", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    🦊 Two MetaMask steps
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { n: 1, label: "Sign a message", sub: "No gas — proves your identity", color: "#16A34A" },
                      { n: 2, label: "Confirm a transaction", sub: "Small gas fee — authorises on-chain", color: "#F97316" },
                    ].map(s => (
                      <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: s.color, color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1917" }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: "#78716C" }}>{s.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.button className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{ width: "100%", padding: "14px 20px", fontSize: 15, borderRadius: 12 }}
                  onClick={handleSign}
                >
                  🦊 Sign &amp; Authorise Decryption
                </motion.button>

                <button className="btn-ghost" style={{ width: "100%", marginTop: 10, color: "#78716C" }} onClick={() => setPhase("form")}>
                  ← Back
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Processing ──────────────────────────────────── */}
          {["fetching","verifying","assembling","decrypting"].includes(phase) && (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="card" style={{ padding: 36 }}>
                <StepProgress currentPhase={phase} />

                <LockReveal revealed={false} />

                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 6 }}>
                    {phase === "fetching"   && "Fetching blockchain record…"}
                    {phase === "verifying"  && "Waiting for MetaMask signature…"}
                    {phase === "assembling" && "Submitting decryption request…"}
                    {phase === "decrypting" && "Decrypting & extracting message…"}
                  </div>
                  {statusMsg && (
                    <div style={{ fontSize: 12, color: "#A8A29E", whiteSpace: "pre-wrap", lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
                      {statusMsg}
                    </div>
                  )}
                  {txHash && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ marginTop: 12, padding: "8px 14px", background: "#F0FDF4", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A" }} />
                      <span className="mono" style={{ fontSize: 11, color: "#16A34A" }}>Tx: {txHash.slice(0,20)}…</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Error ───────────────────────────────────────── */}
          {phase === "error" && (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="card" style={{ padding: 36, borderColor: "#FCA5A5", textAlign: "center" }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  style={{ fontSize: 52, marginBottom: 16, display: "block" }}>❌</motion.div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>Decryption Failed</div>
                <div style={{ fontSize: 14, color: "#78716C", marginBottom: 24, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 24px" }}>
                  {errorMsg?.includes("not the intended") ? "You are not the intended receiver of this message." :
                   errorMsg?.includes("revoked")          ? "This record has been revoked on the blockchain." :
                   errorMsg}
                </div>
                <motion.button className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ padding: "12px 28px" }}
                  onClick={() => { setPhase("form"); setErrorMsg(""); setStatusMsg(""); setTxHash(""); }}
                >
                  Try Again
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Done / Reveal ───────────────────────────────── */}
          {phase === "done" && result && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>

              {/* Reveal card */}
              <div className="card" style={{ padding: 0, marginBottom: 16, overflow: "hidden", position: "relative" }}>
                {showConfetti && <Confetti />}

                {/* Media display */}
                {result.media_b64 && (
                  <div style={{ position: "relative", background: "#1C1917", borderRadius: "14px 14px 0 0", overflow: "hidden", minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      src={`data:image/png;base64,${result.media_b64}`}
                      alt="Decrypted stego image"
                      style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain", opacity: revealed ? 1 : 0.4, transition: "opacity 1s ease", display: "block" }}
                    />
                    {!revealed && (
                      <motion.div
                        initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(28,25,23,0.5)", backdropFilter: "blur(4px)" }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
                          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Unlocking…</div>
                        </div>
                      </motion.div>
                    )}
                    {revealed && (
                      <motion.div initial={{ opacity: 0, x: "100%" }} animate={{ opacity: 1, x: "0%" }} transition={{ delay: 0.3 }}
                        style={{ position: "absolute", top: 12, right: 12, background: "rgba(22,163,74,0.9)", backdropFilter: "blur(10px)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3L10.5 3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                        <span style={{ fontSize: 11, color: "white", fontWeight: 700 }}>BLOCKCHAIN VERIFIED</span>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Message reveal */}
                <AnimatePresence>
                  {revealed && result.message && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      style={{ padding: 24, borderTop: "1px solid #E7E5E4" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <motion.div animate={{ rotate: [0,-15,15,-8,8,0] }} transition={{ duration: 0.8, delay: 0.2 }}
                          style={{ fontSize: 22 }}>🔓</motion.div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1C1917" }}>Hidden Message Revealed</span>
                        <span className="badge badge-success" style={{ marginLeft: "auto" }}>Decrypted</span>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        style={{
                          padding: 20, background: "linear-gradient(135deg,#FFF0E6,#FFF7EE)",
                          border: "1.5px solid #FED7AA", borderRadius: 12,
                          fontSize: 16, color: "#1C1917", lineHeight: 1.7, fontWeight: 500,
                          fontStyle: "italic", position: "relative", overflow: "hidden",
                        }}
                      >
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#F97316,#F59E0B,#F97316)", backgroundSize: "200% 100%", animation: "gradientShift 2s ease infinite" }} />
                        "{result.message}"
                        <div style={{ position: "absolute", bottom: -30, right: -20, fontSize: 80, opacity: 0.05, userSelect: "none" }}>💬</div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!revealed && (
                  <div style={{ padding: 24 }}>
                    <LockReveal revealed={false} />
                  </div>
                )}
              </div>

              {/* Metadata card */}
              <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                style={{ padding: 22, marginBottom: 16 }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📋</span> Message Details
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {record?.sender && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#78716C", minWidth: 72, fontWeight: 500 }}>Sender</span>
                      <HashDisplay value={record.sender} type="address" />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#78716C", minWidth: 72, fontWeight: 500 }}>Session</span>
                    <HashDisplay value={sessionId} type="sessionid" showLink={false} />
                  </div>
                  {result.tx_hash && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#78716C", minWidth: 72, fontWeight: 500 }}>Tx Hash</span>
                      <HashDisplay value={result.tx_hash} type="txhash" />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 16 }}>
                  <SecurityBadge layers={["steganography","aes256","blockchain","ipfs","merkle"]} />
                </div>
              </motion.div>

              {/* Action buttons */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
              >
                <motion.button className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ flex: 1, padding: "13px 20px" }} onClick={handleDownload}
                >
                  ⬇ Download Decrypted File
                </motion.button>
                <motion.button className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ flex: 1, padding: "13px 20px" }}
                  onClick={() => { setPhase("form"); setResult(null); setRecord(null); setSessionId(""); setRevealed(false); setTxHash(""); }}
                >
                  Decrypt Another
                </motion.button>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </>
  );
}
