import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HashDisplay from "./HashDisplay";
import StatusBadge from "./StatusBadge";
import SecurityBadge from "./SecurityBadge";
import { formatTimestamp } from "../utils/crypto";
import { Search, Cross } from "./Icons";

export default function RecordCard({ record, showActions = false, onRevoke, onVerify }) {
  const [expanded, setExpanded] = useState(false);
  if (!record) return null;

  const isActive = !record.revoked;
  const layers = ["steganography", "aes256", "blockchain", "ipfs", "merkle"];

  return (
    <motion.div
      className="card"
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", borderColor: "#F9DCC4" }}
      style={{ padding: 0, cursor: "default", overflow: "hidden", transition: "border-color 0.2s" }}
    >
      {/* Status accent top line */}
      <div style={{ height: 3, background: isActive ? "linear-gradient(90deg,#E8680C,#F09C00)" : "linear-gradient(90deg,#E03131,#F03E3E)", transition: "background 0.3s" }} />

      <div style={{ padding: "16px 18px" }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge badge-orange mono" style={{ fontSize: 11 }}>#{record.record_id || record.id || "—"}</span>
            <StatusBadge status={record.revoked ? "revoked" : "active"} size="sm" />
            {record.total_fragments && (
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>{record.total_fragments} frags</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#BBBBBB" }}>
              {formatTimestamp(record.timestamp || record.created_at)}
            </span>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", cursor: "pointer", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#E8680C"; e.currentTarget.style.background = "#FFF4EB"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#EBEBEB"; e.currentTarget.style.background = "#FAFAFA"; }}
            >
              <motion.svg animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="#888888" strokeWidth="1.8" strokeLinecap="round"/>
              </motion.svg>
            </button>
          </div>
        </div>

        {/* Core fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {record.ipfs_cid && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#888888", minWidth: 76, fontWeight: 500 }}>IPFS CID</span>
              <HashDisplay value={record.ipfs_cid} type="cid" />
            </div>
          )}
          {record.session_id && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#888888", minWidth: 76, fontWeight: 500 }}>Session</span>
              <HashDisplay value={record.session_id} type="sessionid" showLink={false} />
            </div>
          )}
          {record.tx_hash && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#888888", minWidth: 76, fontWeight: 500 }}>Tx Hash</span>
              <HashDisplay value={record.tx_hash} type="txhash" />
            </div>
          )}
        </div>

        {/* Security badges */}
        <div style={{ marginTop: 12 }}>
          <SecurityBadge layers={layers} />
        </div>
      </div>

      {/* Expanded section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid #F5F5F5", padding: "14px 18px", background: "#FFFFFF" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {record.sender && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#888888", minWidth: 76, fontWeight: 500 }}>Sender</span>
                    <HashDisplay value={record.sender} type="address" />
                  </div>
                )}
                {record.receiver && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#888888", minWidth: 76, fontWeight: 500 }}>Receiver</span>
                    <HashDisplay value={record.receiver} type="address" />
                  </div>
                )}
                {record.merkle_root && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#888888", minWidth: 76, fontWeight: 500 }}>Merkle Root</span>
                    <HashDisplay value={record.merkle_root} type="txhash" showLink={false} />
                  </div>
                )}
                {record.media_hash && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#888888", minWidth: 76, fontWeight: 500 }}>Media Hash</span>
                    <HashDisplay value={record.media_hash} type="txhash" showLink={false} />
                  </div>
                )}
              </div>

              {showActions && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  {onVerify && (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => onVerify(record)}
                      style={{ background: "white", border: "1.5px solid #E8680C", color: "#E8680C", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", fontFamily: "Inter, sans-serif", display: "inline-flex", alignItems: "center", gap: 6 }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FFF4EB"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}
                    >
                      <Search size={12} /> Verify Integrity
                    </motion.button>
                  )}
                  {onRevoke && !record.revoked && (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => onRevoke(record)}
                      style={{ background: "white", border: "1.5px solid #E03131", color: "#E03131", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", fontFamily: "Inter, sans-serif", display: "inline-flex", alignItems: "center", gap: 6 }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FFF0F0"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}
                    >
                      <Cross size={12} /> Revoke
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
