import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../utils/api";
import logoImg from "../Images/1.png";

export default function Login() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [shake, setShake]     = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginUser({ email: form.email, password: form.password });
      login(res.token, res.user);
      toast.success(`Welcome back, ${res.user?.username || ""}!`);
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
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>

      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: 28 }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <img src={logoImg.src} alt="StegoChain Logo" style={{ height: 38, width: "auto" }} />
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 22, color: "#111", letterSpacing: "-0.03em" }}>Stego<span style={{ color: "#E8680C" }}>Chain</span></span>
        </Link>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: shake ? [-6, 6, -4, 4, -2, 2, 0] : 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 400, background: "white", borderRadius: 16, border: "1px solid #EBEBEB", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "32px 32px 28px", position: "relative" }}
      >
        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#E8680C", borderRadius: "16px 16px 0 0" }} />

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: "'Outfit', sans-serif" }}>Sign in</h1>
          <p style={{ fontSize: 13, color: "#888" }}>Access your StegoChain account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Email</label>
            <input
              id="email" type="email" className="input-field"
              placeholder="you@example.com"
              autoComplete="email" required
              value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
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
                style={{ paddingRight: 48 }}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", padding: "2px 4px", borderRadius: 4 }}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <motion.button
            id="login-submit" type="submit" className="btn-primary"
            style={{ width: "100%", padding: "12px 18px", fontSize: 14, marginTop: 2, borderRadius: 10 }}
            disabled={loading || !form.email || !form.password}
            whileHover={!loading && form.email && form.password ? { scale: 1.01 } : {}}
            whileTap={!loading ? { scale: 0.99 } : {}}
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <div className="spinner spinner-sm" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: "white", borderColor: "rgba(255,255,255,0.3)" }} />
                  Signing in…
                </motion.span>
              ) : (
                <motion.span key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Sign In →</motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <hr className="divider" style={{ marginBottom: 16 }} />
          <span style={{ fontSize: 13, color: "#888" }}>Don't have an account?{" "}</span>
          <Link href="/register" style={{ color: "#E8680C", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>Create account →</Link>
        </div>
      </motion.div>

      {/* Security hint */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#BBB" }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1L2 3v3c0 2.5 1.7 4.8 4 5.4 2.3-.6 4-2.9 4-5.4V3L6 1z" fill="none" stroke="#BBB" strokeWidth="1.2"/></svg>
        Secured with JWT · bcrypt · ECC P-256
      </motion.div>
    </div>
  );
}
