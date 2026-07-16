import "../styles/globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../context/AuthContext";
import { WalletProvider } from "../context/WalletContext";
import TechBackground from "../components/TechBackground";

// NOTE: Removed AnimatePresence page wrapper — it caused hydration lag
// Individual page components handle their own entrance animations

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <WalletProvider>
        <TechBackground />
        <Component {...pageProps} />
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              background: "white",
              color: "#111",
              borderRadius: "10px",
              border: "1px solid #EBEBEB",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              fontSize: "13px",
              fontFamily: "'Inter', sans-serif",
              fontWeight: "500",
              padding: "10px 14px",
              maxWidth: "360px",
            },
            success: {
              iconTheme: { primary: "#1A9F4A", secondary: "white" },
              style: { borderColor: "#B4EDCC", background: "#EDFCF2" },
            },
            error: {
              iconTheme: { primary: "#E03131", secondary: "white" },
              style: { borderColor: "#FFC4C4", background: "#FFF0F0" },
            },
          }}
        />
      </WalletProvider>
    </AuthProvider>
  );
}
