import { useEffect, useState } from "react";

export default function TechBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
        backgroundColor: "#FCFAF7", // Soft warm off-white base
      }}
    >
      {/* Soft Static Orange Bubble - Top Left */}
      <div
        style={{
          position: "absolute",
          top: "-5%",
          left: "-12%",
          width: "35vw",
          height: "35vw",
          maxWidth: "500px",
          maxHeight: "500px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FFF0E2 0%, #FFF4EB 100%)",
          opacity: 0.9,
          willChange: "auto",
        }}
      />

      {/* Soft Static Orange Bubble - Center Right */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          right: "-10%",
          width: "42vw",
          height: "42vw",
          maxWidth: "580px",
          maxHeight: "580px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FFF2E6 0%, #FFF7F0 100%)",
          opacity: 0.9,
          willChange: "auto",
        }}
      />

      {/* Soft Static Orange Bubble - Bottom Left/Center */}
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "25%",
          width: "38vw",
          height: "38vw",
          maxWidth: "520px",
          maxHeight: "520px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FFF0E2 0%, #FFF6EE 100%)",
          opacity: 0.75,
          willChange: "auto",
        }}
      />

      {/* Fine Dot Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(232,104,12,0.035) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          opacity: 0.8,
          zIndex: 1,
        }}
      />
    </div>
  );
}
