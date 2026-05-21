import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import DropZone from "../components/DropZone";
import HashDisplay from "../components/HashDisplay";
import SecurityBadge from "../components/SecurityBadge";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { getUserByEth, sendMessage, finalizeSend } from "../utils/api";

const STEPS = ["Upload File", "Compose", "Review", "Sending"];

const PIPELINE = [
  { label: "Steganography Embedding", icon: "👁", sub: "Hiding message in media" },
  { label: "AES-256-GCM Encryption",  icon: "🔒", sub: "Encrypting stego file" },
  { label: "IPFS Upload",             icon: "📡", sub: "Decentralised storage" },
  { label: "Key Fragmentation",       icon: "🧩", sub: "Splitting AES key" },
  { label: "Fragment Upload",         icon: "📡", sub: "ECC-encrypted fragments" },
  { label: "Merkle Tree",             icon: "🌳", sub: "Building proof tree" },
  { label: "Blockchain Registration", icon: "⛓", sub: "On-chain via MetaMask" },
  { label: "Finalizing",              icon: "✅", sub: "Confirming record" },
];

const CONTRACT_ABI = [
  {
    inputs: [
      { name: "ipfsCID",        type: "string"   },
      { name: "fragmentCIDs",   type: "string[]" },
      { name: "receiver",       type: "address"  },
      { name: "sessionId",      type: "string"   },
      { name: "merkleRoot",     type: "bytes32"  },
      { name: "mediaHash",      type: "bytes32"  },
      { name: "totalFragments", type: "uint8"    },
    ],
    name: "registerRecord",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

/* ── Step indicator ─────────────────────────────────────────── */
function StepBar({ steps, current, completed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done   = completed.includes(i);
        const active = i === current;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: done ? "#16A34A" : active ? "#F97316" : "white",
                border: `2px solid ${done ? "#16A34A" : active ? "#F97316" : "#E7E5E4"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.35s ease",
                boxShadow: active ? "0 0 0 4px rgba(249,115,22,0.2)" : "none",
                fontSize: 13, fontWeight: 700, color: done || active ? "white" : "#A8A29E",
              }}>
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
                ) : active ? (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white", animation: "pulse-ring-orange 1.5s infinite" }} />
                ) : i + 1}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: active ? "#F97316" : done ? "#16A34A" : "#A8A29E", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                {s}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#16A34A" : "#E7E5E4", transition: "background 0.5s ease", margin: "0 6px", marginBottom: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Pipeline progress ──────────────────────────────────────── */
function PipelineProgress({ steps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", margin: "8px 0" }}>
      {steps.map((s, i) => {
        const isDone    = s.status === "complete";
        const isLoading = s.status === "loading";
        const isError   = s.status === "error";
        const isPending = s.status === "pending";
        const isLast    = i === steps.length - 1;

        return (
          <div key={i} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

            {/* Left col: icon + connector line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
              {/* Step status icon */}
              <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
                {/* Background circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isDone ? "#16A34A" : isLoading ? "white" : isError ? "#FEF2F2" : "#F0EDE9",
                  border: `2px solid ${isDone ? "#16A34A" : isLoading ? "#FED7AA" : isError ? "#FCA5A5" : "#E7E5E4"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.35s ease",
                  position: "relative", zIndex: 1,
                }}>
                  {isDone && (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2 6.5l3 3 6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isLoading && (
                    /* Spinning ring — orange arc rotating */
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: "2.5px solid #FED7AA",
                      borderTopColor: "#F97316",
                      animation: "spin 0.75s linear infinite",
                      position: "absolute",
                    }}/>
                  )}
                  {isError && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2L2 10" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                  {isPending && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#D1D5DB" }}/>
                  )}
                </div>
              </div>
              {/* Connector line */}
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 16,
                  background: isDone ? "#16A34A" : "#E7E5E4",
                  transition: "background 0.5s ease",
                  margin: "3px 0",
                }}/>
              )}
            </div>

            {/* Right col: label + sub text */}
            <div style={{
              flex: 1, paddingBottom: isLast ? 0 : 14,
              paddingTop: 3,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isDone ? "#16A34A" : isLoading ? "#F97316" : isError ? "#DC2626" : "#A8A29E",
                transition: "color 0.3s ease",
                lineHeight: 1.3,
              }}>
                {s.label}
                {isLoading && (
                  <span style={{
                    display: "inline-block", marginLeft: 6,
                    animation: "breathe 1.2s ease-in-out infinite",
                    fontSize: 11, fontWeight: 500, color: "#F97316",
                  }}>
                    Processing…
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


export default function Send() {
  const router  = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { address, signer, connect, switchToSepolia, isCorrectChain, isConnected } = useWallet();

  const [step, setStep]             = useState(0);
  const [completed, setCompleted]   = useState([]);
  const [file, setFile]             = useState(null);
  const [preview, setPreview]       = useState(null);
  const [message, setMessage]       = useState("");
  const [receiver, setReceiver]     = useState("");
  const [receiverInfo, setReceiverInfo] = useState(null);
  const [fragments, setFragments]   = useState(4);
  const [pipeline, setPipeline]     = useState(PIPELINE.map(p => ({ ...p, status: "pending" })));
  const [result, setResult]         = useState(null);
  const [sendError, setSendError]   = useState(null);

  useEffect(() => { if (!loading && !isAuthenticated) router.push("/login"); }, [loading, isAuthenticated]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!receiver || receiver.length < 10) { setReceiverInfo(null); return; }
    const t = setTimeout(async () => {
      try {
        const data = await getUserByEth(receiver);
        setReceiverInfo({ found: true, username: data.username || data.user?.username });
      } catch { setReceiverInfo({ found: false }); }
    }, 600);
    return () => clearTimeout(t);
  }, [receiver]);

  function goNext() { setCompleted(c => [...c, step]); setStep(s => s + 1); }

  async function handleSend() {
    if (!isConnected) { toast.error("Connect wallet first."); return; }
    if (!isCorrectChain) { toast.error("Switch to Ethereum Sepolia."); return; }
    goNext();
    setSendError(null); setResult(null);
    setPipeline(PIPELINE.map(p => ({ ...p, status: "pending" })));

    const fd = new FormData();
    fd.append("file", file);
    fd.append("message", message);
    fd.append("receiver_eth", receiver);
    fd.append("n_fragments", String(fragments));
    fd.append("file_type", file.type.startsWith("audio/") ? "audio" : "image");

    let simIdx = 0;
    const interval = setInterval(() => {
      if (simIdx < 5) {
        setPipeline(prev => prev.map((p, j) => ({
          ...p,
          status: j < simIdx ? "complete" : j === simIdx ? "loading" : "pending",
        })));
        simIdx++;
      }
    }, 700);

    try {
      const res = await sendMessage(fd);
      clearInterval(interval);
      setPipeline(prev => prev.map((p, j) => ({ ...p, status: j < 6 ? "complete" : j === 6 ? "loading" : "pending" })));

      toast("MetaMask: Confirm on-chain record registration", { icon: "🦊" });
      const contractAddress = res.contract_address || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

      const tx = await contract.registerRecord(
        res.ipfs_cid, res.fragment_cids, ethers.getAddress(res.receiver_eth),
        res.session_id, res.merkle_root, res.media_hash, res.total_fragments,
      );
      toast.success("Transaction submitted! Waiting for confirmation…");
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Transaction reverted on-chain.");

      setPipeline(prev => prev.map((p, j) => ({ ...p, status: j <= 6 ? "complete" : j === 7 ? "loading" : "pending" })));
      const finalRes = await finalizeSend({ session_id: res.session_id, tx_hash: receipt.hash });
      setPipeline(prev => prev.map(p => ({ ...p, status: "complete" })));
      setResult(finalRes);
      toast.success("Message sent and finalized successfully!");
    } catch (err) {
      clearInterval(interval);
      setPipeline(prev => {
        const idx = prev.findIndex(p => p.status === "loading");
        return prev.map((p, j) => j === (idx !== -1 ? idx : 0) ? { ...p, status: "error" } : p);
      });
      setSendError(err.message || "An error occurred.");
      toast.error("Send failed: " + (err.message || "Error"));
    }
  }

  const isImage = file && file.type.startsWith("image/");
  const isAudio = file && file.type.startsWith("audio/");
  const MAX_CHARS = isImage ? 500 : 200;
  if (loading) return null;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#FFF0E6,#FFE4CC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: "1.5px solid #FED7AA" }}>📤</div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em", margin: 0 }}>Send a Message</h1>
              <p style={{ fontSize: 14, color: "#78716C", margin: 0 }}>Hide your encrypted message inside a media file and anchor it on the blockchain</p>
            </div>
          </div>
        </motion.div>

        <StepBar steps={STEPS} current={step} completed={completed} />

        <AnimatePresence mode="wait">

          {/* ── Step 0: Upload ────────────────────────────── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <div className="card" style={{ padding: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 4 }}>Upload Cover File</div>
                <div style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>This file will carry your hidden message — it won't be modified visually</div>

                <DropZone
                  onFileSelected={setFile}
                  accept={{ "image/png": [], "image/bmp": [], "audio/wav": [] }}
                  label="Drop PNG, BMP, or WAV file here"
                  hint="Max 10MB · PNG/BMP hides ~500 chars · WAV hides ~200 chars"
                />

                <AnimatePresence>
                  {preview && isImage && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ marginTop: 16, position: "relative" }}
                    >
                      <img src={preview} alt="preview" style={{ maxHeight: 220, borderRadius: 12, border: "1.5px solid #E7E5E4", display: "block", width: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, backdropFilter: "blur(4px)" }}>
                        {file.name} · {(file.size/1024).toFixed(1)} KB
                      </div>
                    </motion.div>
                  )}
                  {preview && isAudio && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16, padding: 16, background: "#FFF0E6", borderRadius: 12, border: "1.5px solid #FED7AA" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#F97316", marginBottom: 10 }}>🎵 {file.name}</div>
                      <audio controls src={preview} style={{ width: "100%" }} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button className="btn-primary" whileHover={file ? { scale: 1.01 } : {}} whileTap={file ? { scale: 0.98 } : {}}
                  style={{ width: "100%", marginTop: 20, padding: "13px 20px", fontSize: 15 }}
                  disabled={!file} onClick={goNext}
                >
                  Next: Compose Message →
                </motion.button>
              </div>

              {/* Format guide */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
              >
                {[
                  { fmt: "PNG", icon: "🖼", cap: "~500 chars", note: "Lossless • Best" },
                  { fmt: "BMP", icon: "🖼", cap: "~500 chars", note: "Lossless" },
                  { fmt: "WAV", icon: "🎵", cap: "~200 chars", note: "Echo hiding" },
                ].map(f => (
                  <div key={f.fmt} style={{ padding: "10px 12px", background: "white", border: "1.5px solid #E7E5E4", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 18 }}>{f.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917" }}>{f.fmt}</div>
                    <div style={{ fontSize: 10, color: "#78716C" }}>{f.cap}</div>
                    <div style={{ fontSize: 10, color: "#A8A29E" }}>{f.note}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ── Step 1: Compose ───────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <div className="card" style={{ padding: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 4 }}>Compose Message</div>
                <div style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>Your message will be encrypted before being hidden</div>

                {/* Secret message */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                    <label className="label" style={{ margin: 0 }}>Secret Message</label>
                    <span style={{ fontSize: 12, color: message.length > MAX_CHARS ? "#DC2626" : message.length > MAX_CHARS * 0.8 ? "#D97706" : "#78716C", fontWeight: 600 }}>
                      {message.length} / {MAX_CHARS}
                    </span>
                  </div>
                  <textarea
                    className="input-field"
                    rows={5}
                    placeholder="Enter your secret message…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    style={{ resize: "vertical", minHeight: 120 }}
                  />
                  {/* Char progress */}
                  <div style={{ marginTop: 6, height: 3, background: "#F0EDE9", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      background: message.length > MAX_CHARS ? "#DC2626" : message.length > MAX_CHARS * 0.8 ? "#D97706" : "#16A34A",
                      width: `${Math.min((message.length / MAX_CHARS) * 100, 100)}%`,
                      transition: "all 0.2s ease",
                    }} />
                  </div>
                  {message.length > MAX_CHARS && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>⚠️ Exceeds cover file capacity</div>}
                </div>

                {/* Receiver */}
                <div style={{ marginBottom: 20 }}>
                  <label className="label">Receiver Ethereum Address</label>
                  <input
                    className="input-field mono"
                    placeholder="0x..."
                    value={receiver}
                    onChange={e => setReceiver(e.target.value)}
                  />
                  <AnimatePresence>
                    {receiverInfo && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: receiverInfo.found ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${receiverInfo.found ? "#BBF7D0" : "#FCA5A5"}` }}
                      >
                        {receiverInfo.found ? (
                          <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"/></svg>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#16A34A" }}>@{receiverInfo.username} — Registered on-chain ✓</span></>
                        ) : (
                          <><span style={{ fontSize: 14 }}>❌</span><span style={{ fontSize: 13, fontWeight: 600, color: "#DC2626" }}>Address not registered on StegoChain</span></>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Key fragments */}
                <div style={{ marginBottom: 24 }}>
                  <label className="label">Key Fragments <span style={{ fontSize: 11, color: "#A8A29E", fontWeight: 400 }}>— More fragments = higher security, slightly slower</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[4, 6, 8].map(n => (
                      <motion.button key={n} onClick={() => setFragments(n)}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        style={{
                          flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid",
                          borderColor: fragments === n ? "#F97316" : "#E7E5E4",
                          background: fragments === n ? "#FFF0E6" : "white",
                          color: fragments === n ? "#F97316" : "#78716C",
                          fontWeight: fragments === n ? 700 : 500, cursor: "pointer", fontSize: 15,
                          transition: "all 0.18s",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {n}
                        <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>{n === 4 ? "Standard" : n === 6 ? "High" : "Maximum"}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <motion.button className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep(0)}>← Back</motion.button>
                  <motion.button className="btn-primary" style={{ flex: 1, padding: "12px 20px" }}
                    whileHover={message && receiver && receiverInfo?.found ? { scale: 1.01 } : {}}
                    whileTap={message && receiver && receiverInfo?.found ? { scale: 0.98 } : {}}
                    disabled={!message || !receiver || !receiverInfo?.found}
                    onClick={goNext}
                  >
                    Review →
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Review ────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <div className="card" style={{ padding: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 4 }}>Review &amp; Confirm</div>
                <div style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>Check everything before sending — this is permanent on the blockchain</div>

                {/* Preview thumbnail */}
                {preview && isImage && (
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, maxHeight: 160, background: "#1C1917" }}>
                    <img src={preview} alt="" style={{ width: "100%", height: 160, objectFit: "cover", opacity: 0.6 }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ background: "rgba(249,115,22,0.9)", color: "white", fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, backdropFilter: "blur(4px)" }}>
                        🔒 Message will be hidden here
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary table */}
                <div style={{ background: "#F8F7F5", borderRadius: 12, padding: "4px 0", marginBottom: 20 }}>
                  {[
                    { key: "Cover File",       val: `${file?.name} (${(file?.size/1024).toFixed(1)} KB)`, icon: "📁" },
                    { key: "File Type",        val: isImage ? "Image (LSB steganography)" : "Audio (Echo hiding)", icon: "🖼" },
                    { key: "Message Length",   val: `${message.length} characters`, icon: "✍️" },
                    { key: "Receiver",         val: `@${receiverInfo?.username}`, icon: "👤" },
                    { key: "Key Fragments",    val: `${fragments} fragments (ECC-encrypted)`, icon: "🧩" },
                    { key: "Blockchain",       val: "Ethereum Sepolia (live)", icon: "⛓" },
                  ].map(({ key, val, icon }, i, arr) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: i < arr.length - 1 ? "1px solid #E7E5E4" : "none" }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: "#78716C", minWidth: 110, flexShrink: 0 }}>{key}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1C1917" }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <SecurityBadge layers={["steganography","aes256","blockchain","ipfs","merkle"]} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <motion.button className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep(1)}>← Back</motion.button>
                  {!isConnected ? (
                    <motion.button className="btn-primary" style={{ flex: 1, padding: "12px 20px" }} whileHover={{ scale: 1.01 }} onClick={connect}>🦊 Connect Wallet</motion.button>
                  ) : !isCorrectChain ? (
                    <motion.button className="btn-primary" style={{ flex: 1, padding: "12px 20px" }} whileHover={{ scale: 1.01 }} onClick={switchToSepolia}>🦊 Switch to Sepolia</motion.button>
                  ) : (
                    <motion.button className="btn-primary" style={{ flex: 1, padding: "12px 20px", fontSize: 15 }} whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(249,115,22,0.3)" }} whileTap={{ scale: 0.98 }} onClick={handleSend}>
                      🚀 Send Now
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Sending ───────────────────────────── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <div className="card" style={{ padding: 28 }}>

                {/* Processing */}
                {!result && !sendError && (
                  <>
                    <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #F0EDE9" }}>
                      {/* Animated spinner ring */}
                      <div style={{ position: "relative", width: 52, height: 52, margin: "0 auto 14px" }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: "50%",
                          border: "3px solid #FED7AA",
                          borderTopColor: "#F97316",
                          animation: "spin 0.9s linear infinite",
                        }}/>
                        <div style={{
                          position: "absolute", inset: 8, borderRadius: "50%",
                          background: "linear-gradient(135deg,#FFF0E6,#FFE4CC)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18,
                        }}>
                          🔐
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1917" }}>
                        Processing your message
                        <span style={{ display: "inline-flex", gap: 2, marginLeft: 1, verticalAlign: "middle" }}>
                          {[0, 0.25, 0.5].map((d, i) => (
                            <span key={i} style={{
                              display: "inline-block", width: 4, height: 4, borderRadius: "50%",
                              background: "#F97316", animation: `breathe 1.2s ease-in-out ${d}s infinite`,
                            }}/>
                          ))}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#A8A29E", marginTop: 5 }}>Usually takes 15–30 seconds — stay on this page</div>
                    </div>
                    <PipelineProgress steps={pipeline} />
                  </>
                )}


                {/* Error */}
                {sendError && !result && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "20px 0" }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} style={{ fontSize: 48, marginBottom: 12 }}>❌</motion.div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>Send Failed</div>
                    <div style={{ fontSize: 13, color: "#78716C", marginBottom: 24, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 24px" }}>{sendError}</div>
                    <motion.button className="btn-primary" whileHover={{ scale: 1.02 }} style={{ padding: "11px 28px" }}
                      onClick={() => { setStep(2); setPipeline(PIPELINE.map(p => ({ ...p, status: "pending" }))); setSendError(null); }}
                    >Retry</motion.button>
                  </motion.div>
                )}

                {/* Success */}
                {result && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                      <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        style={{ fontSize: 56, display: "block", marginBottom: 8 }}
                      >✅</motion.div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.01em" }}>Message Sent!</div>
                      <div style={{ fontSize: 14, color: "#78716C", marginTop: 4 }}>Blockchain record created on Ethereum Sepolia</div>
                    </div>

                    {/* Session ID — highlighted */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      style={{ padding: 20, background: "linear-gradient(135deg,#FFF0E6,#FFF7EE)", border: "1.5px solid #FED7AA", borderRadius: 14, marginBottom: 16, position: "relative", overflow: "hidden" }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#F97316,#F59E0B,#F97316)", backgroundSize: "200% 100%", animation: "gradientShift 2s ease infinite" }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#F97316", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>📤 Share this Session ID with the receiver</div>
                      <HashDisplay value={result.session_id} type="sessionid" showLink={false} />
                    </motion.div>

                    {/* Details */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}
                    >
                      {result.ipfs_cid && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>IPFS CID</span>
                          <HashDisplay value={result.ipfs_cid} type="cid" />
                        </div>
                      )}
                      {result.tx_hash && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>Tx Hash</span>
                          <HashDisplay value={result.tx_hash} type="txhash" />
                        </div>
                      )}
                    </motion.div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                      style={{ display: "flex", gap: 10 }}
                    >
                      <motion.button className="btn-secondary" style={{ flex: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => { setStep(0); setFile(null); setMessage(""); setReceiver(""); setResult(null); setCompleted([]); setPipeline(PIPELINE.map(p => ({...p,status:"pending"}))); }}
                      >Send Another</motion.button>
                      <motion.button className="btn-primary" style={{ flex: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => router.push("/ledger")}
                      >View in Ledger →</motion.button>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </>
  );
}
