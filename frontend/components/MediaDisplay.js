import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function MediaDisplay({ mediaBs64, mimeType, hiddenMessage, revealed }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!mediaBs64 || !mimeType) return;
    const byteString = atob(mediaBs64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mimeType });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaBs64, mimeType]);

  const isImage = mimeType && mimeType.startsWith("image/");
  const isAudio = mimeType && mimeType.startsWith("audio/");

  return (
    <div style={{ position: "relative" }}>
      {/* Media */}
      <motion.div
        animate={revealed ? { y: -8 } : { y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E7E5E4" }}
      >
        {isImage && blobUrl && (
          <img src={blobUrl} alt="Decrypted media" style={{ width: "100%", display: "block", maxHeight: 400, objectFit: "contain", background: "#F8F7F5" }}/>
        )}
        {isAudio && blobUrl && (
          <div style={{ padding: 24, background: "#FFF0E6" }}>
            <audio controls src={blobUrl} style={{ width: "100%" }}/>
          </div>
        )}
        {!blobUrl && (
          <div className="shimmer-bg" style={{ width: "100%", height: 200 }}/>
        )}

        {/* Lock overlay */}
        <AnimatePresence>
          {!revealed && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "linear-gradient(transparent, rgba(28,25,23,0.85))",
                padding: "30px 20px 20px",
                display: "flex", alignItems: "center", gap: 10
              }}
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" fill="#F97316"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="white"/>
                </svg>
              </motion.div>
              <span style={{ color: "white", fontSize: 14, fontWeight: 500 }}>Hidden message encrypted inside this file</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Revealed message */}
      <AnimatePresence>
        {revealed && hiddenMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.3 }}
            style={{
              marginTop: 16, background: "#FFF0E6",
              border: "1px solid #FED7AA", borderRadius: 16, padding: 20
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#F97316" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#F97316" strokeWidth="0.5" strokeDasharray="2"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#C2410C" }}>Decrypted Message</span>
              <span style={{ fontSize: 11, background: "#16A34A", color: "white", padding: "2px 8px", borderRadius: 20, marginLeft: "auto" }}>✓ Blockchain Verified</span>
            </div>
            <p className="mono" style={{ fontSize: 15, color: "#1C1917", lineHeight: 1.6, margin: 0, wordBreak: "break-word" }}>
              {hiddenMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
