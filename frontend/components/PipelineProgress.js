import { motion, AnimatePresence } from "framer-motion";

const ICONS = {
  pending:  <circle cx="12" cy="12" r="8" stroke="#DDDDDD" strokeWidth="2" fill="none"/>,
  loading:  null,
  complete: (
    <>
      <circle cx="12" cy="12" r="8" fill="#1A9F4A"/>
      <path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8" fill="#E03131"/>
      <path d="M9 9l6 6M15 9l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </>
  )
};

export default function PipelineProgress({ steps = [] }) {
  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", gap: 0 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 80 }}>
              <div style={{ position: "relative", width: 40, height: 40 }}>
                {step.status === "loading" ? (
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    border: "3px solid #FFF4EB",
                    borderTopColor: "#E8680C",
                    animation: "spin 0.8s linear infinite"
                  }}/>
                ) : (
                  <motion.svg
                    width="40" height="40" viewBox="0 0 24 24" fill="none"
                    initial={step.status === "complete" ? { scale: 0.5 } : {}}
                    animate={step.status === "complete" ? { scale: 1 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    {ICONS[step.status] || ICONS.pending}
                  </motion.svg>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 500, textAlign: "center",
                color: step.status === "complete" ? "#1A9F4A"
                     : step.status === "loading"  ? "#E8680C"
                     : step.status === "error"    ? "#E03131"
                     : "#BBBBBB",
                maxWidth: 72
              }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ position: "relative", width: 40, height: 2, margin: "0 0 20px" }}>
                <div style={{ width: "100%", height: "100%", background: "#EBEBEB" }}/>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: steps[i].status === "complete" ? "100%" : "0%" }}
                  transition={{ duration: 0.5 }}
                  style={{ position: "absolute", top: 0, left: 0, height: "100%", background: "#E8680C" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
