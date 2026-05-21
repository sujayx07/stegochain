import "../styles/globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../context/AuthContext";
import { WalletProvider } from "../context/WalletContext";

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <WalletProvider>
        <Component {...pageProps} />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "white",
              color: "#1C1917",
              borderRadius: "12px",
              border: "1px solid #E7E5E4",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              fontSize: "14px"
            },
            success: { iconTheme: { primary: "#16A34A", secondary: "white" } },
            error: { iconTheme: { primary: "#DC2626", secondary: "white" } }
          }}
        />
      </WalletProvider>
    </AuthProvider>
  );
}
