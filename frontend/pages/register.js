import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import WalletButton from "../components/WalletButton";
import { api } from "../utils/api";
import StepIndicator from "../components/StepIndicator";
import { registerUser } from "../utils/api";
import { AlertTriangle, Wallet, Key, List, Refresh } from "../components/Icons";

const STEPS = ["Connect Wallet", "Account Details", "ECC Key Pair"];

export default function Register() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const {
    address,
    isConnected,
    isCorrectChain,
    switchToSepolia,
    registerOnChain,
  } = useWallet();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [keypair, setKeypair] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState([]);

  useEffect(() => {
    if (isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated]);

  async function generateKeypair() {
    setGenerating(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000"}/api/crypto/generate-keypair`,
        { method: "POST" },
      );
      const data = await res.json();
      const privateKeyPem = (
        data.private_key_pem ||
        data.private_key ||
        ""
      ).trim();
      setKeypair({
        ...data,
        private_key_pem: privateKeyPem,
        private_key: privateKeyPem,
      });
      setShowPrivate(true); // Auto-show key so user sees it immediately
    } catch {
      toast.error("Failed to generate key pair. Is the backend running?");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegister() {
    if (!keypair) return;
    setSubmitting(true);
    try {
      // Step 1 — Save account to backend (MongoDB)
      setSubmitStatus(["Saving account to database…", ""]);
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        eth_address: address,
        public_key_x: keypair.public_key_x,
        public_key_y: keypair.public_key_y,
      };
      const res = await registerUser(payload);

      // Log in immediately so the JWT token is available for the
      // /register-chain-manual call that follows
      login(res.token, res.user);

      // Step 2 — Register ON-CHAIN from MetaMask (msg.sender = user's address)
      setSubmitStatus([
        "Account saved ✓",
        "Registering on blockchain via MetaMask…",
      ]);
      toast(
        "MetaMask will ask you to confirm the on-chain registration transaction."
      );
      try {
        const chainRes = await registerOnChain(
          keypair.public_key_x,
          keypair.public_key_y,
        );
        // Notify backend now that we have a valid JWT token
        await api
          .post("/api/auth/register-chain-manual", { tx_hash: chainRes.txHash })
          .catch((e) => console.warn("register-chain-manual failed:", e.message));
        const txLabel = chainRes.alreadyRegistered
          ? "already on-chain"
          : (chainRes.txHash || "").slice(0, 10) + "…";
        setSubmitStatus([
          "Account saved ✓",
          `Chain registered ✓  (${txLabel})`,
        ]);
        toast.success("Account created! Welcome to StegoChain.");
        setTimeout(() => router.push("/dashboard"), 1500);
      } catch (chainErr) {
        // Non-fatal: user can retry chain registration from dashboard
        console.warn("Chain registration error:", chainErr.message);
        setSubmitStatus([
          "Account saved ✓",
          `⚠ Chain reg skipped: ${chainErr.message.slice(0, 80)}`,
        ]);
        toast(
          "On-chain registration skipped. You can retry from your dashboard."
        );
        setTimeout(() => router.push("/dashboard"), 2500);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function nextStep() {
    setCompleted((c) => [...c, step]);
    setStep((s) => s + 1);
  }

  const cardStyle = {
    maxWidth: 520,
    margin: "60px auto",
    padding: 36,
    background: "white",
    borderRadius: 20,
    border: "1px solid #EBEBEB",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  };

  return (
    <div
      style={{ minHeight: "100vh", background: "transparent", padding: "0 16px" }}
    >
      <div style={{ paddingTop: 40, textAlign: "center" }}>
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path
              d="M14 2L4 7v7c0 6.2 4.3 12 10 13.4C20 26 24.4 20.2 24.4 14V7L14 2z"
              stroke="#E8680C"
              strokeWidth="1.5"
              fill="#FFF4EB"
            />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#111111" }}>
            Stego<span style={{ color: "#E8680C" }}>Chain</span>
          </span>
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={cardStyle}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#111111",
            marginBottom: 4,
          }}
        >
          Create Account
        </h1>
        <p style={{ fontSize: 14, color: "#888888", marginBottom: 24 }}>
          Register to start sending secure steganographic messages
        </p>

        <StepIndicator
          steps={STEPS}
          currentStep={step}
          completedSteps={completed}
        />

        {/* Step 0 — Connect Wallet */}
        {step === 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 14, color: "#888888", marginBottom: 20 }}>
              MetaMask is required to sign your identity on the blockchain. No
              gas fees needed to register.
            </p>

            {/* State 1: Not connected */}
            {!isConnected && <WalletButton size="lg" />}

            {/* State 2: Connected but wrong network */}
            {isConnected && !isCorrectChain && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#FFF8F3",
                    border: "1px solid #F9DCC4",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#B85A0C",
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <AlertTriangle size={14} style={{ color: "#B85A0C" }} /> Wrong Network
                  </div>
                  <div style={{ fontSize: 12, color: "#888888" }}>
                    MetaMask is connected but on a different network.
                    <br />
                    Switch to <strong>Ethereum Sepolia</strong> (chain ID:
                    11155111) to continue.
                  </div>
                </div>
                <button
                  onClick={switchToSepolia}
                  className="btn-primary"
                  style={{ width: "100%", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}
                >
                  <Refresh size={14} /> Switch Network
                </button>
                <div
                  style={{
                    fontSize: 11,
                    color: "#BBBBBB",
                    textAlign: "center",
                  }}
                >
                  Ethereum Sepolia is a built-in network in MetaMask — just
                  click and approve
                </div>
              </div>
            )}

            {/* State 3: Connected and correct network */}
            {isConnected && isCorrectChain && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div
                  style={{
                    padding: 14,
                    background: "#EDFCF2",
                    border: "1px solid #B4EDCC",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1A9F4A",
                      marginBottom: 4,
                    }}
                  >
                    ✓ Wallet Connected — Ethereum Sepolia
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 12, color: "#111111" }}
                  >
                    {address}
                  </div>
                </div>
                <button
                  className="btn-primary"
                  style={{ width: "100%" }}
                  onClick={nextStep}
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Account Details */}
        {step === 1 && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111111",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Username
              </label>
              <input
                className="input-field"
                placeholder="yourname"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111111",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111111",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111111",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Confirm Password
              </label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={form.confirm}
                onChange={(e) =>
                  setForm((f) => ({ ...f, confirm: e.target.value }))
                }
              />
            </div>
            <button
              className="btn-primary"
              style={{ width: "100%", marginTop: 4 }}
              disabled={
                !form.username ||
                !form.email ||
                !form.password ||
                form.password !== form.confirm
              }
              onClick={nextStep}
            >
              Continue →
            </button>
            {form.password &&
              form.confirm &&
              form.password !== form.confirm && (
                <div style={{ fontSize: 12, color: "#E03131" }}>
                  Passwords do not match
                </div>
              )}
          </div>
        )}

        {/* Step 2 — ECC Key Pair */}
        {step === 2 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 14, color: "#888888", marginBottom: 16 }}>
              Generate your ECC key pair. The public key is stored on the
              blockchain. Keep your private key safe — it is only shown once.
            </p>

            {!keypair ? (
              <button
                className="btn-primary"
                style={{ width: "100%", display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}
                onClick={generateKeypair}
                disabled={generating}
              >
                {generating ? "Generating…" : <><Key size={14} /> Generate Key Pair</>}
              </button>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div
                  style={{
                    padding: 14,
                    background: "#EDFCF2",
                    border: "1px solid #B4EDCC",
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      color: "#1A9F4A",
                      marginBottom: 6,
                    }}
                  >
                    ✓ Key pair generated
                  </div>
                  <div style={{ color: "#888888" }}>
                    Public Key X:{" "}
                    <span className="mono" style={{ fontSize: 11 }}>
                      {keypair.public_key_x?.slice(0, 20)}…
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    padding: 14,
                    background: "#FFF4EB",
                    border: "2px solid #E8680C",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#B85A0C",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <AlertTriangle size={14} style={{ color: "#B85A0C" }} /> Your private key is only shown once. Save it securely.
                    Never share it.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#888888" }}>
                      Private Key (PEM)
                    </span>
                    <button
                      onClick={() => setShowPrivate((s) => !s)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 12,
                        color: "#E8680C",
                        cursor: "pointer",
                      }}
                    >
                      {showPrivate ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showPrivate && keypair && (
                    <pre
                      className="mono"
                      style={{
                        fontSize: 10,
                        background: "#FFF9F5",
                        borderRadius: 6,
                        padding: 8,
                        overflow: "auto",
                        color: "#111111",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        maxHeight: 140,
                      }}
                    >
                      {keypair.private_key_pem}
                    </pre>
                  )}
                  <button
                    onClick={async () => {
                      const key = keypair?.private_key_pem || "";
                      if (!key) {
                        toast.error("No private key to copy.");
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(key);
                        toast.success("Private key copied!");
                      } catch {
                        toast.error("Failed to copy private key.");
                      }
                    }}
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#E8680C",
                      background: "none",
                      border: "1px solid #E8680C",
                      borderRadius: 6,
                      padding: "4px 12px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <List size={12} /> Copy Private Key
                  </button>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ fontSize: 13, color: "#111111" }}>
                    I have saved my private key securely and understand I cannot
                    recover it
                  </span>
                </label>

                {submitting && (
                  <div style={{ fontSize: 13, color: "#888888", display: "flex", flexDirection: "column", gap: 6 }}>
                    {submitStatus.filter(Boolean).map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Refresh size={12} className="animate-spin" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="btn-primary"
                  style={{ width: "100%" }}
                  disabled={!confirmed || submitting}
                  onClick={handleRegister}
                >
                  {submitting ? "Creating account…" : "Create Account →"}
                </button>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 13,
            color: "#888888",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: "#E8680C",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
