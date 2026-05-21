import "../styles/globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../context/AuthContext";
import { WalletProvider } from "../context/WalletContext";

// NOTE: Removed AnimatePresence page wrapper — it caused hydration lag
// Individual page components handle their own entrance animations

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <WalletProvider>
        <Component {...pageProps} />
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 4500,
            style: {
              background: "white",
              color: "#1C1917",
              borderRadius: "14px",
              border: "1.5px solid #E7E5E4",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
              fontSize: "14px",
              fontFamily: "'Inter', sans-serif",
              fontWeight: "500",
              padding: "12px 16px",
              maxWidth: "380px",
            },
            success: {
              iconTheme: { primary: "#16A34A", secondary: "white" },
              style: { borderColor: "#BBF7D0", background: "#F0FDF4" },
            },
            error: {
              iconTheme: { primary: "#DC2626", secondary: "white" },
              style: { borderColor: "#FCA5A5", background: "#FEF2F2" },
            },
          }}
        />
      </WalletProvider>
    </AuthProvider>
  );
}
