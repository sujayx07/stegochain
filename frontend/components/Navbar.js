import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { truncateAddress } from "../utils/crypto";
import { checkHealth } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "/",         label: "Home",      icon: "⬡" },
  { href: "/send",     label: "Send",      icon: "↑" },
  { href: "/receive",  label: "Receive",   icon: "↓" },
  { href: "/dashboard",label: "Dashboard", icon: "⊞" },
  { href: "/ledger",   label: "Ledger",    icon: "≡" },
  { href: "/anomaly",  label: "Anomaly",   icon: "◈" },
];

function Logo() {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
      <div style={{ position: "relative", width: 32, height: 32 }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 2L5 8v8c0 7.1 4.9 13.7 11 15.4 6.1-1.7 11-8.3 11-15.4V8L16 2z"
            fill="url(#navGrad)" opacity="0.15"/>
          <path d="M16 2L5 8v8c0 7.1 4.9 13.7 11 15.4 6.1-1.7 11-8.3 11-15.4V8L16 2z"
            stroke="#F97316" strokeWidth="1.8" fill="none"/>
          <path d="M11 16l3.5 3.5L21 12" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="navGrad" x1="5" y1="2" x2="27" y2="32">
              <stop stopColor="#F97316"/>
              <stop offset="1" stopColor="#F59E0B"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span style={{ fontWeight: 800, fontSize: 19, color: "#1C1917", letterSpacing: "-0.02em" }}>
        Stego<span style={{ color: "#F97316" }}>Chain</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { address, connect, connecting, isConnected, isCorrectChain, switchToSepolia } = useWallet();
  const [backendOnline, setBackendOnline] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function ping() {
      try { await checkHealth(); if (mounted) setBackendOnline(true); }
      catch { if (mounted) setBackendOnline(false); }
    }
    ping();
    const iv = setInterval(ping, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [router.pathname]);

  const isActive = (href) => router.pathname === href;

  return (
    <>
      <nav
        style={{
          background: scrolled ? "rgba(255,255,255,0.98)" : "white",
          borderBottom: `1px solid ${scrolled ? "#E7E5E4" : "#F0EDE9"}`,
          position: "sticky", top: 0, zIndex: 200,
          boxShadow: scrolled ? "0 4px 20px rgba(0,0,0,0.06)" : "none",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 64, gap: 8 }}>
          <Logo />

          {/* Desktop Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, marginLeft: 32 }} className="hidden-mobile">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 14,
                  fontWeight: isActive(link.href) ? 700 : 500,
                  color: isActive(link.href) ? "#F97316" : "#78716C",
                  background: isActive(link.href) ? "#FFF0E6" : "transparent",
                  transition: "all 0.18s ease",
                  position: "relative",
                  cursor: "pointer",
                }}
                  onMouseEnter={e => { if (!isActive(link.href)) { e.currentTarget.style.background = "#F8F7F5"; e.currentTarget.style.color = "#1C1917"; }}}
                  onMouseLeave={e => { if (!isActive(link.href)) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#78716C"; }}}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <motion.div
                      layoutId="navUnderline"
                      style={{ position: "absolute", bottom: -2, left: 14, right: 14, height: 2, background: "#F97316", borderRadius: 2 }}
                    />
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            {/* API status */}
            <div title={backendOnline ? "Backend online" : backendOnline === false ? "Backend offline" : "Checking..."} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: "#F8F7F5", border: "1px solid #E7E5E4", cursor: "default" }} className="hidden-mobile">
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: backendOnline === null ? "#D1D5DB" : backendOnline ? "#16A34A" : "#DC2626",
                animation: backendOnline ? "pulse-ring 2s infinite" : "none",
              }}/>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#78716C", letterSpacing: "0.04em" }}>API</span>
            </div>

            {/* Wallet */}
            {!isConnected ? (
              <button onClick={connect} disabled={connecting} className="btn-primary" style={{ padding: "7px 16px", fontSize: 13 }}>
                {connecting ? (
                  <><div className="spinner spinner-sm" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: "white" }}/> Connecting…</>
                ) : "🦊 Connect"}
              </button>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                borderRadius: 10, padding: "6px 12px",
                transition: "all 0.2s",
              }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A", animation: "pulse-ring 2s infinite" }}/>
                <span className="mono" style={{ fontSize: 12, color: "#1C1917", fontWeight: 600 }}>{truncateAddress(address)}</span>
                {user && <span style={{ fontSize: 11, color: "#78716C", borderLeft: "1px solid #BBF7D0", paddingLeft: 8 }}>{user.username}</span>}
              </div>
            )}

            {isAuthenticated ? (
              <button onClick={logout} className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}>Logout</button>
            ) : (
              <Link href="/login" style={{ textDecoration: "none" }}>
                <button className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}>Login</button>
              </Link>
            )}

            {/* Hamburger */}
            <button onClick={() => setMobileOpen(o => !o)} className="btn-icon show-mobile" style={{ padding: 8 }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                {mobileOpen ? (
                  <path d="M4 4L16 16M16 4L4 16" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round"/>
                ) : (
                  <><path d="M3 5h14" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round"/><path d="M3 10h14" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round"/><path d="M3 15h14" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round"/></>
                )}
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
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ borderTop: "1px solid #E7E5E4", background: "white", overflow: "hidden" }}
            >
              <div style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
                {NAV_LINKS.map(link => (
                  <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "12px 16px", borderRadius: 10, fontSize: 15,
                      fontWeight: isActive(link.href) ? 700 : 500,
                      color: isActive(link.href) ? "#F97316" : "#1C1917",
                      background: isActive(link.href) ? "#FFF0E6" : "transparent",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <span style={{ fontSize: 16 }}>{link.icon}</span>
                      {link.label}
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Wrong chain banner */}
      <AnimatePresence>
        {isConnected && !isCorrectChain && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", borderBottom: "1px solid #FCD34D", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}
          >
            <span style={{ fontSize: 13, color: "#92400E", fontWeight: 500 }}>⚠️ Wrong network — switch to <strong>Ethereum Sepolia</strong> to use StegoChain</span>
            <button onClick={switchToSepolia} style={{ background: "#D97706", color: "white", border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#B45309"}
              onMouseLeave={e => e.currentTarget.style.background = "#D97706"}
            >
              Switch Network
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
