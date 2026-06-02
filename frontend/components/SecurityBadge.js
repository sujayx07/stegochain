import { useState } from "react";
import { Eye, Lock, Network, Cloud, Server, Shield } from "./Icons";

const LAYER_INFO = {
  steganography: { label: "Steganography", tip: "Message hidden inside media file using LSB/echo technique", icon: Eye },
  aes256:        { label: "AES-256",       tip: "Content encrypted with AES-256-CBC before embedding",     icon: Lock },
  blockchain:    { label: "Blockchain",    tip: "Record registered on Ethereum Sepolia smart contract",    icon: Network },
  ipfs:          { label: "IPFS",          tip: "Encrypted media stored on decentralised IPFS network",     icon: Cloud },
  merkle:        { label: "Merkle Proof",  tip: "Key fragments verified with Merkle tree on-chain",         icon: Server },
};

export default function SecurityBadge({ layers = [] }) {
  const [tooltip, setTooltip] = useState(null);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, position: "relative" }}>
      {layers.map(key => {
        const info = LAYER_INFO[key] || { label: key, tip: "", icon: Shield };
        const IconComponent = info.icon;
        return (
          <span
            key={key}
            onMouseEnter={() => setTooltip(key)}
            onMouseLeave={() => setTooltip(null)}
            style={{
              position: "relative",
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "#FFF4EB", color: "#B85A0C",
              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
              cursor: "default", userSelect: "none"
            }}
          >
            <IconComponent size={12} style={{ color: "#B85A0C" }} />
            {info.label}
            {tooltip === key && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
                transform: "translateX(-50%)",
                background: "#111111", color: "white",
                padding: "6px 10px", borderRadius: 8, fontSize: 11,
                whiteSpace: "nowrap", pointerEvents: "none", zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
              }}>
                {info.tip}
                <div style={{
                  position: "absolute", top: "100%", left: "50%",
                  transform: "translateX(-50%)",
                  border: "4px solid transparent",
                  borderTopColor: "#111111"
                }}/>
              </div>
            )}
          </span>
        );
      })}
    </div>
  );
}
