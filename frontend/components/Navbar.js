import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { truncateAddress } from "../utils/crypto";
import { checkHealth } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Send, Receive, Grid, List, Cpu, Wallet, AlertTriangle, MetaMask } from "./Icons";
import logoImg from "../Images/1.png";

const NAV_LINKS = [
  { href: "/",         label: "Home",      icon: Home },
  { href: "/send",     label: "Send",      icon: Send },
  { href: "/receive",  label: "Receive",   icon: Receive },
  { href: "/dashboard",label: "Dashboard", icon: Grid },
  { href: "/ledger",   label: "Ledger",    icon: List },
  { href: "/anomaly",  label: "Anomaly",   icon: Cpu },
];

function Logo() {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
      <img src={logoImg.src} alt="StegoChain Logo" style={{ height: 38, width: "auto" }} />
      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 21, color: "#111", letterSpacing: "-0.03em" }}>
        Stego<span style={{ color: "#E8680C" }}>Chain</span>
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
    const handleScroll = () => setScrolled(window.scrollY > 8);
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
          background: scrolled ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${scrolled ? "#E8680C22" : "rgba(235,235,235,0.6)"}`,
          position: "sticky", top: 0, zIndex: 200,
          boxShadow: scrolled ? "0 4px 20px rgba(232,104,12,0.04)" : "none",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 72, gap: 8 }}>
          <Logo />

          {/* Desktop Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 3, flex: 1, marginLeft: 32 }} className="hidden-mobile">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "8px 16px", borderRadius: 10, fontSize: 15,
                  fontWeight: isActive(link.href) ? 600 : 500,
                  color: isActive(link.href) ? "#E8680C" : "#555",
                  background: isActive(link.href) ? "#FFF4EB" : "transparent",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                  onMouseEnter={e => { if (!isActive(link.href)) { e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.color = "#111"; }}}
                  onMouseLeave={e => { if (!isActive(link.href)) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#555"; }}}
                >
                  {link.label}
                </div>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            {/* API status */}
            <div title={backendOnline ? "Backend online" : backendOnline === false ? "Backend offline" : "Checking..."} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: "#FAFAFA", border: "1px solid #EBEBEB", cursor: "default" }} className="hidden-mobile">
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: backendOnline === null ? "#DDD" : backendOnline ? "#1A9F4A" : "#E03131",
                animation: backendOnline ? "pulse-ring 2s infinite" : "none",
              }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.04em" }}>API</span>
            </div>

            {/* Wallet */}
            {!isConnected ? (
              <button onClick={connect} disabled={connecting} className="btn-primary" style={{ padding: "8px 18px", fontSize: 14, borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 8 }}>
                {connecting ? (
                  <><div className="spinner spinner-sm" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: "white" }}/> Connecting…</>
                ) : (
                  <>
                    <MetaMask size={18} />
                    <span>Connect</span>
                  </>
                )}
              </button>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#EDFCF2", border: "1px solid #B4EDCC",
                borderRadius: 10, padding: "7px 12px",
              }}>
                <MetaMask size={16} />
                <span className="mono" style={{ fontSize: 12, color: "#111", fontWeight: 600 }}>{truncateAddress(address)}</span>
                {user && <span style={{ fontSize: 11, color: "#888", borderLeft: "1px solid #B4EDCC", paddingLeft: 8 }}>{user.username}</span>}
              </div>
            )}


            {isAuthenticated ? (
              <button onClick={logout} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 13 }}>Logout</button>
            ) : (
              <Link href="/login" style={{ textDecoration: "none" }}>
                <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 13 }}>Login</button>
              </Link>
            )}

            {/* Hamburger */}
            <button onClick={() => setMobileOpen(o => !o)} className="btn-icon show-mobile" style={{ padding: 6 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 18 18">
                {mobileOpen ? (
                  <path d="M4 4L14 14M14 4L4 14" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/>
                ) : (
                  <><path d="M3 5h12" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/><path d="M3 9h12" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/><path d="M3 13h12" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/></>
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
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ borderTop: "1px solid #EBEBEB", background: "white", overflow: "hidden" }}
            >
              <div style={{ padding: "10px 14px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
                {NAV_LINKS.map(link => (
                  <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, fontSize: 14,
                      fontWeight: isActive(link.href) ? 600 : 500,
                      color: isActive(link.href) ? "#E8680C" : "#111",
                      background: isActive(link.href) ? "#FFF4EB" : "transparent",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      {React.createElement(link.icon, { size: 16, style: { color: isActive(link.href) ? "#E8680C" : "#888" } })}
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
            style={{ background: "#FFFAF0", borderBottom: "1px solid #FFE29E", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <AlertTriangle size={14} style={{ color: "#CF8100" }} />
            <span style={{ fontSize: 12, color: "#7A3C0E", fontWeight: 500 }}>Wrong network — switch to <strong>Ethereum Sepolia</strong></span>
            <button onClick={switchToSepolia} style={{ background: "#CF8100", color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Switch
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
