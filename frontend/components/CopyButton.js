import { useState } from "react";
import toast from "react-hot-toast";

export default function CopyButton({ text, size = "md" }) {
  const [copied, setCopied] = useState(false);
  const dim = size === "sm" ? 14 : 16;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: 4, borderRadius: 6, display: "inline-flex",
        alignItems: "center", transition: "background 0.15s"
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#F8F7F5"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >
      {copied ? (
        <svg width={dim} height={dim} viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width={dim} height={dim} viewBox="0 0 16 16" fill="none">
          <rect x="5" y="1" width="9" height="11" rx="2" stroke="#78716C" strokeWidth="1.3"/>
          <rect x="1" y="4" width="9" height="11" rx="2" stroke="#78716C" strokeWidth="1.3" fill="white"/>
        </svg>
      )}
    </button>
  );
}
