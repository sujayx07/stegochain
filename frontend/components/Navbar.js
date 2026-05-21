import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { truncateAddress } from "../utils/crypto";
import { checkHealth } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/send", label: "Send" },
  { href: "/receive", label: "Receive" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ledger", label: "Ledger" },
  { href: "/anomaly", label: "Anomaly" },
];

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { address, connect, connecting, isConnected, isCorrectChain, switchToSepolia } = useWallet();
  const [backendOnline, setBackendOnline] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function ping() {
      try {
        await checkHealth();
        if (mounted) setBackendOnline(true);
      } catch {
        if (mounted) setBackendOnline(false);
      }
    }
    ping();
    const interval = setInterval(ping, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  function isActive(href) {
    return router.pathname === href;
  }

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: "white",
          borderBottom: "1px solid #E7E5E4",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 64 }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginRight: 40 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" fill="#F97316" opacity="0.15"/>
              <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" stroke="#F97316" strokeWidth="1.5" fill="none"/>
              <path d="M9 14l3.5 3.5L19 11" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#1C1917" }}>Stego<span style={{ color: "#F97316" }}>Chain</span></span>
          </Link>

          {/* Desktop Nav Links */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }} className="hidden-mobile">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: isActive(link.href) ? 600 : 500,
                color: isActive(link.href) ? "#F97316" : "#78716C",
                textDecoration: "none",
                borderBottom: isActive(link.href) ? "2px solid #F97316" : "2px solid transparent",
                transition: "all 0.15s ease"
              }}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Backend status */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }} title={backendOnline ? "Backend online" : "Backend offline"}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: backendOnline === null ? "#D1D5DB" : backendOnline ? "#16A34A" : "#DC2626",
                boxShadow: backendOnline ? "0 0 0 2px rgba(22,163,74,0.2)" : "none"
              }}/>
              <span style={{ fontSize: 12, color: "#78716C" }}>API</span>
            </div>

            {/* Wallet */}
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={connecting}
                className="btn-primary"
                style={{ padding: "7px 14px", fontSize: 13 }}
              >
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#F8F7F5", border: "1px solid #E7E5E4",
                borderRadius: 10, padding: "5px 12px"
              }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A" }}/>
                <span className="mono" style={{ fontSize: 12, color: "#1C1917" }}>{truncateAddress(address)}</span>
                {user && <span style={{ fontSize: 12, color: "#78716C", marginLeft: 4 }}>· {user.username}</span>}
              </div>
            )}

            {/* Auth buttons */}
            {isAuthenticated ? (
              <button onClick={logout} className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}>Logout</button>
            ) : (
              <Link href="/login">
                <button className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}>Login</button>
              </Link>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              className="show-mobile"
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 22 22">
                <path d="M3 6h16M3 11h16M3 16h16" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ borderTop: "1px solid #E7E5E4", background: "white", overflow: "hidden" }}
            >
              <div style={{ padding: "12px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
                {NAV_LINKS.map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} style={{
                    padding: "10px 12px", borderRadius: 8, fontSize: 14,
                    fontWeight: isActive(link.href) ? 600 : 500,
                    color: isActive(link.href) ? "#F97316" : "#1C1917",
                    textDecoration: "none"
                  }}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Wrong chain warning */}
      {isConnected && !isCorrectChain && (
        <div style={{
          background: "#FEF3C7", borderBottom: "1px solid #FDE68A",
          padding: "10px 24px", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 12
        }}>
          <span style={{ fontSize: 13, color: "#92400E" }}>⚠️ You are on the wrong network. Switch to Ethereum Sepolia to use StegoChain.</span>
          <button onClick={switchToSepolia} style={{
            background: "#D97706", color: "white", border: "none",
            borderRadius: 8, padding: "5px 14px", fontSize: 13,
            fontWeight: 500, cursor: "pointer"
          }}>
            Switch Network
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: block !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}
