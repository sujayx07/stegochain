export default function LoadingSkeleton({ type = "card", count = 3 }) {
  if (type === "card") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ borderRadius: 14, border: "1.5px solid #E7E5E4", overflow: "hidden" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg,#F0EDE9,#E8E4DF,#F0EDE9)", backgroundSize: "200% 100%", animation: "shimmer 1.6s ease-in-out infinite" }} />
            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="shimmer" style={{ width: 48, height: 22, borderRadius: 20 }} />
                  <div className="shimmer" style={{ width: 64, height: 22, borderRadius: 20 }} />
                </div>
                <div className="shimmer" style={{ width: 80, height: 16, borderRadius: 8 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="shimmer" style={{ width: 56, height: 14, borderRadius: 6 }} />
                  <div className="shimmer" style={{ width: 160, height: 14, borderRadius: 6 }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="shimmer" style={{ width: 56, height: 14, borderRadius: 6 }} />
                  <div className="shimmer" style={{ width: 200, height: 14, borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[60, 50, 70, 55, 65].map((w, j) => (
                  <div key={j} className="shimmer" style={{ width: w, height: 20, borderRadius: 20 }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "stat") {
    return (
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: 160, padding: "24px 28px", background: "white", borderRadius: 14, border: "1.5px solid #E7E5E4" }}>
            <div className="shimmer" style={{ width: 60, height: 32, borderRadius: 8, marginBottom: 10 }} />
            <div className="shimmer" style={{ width: 100, height: 14, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    );
  }

  if (type === "list") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "white", borderRadius: 10, border: "1px solid #E7E5E4" }}>
            <div className="shimmer" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="shimmer" style={{ width: "60%", height: 14, borderRadius: 6, marginBottom: 6 }} />
              <div className="shimmer" style={{ width: "40%", height: 12, borderRadius: 6 }} />
            </div>
            <div className="shimmer" style={{ width: 64, height: 22, borderRadius: 20 }} />
          </div>
        ))}
      </div>
    );
  }

  // Table rows
  if (type === "table") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 16, padding: "14px 16px", background: i % 2 === 0 ? "white" : "#FAFAF9", borderBottom: "1px solid #F0EDE9" }}>
            <div className="shimmer" style={{ width: 40, height: 14, borderRadius: 6 }} />
            <div className="shimmer" style={{ width: 120, height: 14, borderRadius: 6 }} />
            <div className="shimmer" style={{ flex: 1, height: 14, borderRadius: 6 }} />
            <div className="shimmer" style={{ width: 80, height: 14, borderRadius: 6 }} />
            <div className="shimmer" style={{ width: 60, height: 20, borderRadius: 20 }} />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
