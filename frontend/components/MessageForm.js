// frontend/components/MessageForm.js
import { useState } from "react";

const inputStyle = {
  backgroundColor: "#13131a",
  border:          "1px solid #1e1e2e",
  color:           "#e2e8f0",
  borderRadius:    "6px",
  padding:         "10px 12px",
  width:           "100%",
  fontSize:        "14px",
  outline:         "none",
};

const labelStyle = {
  display:       "block",
  marginBottom:  "6px",
  fontSize:      "13px",
  fontWeight:    "500",
  color:         "#94a3b8",
};

export default function MessageForm({
  onSubmit,
  loading    = false,
  buttonLabel = "Send",
}) {
  const [message,   setMessage]   = useState("");
  const [k,         setK]         = useState(3);
  const [n,         setN]         = useState(5);
  const [receiver,  setReceiver]  = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error,     setError]     = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (Number(k) > Number(n)) {
      setError(`Threshold k (${k}) must be ≤ total shares n (${n})`);
      return;
    }
    if (Number(k) < 2) {
      setError("Minimum threshold k is 2");
      return;
    }
    if (!message.trim()) {
      setError("Message cannot be empty");
      return;
    }

    onSubmit({ message, k: Number(k), n: Number(n), receiver_eth_address: receiver, session_id: sessionId });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Message */}
      <div>
        <label style={labelStyle}>Secret Message</label>
        <textarea
          data-testid="message-textarea"
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter your secret message..."
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {/* k / n */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label style={labelStyle}>Minimum shares to decrypt (k)</label>
          <input
            data-testid="input-k"
            type="number"
            min={2}
            value={k}
            onChange={e => setK(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div className="flex-1">
          <label style={labelStyle}>Total shares to create (n)</label>
          <input
            data-testid="input-n"
            type="number"
            min={2}
            value={n}
            onChange={e => setN(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Receiver Ethereum address */}
      <div>
        <label style={labelStyle}>Receiver Ethereum Address</label>
        <input
          type="text"
          value={receiver}
          onChange={e => setReceiver(e.target.value)}
          placeholder="0x..."
          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>

      {/* Optional session ID */}
      <div>
        <label style={labelStyle}>Custom Session ID (optional)</label>
        <input
          type="text"
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
          placeholder="Leave blank to auto-generate"
          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>

      {/* Inline validation error */}
      {error && (
        <p
          data-testid="form-error"
          className="text-sm px-3 py-2 rounded"
          style={{ color: "#F03E3E", backgroundColor: "rgba(239,68,68,0.08)" }}
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        data-testid="submit-button"
        className="flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-opacity"
        style={{
          backgroundColor: "#6366f1",
          color:           "#fff",
          opacity:         loading ? 0.7 : 1,
          cursor:          loading ? "not-allowed" : "pointer",
          border:          "none",
        }}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {buttonLabel}
      </button>
    </form>
  );
}
