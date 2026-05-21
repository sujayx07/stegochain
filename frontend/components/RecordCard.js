import { useState } from "react";
import { motion } from "framer-motion";
import HashDisplay from "./HashDisplay";
import StatusBadge from "./StatusBadge";
import SecurityBadge from "./SecurityBadge";
import { formatTimestamp } from "../utils/crypto";

export default function RecordCard({ record, showActions = false, onRevoke, onVerify }) {
  const [expanded, setExpanded] = useState(false);
  if (!record) return null;

  const layers = ["steganography", "aes256", "blockchain", "ipfs", "merkle"];

  return (
    <motion.div
      className="card"
      whileHover={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
      style={{ padding: 20, cursor: "pointer", transition: "box-shadow 0.2s" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="badge-orange" style={{ fontFamily: "monospace" }}>#{record.record_id || record.id}</span>
          <StatusBadge status={record.revoked ? "revoked" : "active"} size="sm"/>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#78716C", fontSize: 13 }}
        >
          {expanded ? "▲ Less" : "▼ More"}
        </button>
      </div>

      {/* Main info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {record.ipfs_cid && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>IPFS CID</span>
            <HashDisplay value={record.ipfs_cid} type="cid"/>
          </div>
        )}
        {record.session_id && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>Session</span>
            <HashDisplay value={record.session_id} type="sessionid" showLink={false}/>
          </div>
        )}
        {record.tx_hash && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>Tx Hash</span>
            <HashDisplay value={record.tx_hash} type="txhash"/>
          </div>
        )}
      </div>

      {/* Security layers */}
      <div style={{ marginTop: 12 }}>
        <SecurityBadge layers={layers}/>
      </div>

      {/* Timestamp */}
      <div style={{ marginTop: 10, fontSize: 12, color: "#A8A29E" }}>
        {formatTimestamp(record.timestamp || record.created_at)}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #E7E5E4" }}>
          {record.sender && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>Sender</span>
              <HashDisplay value={record.sender} type="address"/>
            </div>
          )}
          {record.receiver && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>Receiver</span>
              <HashDisplay value={record.receiver} type="address"/>
            </div>
          )}
          {record.merkle_root && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#78716C", minWidth: 80 }}>Merkle Root</span>
              <HashDisplay value={record.merkle_root} type="txhash" showLink={false}/>
            </div>
          )}

          {showActions && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {onVerify && (
                <button onClick={() => onVerify(record)} style={{
                  background: "none", border: "1px solid #F97316", color: "#F97316",
                  borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer"
                }}>
                  Verify Integrity
                </button>
              )}
              {onRevoke && !record.revoked && (
                <button onClick={() => onRevoke(record)} style={{
                  background: "none", border: "1px solid #DC2626", color: "#DC2626",
                  borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer"
                }}>
                  Revoke
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
