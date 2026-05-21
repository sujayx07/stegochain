import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../utils/api";

export default function Login() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => { if (isAuthenticated) router.push("/dashboard"); }, [isAuthenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginUser({ email: form.email, password: form.password });
      login(res.token, res.user);
      toast.success(`Welcome back, ${res.user?.username || ""}!`);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = { maxWidth: 440, margin: "60px auto", padding: 36, background: "white", borderRadius: 20, border: "1px solid #E7E5E4", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" };

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F5", padding: "0 16px" }}>
      <div style={{ paddingTop: 40, textAlign: "center" }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z" stroke="#F97316" strokeWidth="1.5" fill="#FFF0E6"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#1C1917" }}>Stego<span style={{ color: "#F97316" }}>Chain</span></span>
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1917", marginBottom: 4 }}>Sign in</h1>
        <p style={{ fontSize: 14, color: "#78716C", marginBottom: 28 }}>Access your StegoChain account</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#1C1917", display: "block", marginBottom: 6 }}>Email</label>
            <input
              id="email"
              className="input-field"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#1C1917", display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                className="input-field"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={e => setForm(f => ({...f, password: e.target.value}))}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#78716C", fontSize: 13 }}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            style={{ width: "100%", marginTop: 4, padding: "12px 20px" }}
            disabled={loading || !form.email || !form.password}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#78716C" }}>
          Don't have an account?{" "}
          <Link href="/register" style={{ color: "#F97316", textDecoration: "none", fontWeight: 500 }}>Register</Link>
        </div>
      </motion.div>
    </div>
  );
}
