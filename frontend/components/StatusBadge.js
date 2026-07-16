const STATUS_MAP = {
  active:   { label: "Active",   bg: "#DCFCE7", color: "#1A9F4A", dot: "#1A9F4A" },
  revoked:  { label: "Revoked",  bg: "#FEE2E2", color: "#E03131", dot: "#E03131" },
  pending:  { label: "Pending",  bg: "#FFFAF0", color: "#CF8100", dot: "#CF8100" },
  complete: { label: "Complete", bg: "#DCFCE7", color: "#1A9F4A", dot: "#1A9F4A" },
  failed:   { label: "Failed",   bg: "#FEE2E2", color: "#E03131", dot: "#E03131" },
};

export default function StatusBadge({ status, size = "md" }) {
  const s = STATUS_MAP[status] || { label: status, bg: "#FAFAFA", color: "#888888", dot: "#BBBBBB" };
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
