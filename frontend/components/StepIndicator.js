import { motion } from "framer-motion";

export default function StepIndicator({ steps, currentStep, completedSteps = [] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
      {steps.map((step, i) => {
        const isCompleted = completedSteps.includes(i);
        const isCurrent = currentStep === i;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <motion.div
                animate={isCompleted ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.3 }}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isCompleted ? "#F97316" : isCurrent ? "white" : "#F8F7F5",
                  border: isCompleted ? "2px solid #F97316" : isCurrent ? "2px solid #F97316" : "2px solid #E7E5E4",
                  fontWeight: 600, fontSize: 14,
                  color: isCompleted ? "white" : isCurrent ? "#F97316" : "#A8A29E",
                  transition: "all 0.3s ease"
                }}
              >
                {isCompleted ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  i + 1
                )}
              </motion.div>
              <span style={{
                fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
                color: isCompleted ? "#F97316" : isCurrent ? "#1C1917" : "#A8A29E"
              }}>
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 60, height: 2, margin: "0 6px", marginBottom: 20,
                background: completedSteps.includes(i) ? "#F97316" : "#E7E5E4",
                transition: "background 0.4s ease"
              }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}
