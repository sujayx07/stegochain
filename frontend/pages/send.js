import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import StepIndicator from "../components/StepIndicator";
import DropZone from "../components/DropZone";
import PipelineProgress from "../components/PipelineProgress";
import HashDisplay from "../components/HashDisplay";
import SecurityBadge from "../components/SecurityBadge";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { getUserByEth, sendMessage, finalizeSend } from "../utils/api";

const STEPS = ["Upload File", "Compose", "Review", "Sending"];

const PIPELINE_LABELS = [
  "Embedding", "Encrypting", "Uploading to IPFS",
  "Splitting Key", "Fragment Upload", "Merkle Tree",
  "Blockchain Reg", "Complete"
];

function mkPipeline(activeIdx) {
  return PIPELINE_LABELS.map((label, i) => ({
    label,
    status: i < activeIdx ? "complete" : i === activeIdx ? "loading" : "pending"
  }));
}

const CONTRACT_ABI = [
  {
    "inputs": [
      { "name": "ipfsCID",        "type": "string" },
      { "name": "fragmentCIDs",   "type": "string[]" },
      { "name": "receiver",       "type": "address" },
      { "name": "sessionId",      "type": "string" },
      { "name": "merkleRoot",     "type": "bytes32" },
      { "name": "mediaHash",      "type": "bytes32" },
      { "name": "totalFragments", "type": "uint8" }
    ],
    "name": "registerRecord",
    "outputs": [
      { "name": "", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export default function Send() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { address, signer, connect, switchToSepolia, isCorrectChain, isConnected } = useWallet();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [receiver, setReceiver] = useState("");
  const [receiverInfo, setReceiverInfo] = useState(null);
  const [fragments, setFragments] = useState(4);
  const [pipeline, setPipeline] = useState(PIPELINE_LABELS.map(l => ({ label: l, status: "pending" })));
  const [result, setResult] = useState(null);
  const [sendError, setSendError] = useState(null);

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
      } catch {
        setReceiverInfo({ found: false });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [receiver]);

  function goNext() {
    setCompleted(c => [...c, step]);
    setStep(s => s + 1);
  }

  async function handleSend() {
    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!isCorrectChain) {
      toast.error("Please switch to Ethereum Sepolia network.");
      return;
    }

    goNext(); // go to step 3 (sending)
    setSendError(null);
    setResult(null);

    // Initial pipeline state (all pending)
    setPipeline(PIPELINE_LABELS.map(l => ({ label: l, status: "pending" })));

    const fd = new FormData();
    fd.append("file", file);                                           // backend: request.files["file"]
    fd.append("message", message);
    fd.append("receiver_eth", receiver);                               // backend: receiver_eth
    fd.append("n_fragments", String(fragments));                       // backend: n_fragments
    fd.append("file_type", file.type.startsWith("audio/") ? "audio" : "image"); // backend: file_type

    // Start simulation of first 6 steps (indices 0 to 5)
    let simIdx = 0;
    const interval = setInterval(() => {
      if (simIdx < 5) {
        setPipeline(prev => prev.map((p, j) => {
          if (j < simIdx) return { ...p, status: "complete" };
          if (j === simIdx) return { ...p, status: "loading" };
          return p;
        }));
        simIdx++;
      }
    }, 700);

    try {
      // 1. Call backend prepare send
      const res = await sendMessage(fd);
      clearInterval(interval);

      // Backend send prep completed. Set steps 0-5 to complete.
      setPipeline(prev => prev.map((p, j) => {
        if (j < 6) return { ...p, status: "complete" };
        if (j === 6) return { ...p, status: "loading" }; // Blockchain Reg
        return p;
      }));

      // 2. Call contract.registerRecord via MetaMask
      toast("MetaMask: Confirm on-chain record registration", { icon: "🦊" });
      
      const contractAddress = res.contract_address || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error("Smart contract address not found in response or config.");
      }

      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

      const tx = await contract.registerRecord(
        res.ipfs_cid,
        res.fragment_cids,
        ethers.getAddress(res.receiver_eth),
        res.session_id,
        res.merkle_root,
        res.media_hash,
        res.total_fragments
      );

      // Update pipeline status or keep loading while tx is being mined
      toast.success("Transaction submitted! Waiting for confirmation...");
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new Error("Transaction reverted on-chain.");
      }

      // Mark Blockchain Reg as complete and Finalizing status
      setPipeline(prev => prev.map((p, j) => {
        if (j <= 6) return { ...p, status: "complete" };
        if (j === 7) return { ...p, status: "loading" }; // Complete / Finalizing
        return p;
      }));

      // 3. Finalize send on backend
      const finalRes = await finalizeSend({
        session_id: res.session_id,
        tx_hash: receipt.hash
      });

      // Done!
      setPipeline(prev => prev.map(p => ({ ...p, status: "complete" })));
      setResult(finalRes);
      toast.success("Message sent and finalized successfully!");

    } catch (err) {
      clearInterval(interval);
      console.error(err);
      
      // Determine which step failed
      setPipeline(prev => {
        const loadingIdx = prev.findIndex(p => p.status === "loading");
        const errIdx = loadingIdx !== -1 ? loadingIdx : 0;
        return prev.map((p, j) => j === errIdx ? { ...p, status: "error" } : p);
      });
      setSendError(err.message || "An error occurred during sending.");
      toast.error("Sending failed: " + (err.message || "Error"));
    }
  }

  const isImage = file && file.type.startsWith("image/");
  const isAudio = file && file.type.startsWith("audio/");
  const MAX_CHARS = isImage ? 500 : 200;

  if (loading) return null;

  return (
    <>
      <Navbar/>
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 24, fontWeight: 700, color: "#1C1917", marginBottom: 8 }}>
          Send a Message
        </motion.h1>
        <p style={{ fontSize: 14, color: "#78716C", marginBottom: 24 }}>
          Hide your encrypted message inside a media file and anchor it on the blockchain.
        </p>

        <StepIndicator steps={STEPS} currentStep={step} completedSteps={completed}/>

        <div className="card" style={{ padding: 28, marginTop: 8 }}>

          {/* Step 0 — Upload */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1917", marginBottom: 16 }}>Upload Cover File</h2>
              <DropZone
                onFileSelected={setFile}
                accept={{ "image/png": [], "image/bmp": [], "audio/wav": [] }}
                label="Drop PNG, BMP, or WAV file here"
                hint="Max 10MB · Images hide ~500 chars · WAV hides ~200 chars"
              />
              {preview && isImage && (
                <img src={preview} alt="preview" style={{ marginTop: 16, maxHeight: 200, borderRadius: 12, border: "1px solid #E7E5E4", display: "block" }}/>
              )}
              {preview && isAudio && (
                <audio controls src={preview} style={{ marginTop: 16, width: "100%" }}/>
              )}
              <button className="btn-primary" style={{ width: "100%", marginTop: 20 }} disabled={!file} onClick={goNext}>
                Next: Compose Message →
              </button>
            </motion.div>
          )}

          {/* Step 1 — Compose */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1917", marginBottom: 16 }}>Compose Message</h2>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "#1C1917" }}>Secret Message</label>
                  <span style={{ fontSize: 12, color: message.length > MAX_CHARS ? "#DC2626" : "#78716C" }}>
                    {message.length} / {MAX_CHARS}
                  </span>
                </div>
                <textarea
                  className="input-field"
                  rows={5}
                  placeholder="Enter your secret message…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  style={{ resize: "vertical" }}
                />
                {message.length > MAX_CHARS && (
                  <div style={{ fontSize: 12, color: "#D97706", marginTop: 4 }}>⚠ Message may exceed cover file capacity</div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1C1917", display: "block", marginBottom: 6 }}>Receiver Ethereum Address</label>
                <input
                  className="input-field mono"
                  placeholder="0x..."
                  value={receiver}
                  onChange={e => setReceiver(e.target.value)}
                />
                {receiverInfo && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    {receiverInfo.found ? (
                      <span className="badge-success">✓ {receiverInfo.username}</span>
                    ) : (
                      <span className="badge-danger">User not registered</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1C1917", display: "block", marginBottom: 6 }}>
                  Key Fragments
                  <span style={{ fontSize: 11, color: "#78716C", marginLeft: 6 }}>More = higher security</span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[4, 6, 8].map(n => (
                    <button key={n} onClick={() => setFragments(n)} style={{
                      padding: "8px 20px", borderRadius: 8, border: "1px solid",
                      borderColor: fragments === n ? "#F97316" : "#E7E5E4",
                      background: fragments === n ? "#FFF0E6" : "white",
                      color: fragments === n ? "#F97316" : "#78716C",
                      fontWeight: fragments === n ? 600 : 400,
                      cursor: "pointer", fontSize: 14
                    }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" onClick={() => setStep(0)}>← Back</button>
                <button className="btn-primary" style={{ flex: 1 }} disabled={!message || !receiver || !receiverInfo?.found} onClick={goNext}>
                  Review →
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2 — Review */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1917", marginBottom: 20 }}>Review & Confirm</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {[
                  ["File", `${file?.name} · ${(file?.size/1024).toFixed(1)} KB`],
                  ["Type", file?.type],
                  ["Message Length", `${message.length} characters`],
                  ["Receiver", receiverInfo?.username],
                  ["Fragments", `${fragments} key fragments`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F5F4F3" }}>
                    <span style={{ fontSize: 13, color: "#78716C" }}>{k}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#1C1917" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 20 }}>
                <SecurityBadge layers={["steganography", "aes256", "blockchain", "ipfs", "merkle"]}/>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                {!isConnected ? (
                  <button className="btn-primary" style={{ flex: 1 }} onClick={connect}>
                    🦊 Connect Wallet
                  </button>
                ) : !isCorrectChain ? (
                  <button className="btn-primary" style={{ flex: 1 }} onClick={switchToSepolia}>
                    🦊 Switch to Sepolia
                  </button>
                ) : (
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleSend}>
                    🚀 Send Now
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3 — Sending */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {!result && !sendError && (
                <>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1917", marginBottom: 8, textAlign: "center" }}>Processing…</h2>
                  <PipelineProgress steps={pipeline}/>
                </>
              )}

              {sendError && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
                  <div style={{ fontWeight: 600, color: "#DC2626", marginBottom: 8 }}>Send Failed</div>
                  <div style={{ fontSize: 14, color: "#78716C", marginBottom: 16 }}>{sendError}</div>
                  <button className="btn-primary" onClick={() => { setStep(2); setPipeline(PIPELINE_LABELS.map(l=>({label:l,status:"pending"}))); setSendError(null); }}>
                    Retry
                  </button>
                </div>
              )}

              {result && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
                      style={{ fontSize: 48 }}>✅</motion.div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: "#16A34A", marginTop: 8 }}>Message Sent Successfully!</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    <div style={{ padding: 16, background: "#FFF0E6", border: "1px solid #FED7AA", borderRadius: 12 }}>
                      <div style={{ fontSize: 12, color: "#78716C", marginBottom: 4 }}>Session ID — Share this with the receiver</div>
                      <HashDisplay value={result.session_id} type="sessionid" showLink={false}/>
                    </div>
                    {result.ipfs_cid && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>IPFS CID</span>
                      <HashDisplay value={result.ipfs_cid} type="cid"/>
                    </div>}
                    {result.tx_hash && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>Tx Hash</span>
                      <HashDisplay value={result.tx_hash} type="txhash"/>
                    </div>}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setStep(0); setFile(null); setMessage(""); setReceiver(""); setResult(null); setCompleted([]); }}>
                      Send Another
                    </button>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={() => router.push("/ledger")}>
                      View in Ledger
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </>
  );
}
