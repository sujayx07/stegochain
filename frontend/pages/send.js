// frontend/pages/send.js
import Head from "next/head";
import { useState } from "react";
import Navbar from "../components/Navbar";
import MessageForm from "../components/MessageForm";
import UploadMedia from "../components/UploadMedia";
import { sendMessage } from "../utils/api";

const STEPS = ["Upload", "Compose", "Review", "Send"];

const PIPELINE_STEPS = [
  "Embedding message...",
  "Encrypting...",
  "Uploading to IPFS...",
  "Registering on blockchain...",
  "Splitting keys...",
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", backgroundColor: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer" }}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function SendPage() {
  const [step,       setStep]       = useState(0);
  const [file,       setFile]       = useState(null);
  const [formValues, setFormValues] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [pipeStep,   setPipeStep]   = useState(0);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState("");

  function handleFileSelected(f) { setFile(f); }
  function handleCompose(vals)   { setFormValues(vals); }

  async function handleSend() {
    setLoading(true); setError(""); setPipeStep(0);
    // Animate pipeline steps
    const interval = setInterval(() => setPipeStep(p => Math.min(p + 1, PIPELINE_STEPS.length - 1)), 1200);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("message",               formValues.message);
      fd.append("file_type",             file.type.startsWith("audio") ? "audio" : "image");
      fd.append("k",                     String(formValues.k));
      fd.append("n",                     String(formValues.n));
      fd.append("receiver_eth_address",  formValues.receiver_eth_address || "");
      fd.append("sender_id",             "web_user");
      fd.append("receiver_id",           "web_receiver");
      const n = formValues.n;
      const owners = Array.from({ length: n }, (_, i) => `owner_${i + 1}`);
      fd.append("owner_ids", owners.join(","));
      const res = await sendMessage(fd);
      setResult(res);
      setStep(4); // success
    } catch (err) {
      setError(err.message || "Send pipeline failed");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Send Message — StegoChain</title>
        <meta name="description" content="Securely embed and send a hidden message using steganography and blockchain." />
      </Head>
      <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0f" }}>
        <Navbar />
        <main className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#e2e8f0" }}>Send Hidden Message</h1>
          <p className="mb-8" style={{ color: "#94a3b8" }}>Four steps to embed, encrypt, and anchor your message on-chain.</p>

          {/* Step indicator */}
          {step < 4 && (
            <div className="flex items-center mb-10">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: i <= step ? "#6366f1" : "#1e1e2e", color: i <= step ? "#fff" : "#94a3b8" }}
                    >
                      {i < step ? "✓" : i + 1}
                    </div>
                    <span className="text-xs mt-1" style={{ color: i === step ? "#6366f1" : "#94a3b8" }}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-2 mt-px" style={{ backgroundColor: i < step ? "#6366f1" : "#1e1e2e" }} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e", borderRadius: "12px", padding: "28px 24px" }}>

            {/* Step 0 — Upload */}
            {step === 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4" style={{ color: "#e2e8f0" }}>Step 1 — Upload Cover File</h2>
                <UploadMedia
                  onFileSelected={handleFileSelected}
                  accept="image/png,image/bmp,.wav,audio/wav"
                  label="Select an image (PNG/BMP) or audio (WAV) file"
                />
                <button
                  disabled={!file}
                  onClick={() => setStep(1)}
                  className="mt-6 px-6 py-2.5 rounded-lg font-semibold"
                  style={{ backgroundColor: file ? "#6366f1" : "#1e1e2e", color: file ? "#fff" : "#94a3b8", border: "none", cursor: file ? "pointer" : "not-allowed" }}
                >
                  Next: Compose Message →
                </button>
              </div>
            )}

            {/* Step 1 — Compose */}
            {step === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-4" style={{ color: "#e2e8f0" }}>Step 2 — Compose Message</h2>
                <MessageForm
                  onSubmit={vals => { handleCompose(vals); setStep(2); }}
                  loading={false}
                  buttonLabel="Next: Review →"
                />
              </div>
            )}

            {/* Step 2 — Review */}
            {step === 2 && formValues && (
              <div>
                <h2 className="text-lg font-semibold mb-6" style={{ color: "#e2e8f0" }}>Step 3 — Review</h2>
                <dl className="flex flex-col gap-3 text-sm">
                  {[
                    ["File",       `${file?.name} (${file?.type})`],
                    ["Message",    `${formValues.message.length} characters`],
                    ["k-of-n",     `${formValues.k} of ${formValues.n} shares`],
                    ["Receiver",   formValues.receiver_eth_address || "Not specified"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2" style={{ borderBottom: "1px solid #1e1e2e" }}>
                      <dt style={{ color: "#94a3b8" }}>{label}</dt>
                      <dd className="mono" style={{ color: "#e2e8f0" }}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep(1)} style={{ flex: 1, padding: "10px", backgroundColor: "#13131a", color: "#94a3b8", border: "1px solid #1e1e2e", borderRadius: "8px", cursor: "pointer" }}>← Back</button>
                  <button onClick={() => { setStep(3); handleSend(); }} style={{ flex: 2, padding: "10px", backgroundColor: "#6366f1", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
                    🚀 Send Message
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Loading */}
            {step === 3 && loading && (
              <div className="py-4">
                <h2 className="text-lg font-semibold mb-6" style={{ color: "#e2e8f0" }}>Step 4 — Processing Pipeline...</h2>
                <div className="flex flex-col gap-3">
                  {PIPELINE_STEPS.map((label, i) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span style={{ width: "20px", color: i <= pipeStep ? "#22c55e" : "#94a3b8" }}>
                        {i < pipeStep ? "✅" : i === pipeStep ? "⏳" : "○"}
                      </span>
                      <span style={{ color: i <= pipeStep ? "#e2e8f0" : "#94a3b8" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4 — Success */}
            {step === 4 && result && (
              <div>
                <div className="mb-6 px-4 py-3 rounded-lg" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <p className="font-semibold" style={{ color: "#22c55e" }}>✅ Message Sent Successfully</p>
                  <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>Share the Session ID with your receiver to allow decryption.</p>
                </div>
                {[
                  ["Session ID",          result.session_id,            true],
                  ["IPFS CID",            result.ipfs_cid,              true],
                  ["Transaction Hash",    result.tx_hash,               true],
                  ["Blockchain Record",   `#${result.blockchain_record_id}`, false],
                ].map(([label, value, copy]) => (
                  <div key={label} className="flex justify-between items-center py-3" style={{ borderBottom: "1px solid #1e1e2e" }}>
                    <span className="text-sm" style={{ color: "#94a3b8" }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="mono text-sm" style={{ color: "#e2e8f0" }}>{String(value).slice(0, 24)}{String(value).length > 24 ? "..." : ""}</span>
                      {copy && <CopyButton text={String(value)} />}
                    </div>
                  </div>
                ))}
                {result.ipfs_gateway_url && (
                  <a href={result.ipfs_gateway_url} target="_blank" rel="noreferrer" className="block mt-4 text-sm text-center" style={{ color: "#6366f1" }}>
                    🌐 View on IPFS Gateway →
                  </a>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "14px" }}>
                <p className="font-semibold mb-1">❌ Pipeline Failed</p>
                <p>{error}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
