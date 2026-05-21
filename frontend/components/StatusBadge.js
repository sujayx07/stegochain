const STATUS_MAP = {
  active:   { label: "Active",   bg: "#DCFCE7", color: "#16A34A", dot: "#16A34A" },
  revoked:  { label: "Revoked",  bg: "#FEE2E2", color: "#DC2626", dot: "#DC2626" },
  pending:  { label: "Pending",  bg: "#FEF3C7", color: "#D97706", dot: "#D97706" },
  complete: { label: "Complete", bg: "#DCFCE7", color: "#16A34A", dot: "#16A34A" },
  failed:   { label: "Failed",   bg: "#FEE2E2", color: "#DC2626", dot: "#DC2626" },
};

export default function StatusBadge({ status, size = "md" }) {
  const s = STATUS_MAP[status] || { label: status, bg: "#F8F7F5", color: "#78716C", dot: "#A8A29E" };
  const fontSize = size === "sm" ? 11 : 12;
  const dotSize = size === "sm" ? 6 : 7;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color,
      padding: size === "sm" ? "2px 8px" : "3px 10px",
      borderRadius: 20, fontSize, fontWeight: 500
    }}>
      <span style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: s.dot, flexShrink: 0 }}/>
      {s.label}
    </span>
  );
}
