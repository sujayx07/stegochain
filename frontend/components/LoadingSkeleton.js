function ShimmerBlock({ width = "100%", height = 20, radius = 8, style = {} }) {
  return (
    <div className="shimmer-bg" style={{ width, height, borderRadius: radius, ...style }}/>
  );
}

export default function LoadingSkeleton({ type = "card", count = 1 }) {
  const items = Array.from({ length: count });

  if (type === "card") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((_, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <ShimmerBlock width={120} height={18} />
              <ShimmerBlock width={60} height={18} radius={20} />
            </div>
            <ShimmerBlock height={14} style={{ marginBottom: 8 }} />
            <ShimmerBlock width="70%" height={14} style={{ marginBottom: 8 }} />
            <ShimmerBlock width="50%" height={14} />
          </div>
        ))}
      </div>
    );
  }

  if (type === "row") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
            <ShimmerBlock width={32} height={32} radius="50%" />
            <div style={{ flex: 1 }}>
              <ShimmerBlock height={14} style={{ marginBottom: 6 }} />
              <ShimmerBlock width="60%" height={12} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "text") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((_, i) => (
          <ShimmerBlock key={i} height={14} width={`${60 + (i % 3) * 15}%`} />
        ))}
      </div>
    );
  }

  if (type === "avatar") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ShimmerBlock width={48} height={48} radius="50%" />
        <div style={{ flex: 1 }}>
          <ShimmerBlock height={16} width={140} style={{ marginBottom: 6 }} />
          <ShimmerBlock height={12} width={100} />
        </div>
      </div>
    );
  }

  return null;
}
