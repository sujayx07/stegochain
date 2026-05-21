import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../utils/api";

export default function Login() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [shake, setShake]     = useState(false);

  useEffect(() => { if (isAuthenticated) router.push("/dashboard"); }, [isAuthenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginUser({ email: form.email, password: form.password });
      login(res.token, res.user);
      toast.success(`Welcome back, ${res.user?.username || ""}! 🔐`);
      router.push("/dashboard");
    } catch (err) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#F8F7F5 0%,#FFF0E6 50%,#F8F7F5 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", position: "relative", overflow: "hidden" }}>

      {/* Background decoration */}
      <div style={{ position: "absolute", top: "-100px", right: "-100px", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.08),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-80px", left: "-80px", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,158,11,0.06),transparent 70%)", pointerEvents: "none" }} />

      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginBottom: 32 }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" fill="#F97316" opacity="0.15"/>
            <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" stroke="#F97316" strokeWidth="1.8"/>
            <path d="M9 14l3.5 3.5L19 11" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: 22, color: "#1C1917", letterSpacing: "-0.02em" }}>Stego<span style={{ color: "#F97316" }}>Chain</span></span>
        </Link>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: shake ? [-8, 8, -6, 6, -3, 3, 0] : 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 24, border: "1.5px solid #E7E5E4", boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", padding: "36px 36px 32px", position: "relative" }}
      >
        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#F97316,#F59E0B)", borderRadius: "24px 24px 0 0" }} />

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.02em", marginBottom: 4 }}>Sign in</h1>
          <p style={{ fontSize: 14, color: "#78716C" }}>Access your StegoChain account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label className="label">Email</label>
            <input
              id="email" type="email" className="input-field"
              placeholder="you@example.com"
              autoComplete="email" required
              value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
              style={{ fontSize: 15 }}
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="password" className="input-field"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password" required
                value={form.password}
                onChange={e => setForm(f => ({...f, password: e.target.value}))}
                style={{ paddingRight: 52, fontSize: 15 }}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#78716C", fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", padding: "2px 4px", borderRadius: 4 }}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <motion.button
            id="login-submit" type="submit" className="btn-primary"
            style={{ width: "100%", padding: "13px 20px", fontSize: 15, marginTop: 4, borderRadius: 12 }}
            disabled={loading || !form.email || !form.password}
            whileHover={!loading && form.email && form.password ? { scale: 1.02, boxShadow: "0 8px 24px rgba(249,115,22,0.3)" } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <div className="spinner spinner-sm" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: "white", borderColor: "rgba(255,255,255,0.3)" }} />
                  Signing in…
                </motion.span>
              ) : (
                <motion.span key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Sign In →</motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <hr className="divider" style={{ marginBottom: 20 }} />
          <span style={{ fontSize: 14, color: "#78716C" }}>Don't have an account?{" "}</span>
          <Link href="/register" style={{ color: "#F97316", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Create account →</Link>
        </div>
      </motion.div>

      {/* Security hint */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#A8A29E" }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L2 3v3c0 2.5 1.7 4.8 4 5.4 2.3-.6 4-2.9 4-5.4V3L6 1z" fill="none" stroke="#A8A29E" strokeWidth="1.2"/></svg>
        Secured with JWT · bcrypt · ECC P-256
      </motion.div>
    </div>
  );
}
