import { useWallet } from "../context/WalletContext";
import { truncateAddress } from "../utils/crypto";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Wallet, AlertTriangle, MetaMask } from "./Icons";

export default function WalletButton({ size = "md", className = "" }) {
  const { isConnected, connecting, connect, address, isCorrectChain, switchToSepolia } = useWallet();
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasMetaMask = typeof window !== "undefined" && !!window.ethereum;

  const sizes = {
    sm: { padding: "6px 12px", fontSize: 12 },
    md: { padding: "10px 20px", fontSize: 14 },
    lg: { padding: "14px 28px", fontSize: 16 }
  };
  const s = sizes[size] || sizes.md;

  if (!mounted) {
    return (
      <button className={`btn-primary ${className}`} style={{ ...s, display: "inline-flex", alignItems: "center", gap: 8, opacity: 0 }}>
        <MetaMask size={size === "sm" ? 14 : size === "lg" ? 18 : 16} /> Connect Wallet
      </button>
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  if (!hasMetaMask) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className={`btn-secondary ${className}`}
        style={{ ...s, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
      >
        <MetaMask size={size === "sm" ? 16 : size === "lg" ? 20 : 18} /> Install MetaMask
      </a>
    );
  }

  if (connecting) {
    return (
      <button disabled className={`btn-primary ${className}`} style={{ ...s, display: "inline-flex", alignItems: "center", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 1s linear infinite" }}>
          <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="2" fill="none" strokeDasharray="20" strokeDashoffset="5"/>
        </svg>
        Connecting…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </button>
    );
  }

  if (isConnected && !isCorrectChain) {
    return (
      <button onClick={switchToSepolia} className={className} style={{
        ...s, background: "#CF8100", color: "white", border: "none",
        borderRadius: 10, fontWeight: 500, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8
      }}>
        <AlertTriangle size={size === "sm" ? 14 : size === "lg" ? 18 : 16} /> Switch Network
      </button>
    );
  }

  if (isConnected) {
    return (
      <button onClick={handleCopy} className={`btn-secondary ${className}`} style={{
        ...s, display: "inline-flex", alignItems: "center", gap: 8
      }}>
        <MetaMask size={size === "sm" ? 14 : size === "lg" ? 18 : 16} style={{ flexShrink: 0 }} />
        <span className="mono">{truncateAddress(address)}</span>
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3 3 7-7" stroke="#1A9F4A" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="4" y="1" width="8" height="10" rx="2" stroke="#888888" strokeWidth="1.3"/>
            <rect x="1" y="4" width="8" height="10" rx="2" stroke="#888888" strokeWidth="1.3" fill="white"/>
          </svg>
        )}
      </button>
    );
  }

  return (
    <button onClick={connect} className={`btn-primary ${className}`} style={{ ...s, display: "inline-flex", alignItems: "center", gap: 8 }}>
      <MetaMask size={size === "sm" ? 16 : size === "lg" ? 20 : 18} />
      <span>Connect Wallet</span>
    </button>
  );
}

