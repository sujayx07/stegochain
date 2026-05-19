// frontend/pages/receive.js
import Head from "next/head";
import { useState } from "react";
import Navbar from "../components/Navbar";
import { receiveMessage } from "../utils/api";

const INPUT_STYLE = {
  backgroundColor: "#13131a",
  border:          "1px solid #1e1e2e",
  color:           "#e2e8f0",
  borderRadius:    "6px",
  padding:         "10px 12px",
  width:           "100%",
  fontSize:        "14px",
};

const LABEL_STYLE = {
  display:      "block",
  marginBottom: "6px",
  fontSize:     "13px",
  fontWeight:   "500",
  color:        "#94a3b8",
};

export default function ReceivePage() {
  const [sessionId, setSessionId] = useState("");
  const [fileType,  setFileType]  = useState("image");
  const [ownerIds,  setOwnerIds]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setResult(null);
    const ids = ownerIds.split("\n").map(s => s.trim()).filter(Boolean);
    if (!sessionId.trim()) { setError("Session ID is required"); return; }
    if (ids.length === 0)  { setError("At least one owner ID is required"); return; }
    setLoading(true);
    try {
      const res = await receiveMessage({ session_id: sessionId.trim(), owner_ids: ids, file_type: fileType });
      setResult(res);
    } catch (err) {
      const msg = err.message || "Decryption failed";
      if (msg.includes("revoked") || msg.includes("403"))
        setError("🔒 Access denied: this record has been revoked on-chain.");
      else if (msg.includes("Insufficient") || msg.includes("400"))
        setError("⚠️ Insufficient shares: provide at least k owner IDs.");
      else
        setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Receive Message — StegoChain</title>
        <meta name="description" content="Decrypt and retrieve a hidden steganographic message using your session ID and owner shares." />
      </Head>
      <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0f" }}>
        <Navbar />
        <main className="max-w-2xl mx-auto px-6 py-16">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#e2e8f0" }}>
            Retrieve Hidden Message
          </h1>
          <p className="mb-10" style={{ color: "#94a3b8" }}>
            Provide the session ID and at least k owner IDs to reconstruct the key and decrypt.
          </p>

          <div style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e", borderRadius: "12px", padding: "28px 24px" }}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Session ID */}
              <div>
                <label style={LABEL_STYLE}>Session ID</label>
                <input
                  data-testid="session-id-input"
                  type="text"
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  placeholder="Paste your session ID..."
                  style={{ ...INPUT_STYLE, fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>

              {/* File type */}
              <div>
                <label style={LABEL_STYLE}>File Type</label>
                <div className="flex gap-6">
                  {["image", "audio"].map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer" style={{ color: "#e2e8f0", fontSize: "14px" }}>
                      <input
                        type="radio"
                        name="file_type"
                        value={t}
                        checked={fileType === t}
                        onChange={() => setFileType(t)}
                        style={{ accentColor: "#6366f1" }}
                      />
                      {t === "image" ? "🖼️ Image" : "🔊 Audio"}
                    </label>
                  ))}
                </div>
              </div>

              {/* Owner IDs */}
              <div>
                <label style={LABEL_STYLE}>Owner IDs (one per line, minimum k IDs needed)</label>
                <textarea
                  data-testid="owner-ids-textarea"
                  rows={5}
                  value={ownerIds}
                  onChange={e => setOwnerIds(e.target.value)}
                  placeholder={"owner_1\nowner_2\nowner_3"}
                  style={{ ...INPUT_STYLE, resize: "vertical", fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "14px" }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                data-testid="decrypt-button"
                className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold"
                style={{ backgroundColor: "#6366f1", color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
              >
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? "Reconstructing key and decrypting..." : "Decrypt Message"}
              </button>
            </form>
          </div>

          {/* Result */}
          {result && (
            <div className="mt-8 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(34,197,94,0.4)" }}>
              <div className="px-5 py-3" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>
                <p className="font-semibold" style={{ color: "#22c55e" }}>✅ Message Successfully Decrypted</p>
              </div>
              <div className="p-6" style={{ backgroundColor: "#13131a" }}>
                {/* Message */}
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#94a3b8" }}>Hidden Message</p>
                  <div className="p-4 rounded-lg mono text-lg" style={{ backgroundColor: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", wordBreak: "break-word" }}>
                    {result.message}
                  </div>
                </div>
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="mb-1" style={{ color: "#94a3b8" }}>Blockchain Verification</p>
                    <p style={{ color: result.blockchain_verified ? "#22c55e" : "#f59e0b" }}>
                      {result.blockchain_verified ? "✅ Verified on Chain" : "⚠️ Unverified"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1" style={{ color: "#94a3b8" }}>Sender</p>
                    <p className="mono text-xs" style={{ color: "#e2e8f0" }}>{result.sender_id || "—"}</p>
                  </div>
                  <div>
                    <p className="mb-1" style={{ color: "#94a3b8" }}>Session ID</p>
                    <p className="mono text-xs" style={{ color: "#6366f1" }}>{result.session_id || sessionId}</p>
                  </div>
                  <div>
                    <p className="mb-1" style={{ color: "#94a3b8" }}>File Type</p>
                    <p style={{ color: "#e2e8f0" }}>{result.file_type || fileType}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
