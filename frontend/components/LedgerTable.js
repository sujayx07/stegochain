// frontend/components/LedgerTable.js

function trunc(str = "", len = 16) {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded animate-pulse"
            style={{ backgroundColor: "#1e1e2e", width: `${60 + (i * 13) % 40}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full"
      style={{
        backgroundColor: active ? "rgba(34,197,94,0.12)"  : "rgba(239,68,68,0.12)",
        color:           active ? "#22c55e"               : "#F03E3E",
        border:          `1px solid ${active ? "#22c55e" : "#F03E3E"}`,
      }}
    >
      {active ? "Active" : "Revoked"}
    </span>
  );
}

export default function LedgerTable({
  records    = [],
  onVerify   = () => {},
  onRevoke   = () => {},
  loading    = false,
}) {
  const thStyle = {
    padding:         "12px 16px",
    textAlign:       "left",
    fontSize:        "12px",
    fontWeight:      "600",
    color:           "#94a3b8",
    borderBottom:    "1px solid #1e1e2e",
    textTransform:   "uppercase",
    letterSpacing:   "0.06em",
  };
  const tdStyle = {
    padding:      "12px 16px",
    fontSize:     "13px",
    color:        "#e2e8f0",
    borderBottom: "1px solid #1e1e2e",
    verticalAlign: "middle",
  };
  const btnBase = {
    padding:      "4px 10px",
    fontSize:     "12px",
    borderRadius: "4px",
    cursor:       "pointer",
    fontWeight:   "500",
    border:       "none",
  };

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid #1e1e2e", backgroundColor: "#13131a" }}
    >
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#0a0a0f" }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>CID</th>
              <th style={{ ...thStyle, display: "none" }} className="md:table-cell">Sender</th>
              <th style={{ ...thStyle, display: "none" }} className="md:table-cell">Receiver</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Timestamp</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "48px 16px" }}>
                  <p style={{ fontSize: "32px" }}>🔒</p>
                  <p style={{ color: "#94a3b8", marginTop: "8px" }} data-testid="empty-state">
                    No records found
                  </p>
                </td>
              </tr>
            ) : (
              records.map((rec, idx) => {
                const active = rec.is_active !== false && rec.status !== "revoked";
                return (
                  <tr
                    key={rec.record_id ?? idx}
                    data-testid={`record-row-${rec.record_id ?? idx}`}
                    style={{ transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(99,102,241,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td style={tdStyle}>
                      <span className="mono" style={{ color: "#6366f1" }}>
                        #{rec.record_id ?? idx}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="mono" style={{ fontSize: "12px" }} title={rec.cid}>
                        {trunc(rec.cid, 16)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, display: "none" }} className="md:table-cell">
                      <span className="mono" style={{ fontSize: "12px" }} title={rec.sender_address}>
                        {trunc(rec.sender_address, 12)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, display: "none" }} className="md:table-cell">
                      <span className="mono" style={{ fontSize: "12px" }} title={rec.receiver_address}>
                        {trunc(rec.receiver_address, 12)}
                      </span>
                    </td>
                    <td style={tdStyle}><StatusBadge active={active} /></td>
                    <td style={{ ...tdStyle, fontSize: "12px", color: "#94a3b8" }}>
                      {rec.timestamp
                        ? new Date(Number(rec.timestamp) * 1000).toLocaleString()
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onVerify(rec.record_id ?? idx)}
                          style={{ ...btnBase, backgroundColor: "rgba(99,102,241,0.12)", color: "#6366f1" }}
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => onRevoke(rec.record_id ?? idx)}
                          style={{ ...btnBase, backgroundColor: "rgba(239,68,68,0.12)", color: "#F03E3E" }}
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
