import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import MediaDisplay from "../components/MediaDisplay";
import HashDisplay from "../components/HashDisplay";
import SecurityBadge from "../components/SecurityBadge";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { api, receiveMessage } from "../utils/api";
import { buildChallengeString, buildChallengeHash } from "../utils/crypto";

const CONTRACT_ABI = [
  {
    inputs: [
      { name: "recordId", type: "uint256" },
      { name: "merkleProof", type: "bytes32[]" },
      { name: "leafHash", type: "bytes32" },
      { name: "signature", type: "bytes" },
      { name: "challengeHash", type: "bytes32" },
    ],
    name: "requestDecryption",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export default function Receive() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { signer, isConnected, address } = useWallet();
  const [sessionId, setSessionId] = useState("");
  const [fileType, setFileType] = useState("image");
  const [phase, setPhase] = useState("form");
  const [record, setRecord] = useState(null);
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/login");
  }, [loading, isAuthenticated]);

  async function handleDecrypt() {
    if (!sessionId.trim()) return;
    setPhase("fetching");
    setErrorMsg("");
    setStatusMsg("Fetching record from blockchain…");
    try {
      const res = await api.get(
        `/api/blockchain/decryption-prep?session_id=${encodeURIComponent(sessionId.trim())}`,
      );
      const prep = res.data || res;
      setRecord(prep);
      setPhase("signing");
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || "Failed to fetch record.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  async function handleSign() {
    if (!signer) {
      toast.error("Wallet not connected");
      return;
    }
    setPhase("verifying");
    try {
      const { ethers } = await import("ethers");
      const sid = sessionId.trim();

      // ── Step 1: Sign challenge ──────────────────────────────────────────
      setStatusMsg("Waiting for MetaMask signature…");
      const challenge = buildChallengeString(sid);
      const challengeHash = buildChallengeHash(sid); // raw keccak256 of string
      // Sign the 32-byte challenge hash so the contract's prefix+hash matches
      const signature = await signer.signMessage(
        ethers.getBytes(challengeHash),
      );

      // ── Step 2: Call contract DIRECTLY via MetaMask ────────────────────
      // msg.sender = receiver's own wallet ✓ — contract check will pass
      setPhase("assembling");
      setStatusMsg(
        "Sending requestDecryption transaction via MetaMask…\n⚠️ MetaMask will ask for gas confirmation.",
      );

      const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      const contract = new ethers.Contract(
        contractAddress,
        CONTRACT_ABI,
        signer,
      );

      // Convert hex strings to bytes32 arrays
      const merkleProofBytes32 = record.merkle_proof.map((p) =>
        p.startsWith("0x") ? p : "0x" + p,
      );
      const leafHashBytes32 = record.leaf_hash.startsWith("0x")
        ? record.leaf_hash
        : "0x" + record.leaf_hash;

      let tx, receipt;
      try {
        tx = await contract.requestDecryption(
          record.record_id,
          merkleProofBytes32,
          leafHashBytes32,
          signature,
          challengeHash,
        );
        setStatusMsg(
          `Transaction submitted ✓\nTx: ${tx.hash.slice(0, 18)}…\nWaiting for confirmation…`,
        );
        receipt = await tx.wait();
      } catch (contractErr) {
        const reason =
          contractErr?.reason ||
          contractErr?.message ||
          "Contract rejected the call";
        throw new Error(`Contract call failed: ${reason}`);
      }

      if (receipt.status !== 1)
        throw new Error("Transaction reverted on-chain.");

      // ── Step 3: Tell backend "tx confirmed — give me the fragments" ────
      setPhase("decrypting");
      setStatusMsg("Transaction confirmed ✓ — decrypting message…");

      const fragsRes = await api.post("/api/blockchain/fragments-after-auth", {
        session_id: sid,
        tx_hash: tx.hash,
      });
      const fragsData = fragsRes.data || fragsRes;
      if (!fragsData.authorised)
        throw new Error("Backend did not authorise fragment release.");

      // ── Step 4: Backend decrypts and extracts the hidden message ──────
      const recvRes = await receiveMessage({
        session_id: sid,
        fragments_b64: fragsData.fragments_b64,
        file_type: fileType,
      });

      setResult({ ...recvRes, tx_hash: tx.hash });
      setPhase("done");
      setTimeout(() => setRevealed(true), 1500);
    } catch (err) {
      console.error("[Receive] error:", err);
      setErrorMsg(err.message || "Decryption failed.");
      setPhase("error");
    }
  }

  async function handleDownload() {
    if (!result?.media_b64) return;
    const bytes = atob(result.media_b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const mime = fileType === "audio" ? "audio/wav" : "image/png";
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stegochain-${sessionId.slice(0, 8)}.${fileType === "audio" ? "wav" : "png"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return null;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1C1917",
            marginBottom: 8,
          }}
        >
          Retrieve Message
        </motion.h1>
        <p style={{ fontSize: 14, color: "#78716C", marginBottom: 28 }}>
          Enter the session ID you received from the sender and prove your
          identity to decrypt the hidden message.
        </p>

        {/* Form */}
        {phase === "form" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card"
            style={{ padding: 28 }}
          >
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#1C1917",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Session ID
              </label>
              <input
                id="session-id"
                className="input-field mono"
                placeholder="Enter session ID…"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                style={{ fontSize: 15, letterSpacing: "0.5px" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#1C1917",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                File Type
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { val: "image", icon: "🖼", label: "Image" },
                  { val: "audio", icon: "🎵", label: "Audio" },
                ].map((ft) => (
                  <label
                    key={ft.val}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      padding: "10px 20px",
                      borderRadius: 10,
                      border: "1px solid",
                      borderColor: fileType === ft.val ? "#F97316" : "#E7E5E4",
                      background: fileType === ft.val ? "#FFF0E6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="filetype"
                      value={ft.val}
                      checked={fileType === ft.val}
                      onChange={() => setFileType(ft.val)}
                      style={{ accentColor: "#F97316" }}
                    />
                    <span style={{ fontSize: 16 }}>{ft.icon}</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: fileType === ft.val ? "#F97316" : "#1C1917",
                      }}
                    >
                      {ft.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {!isConnected && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#FFF7ED",
                  border: "1px solid #FED7AA",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#C2410C",
                  marginBottom: 14,
                }}
              >
                ⚠️ Connect your MetaMask wallet before decrypting.
              </div>
            )}

            <button
              id="decrypt-button"
              className="btn-primary"
              style={{ width: "100%", padding: "13px 20px" }}
              disabled={!sessionId.trim() || !isConnected}
              onClick={handleDecrypt}
            >
              {!isConnected ? "Connect wallet first" : "🔓 Decrypt Message"}
            </button>
          </motion.div>
        )}

        {/* Processing phases */}
        {["fetching", "verifying", "assembling", "decrypting"].includes(
          phase,
        ) && (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "3px solid #FFF0E6",
                borderTopColor: "#F97316",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <div style={{ fontWeight: 600, color: "#1C1917", marginBottom: 8 }}>
              {phase === "fetching" && "Fetching record from blockchain…"}
              {phase === "verifying" && "Waiting for MetaMask signature…"}
              {phase === "assembling" && "Submitting decryption request…"}
              {phase === "decrypting" && "Decrypting and extracting message…"}
            </div>
            {statusMsg && (
              <div
                style={{
                  fontSize: 12,
                  color: "#78716C",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                }}
              >
                {statusMsg}
              </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Signing confirmation */}
        {phase === "signing" && record && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{ padding: 28 }}
          >
            <div
              style={{
                marginBottom: 16,
                padding: 14,
                background: "#F0FDF4",
                borderRadius: 10,
                border: "1px solid #BBF7D0",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#16A34A",
                  marginBottom: 6,
                }}
              >
                ✓ Record found on blockchain
              </div>
              {record.sender && (
                <div style={{ fontSize: 12, color: "#78716C" }}>
                  From:{" "}
                  <span className="mono">{record.sender?.slice(0, 20)}…</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: "#78716C" }}>
                Record ID: <span className="mono">#{record.record_id}</span>
              </div>
            </div>

            <div
              style={{
                padding: "12px 16px",
                background: "#FFF7ED",
                border: "1px solid #FED7AA",
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#C2410C",
                  marginBottom: 4,
                }}
              >
                ⚠️ Two MetaMask steps required
              </div>
              <div style={{ fontSize: 12, color: "#78716C", lineHeight: 1.7 }}>
                <strong>Step 1:</strong> Sign a message (no gas) — proves your
                identity
                <br />
                <strong>Step 2:</strong> Confirm a transaction (small gas fee) —
                authorises decryption on-chain
                <br />
                <span style={{ color: "#92400E" }}>
                  Make sure your MetaMask is on{" "}
                  <strong>Ethereum Sepolia</strong> and has enough ETH.
                </span>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: "100%", padding: "13px 20px" }}
              onClick={handleSign}
            >
              🦊 Sign & Authorise Decryption
            </button>
          </motion.div>
        )}

        {/* Error */}
        {phase === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card"
            style={{ padding: 28, borderColor: "#FCA5A5" }}
          >
            <div
              style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}
            >
              ❌
            </div>
            <div
              style={{
                fontWeight: 700,
                color: "#DC2626",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Decryption Failed
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#78716C",
                textAlign: "center",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              {errorMsg?.includes("not the intended")
                ? "You are not the intended receiver of this message."
                : errorMsg?.includes("revoked")
                  ? "Record has been revoked on the blockchain."
                  : errorMsg}
            </div>
            <button
              className="btn-secondary"
              style={{ width: "100%" }}
              onClick={() => {
                setPhase("form");
                setErrorMsg("");
                setStatusMsg("");
              }}
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Done */}
        {phase === "done" && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <MediaDisplay
                mediaBs64={result.media_b64}
                mimeType={fileType === "audio" ? "audio/wav" : "image/png"}
                hiddenMessage={result.message}
                revealed={revealed}
              />
            </div>

            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#1C1917",
                  marginBottom: 12,
                }}
              >
                Message Details
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {record?.sender && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}
                    >
                      Sender
                    </span>
                    <HashDisplay value={record.sender} type="address" />
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}
                  >
                    Session
                  </span>
                  <HashDisplay
                    value={sessionId}
                    type="sessionid"
                    showLink={false}
                  />
                </div>
                {result.tx_hash && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}
                    >
                      Tx Hash
                    </span>
                    <HashDisplay value={result.tx_hash} type="txhash" />
                  </div>
                )}
              </div>
              <div style={{ marginTop: 14 }}>
                <SecurityBadge
                  layers={[
                    "steganography",
                    "aes256",
                    "blockchain",
                    "ipfs",
                    "merkle",
                  ]}
                />
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={handleDownload}
            >
              ⬇ Download Decrypted File
            </button>
          </motion.div>
        )}
      </main>
    </>
  );
}
