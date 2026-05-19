// frontend/pages/index.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { getBlockchainStats, getGraphSummary } from "../utils/api";

const CARD_STYLE = {
  backgroundColor: "#13131a",
  border:          "1px solid #1e1e2e",
  borderRadius:    "12px",
  padding:         "28px 24px",
};

function StatPill({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl font-bold mono" style={{ color: "#6366f1" }}>
        {value ?? "—"}
      </span>
      <span className="text-xs uppercase tracking-widest" style={{ color: "#94a3b8" }}>
        {label}
      </span>
    </div>
  );
}

export default function HomePage() {
  const [stats,   setStats]   = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getBlockchainStats().then(setStats).catch(() => {});
    getGraphSummary().then(setSummary).catch(() => {});
  }, []);

  return (
    <>
      <Head>
        <title>StegoChain — Secure Hidden Communication</title>
        <meta name="description" content="Blockchain-anchored steganography with threshold cryptography and AI anomaly detection." />
      </Head>

      <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0f" }}>
        <Navbar />

        <main className="max-w-5xl mx-auto px-6 py-20">
          {/* Hero */}
          <div className="text-center mb-16">
            <div
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              🔬 Final Year Project — Blockchain + Steganography + AI
            </div>
            <h1
              className="text-5xl font-bold mb-6 leading-tight"
              style={{ color: "#e2e8f0" }}
            >
              Secure Hidden{" "}
              <span style={{ color: "#6366f1" }}>Communication</span>
            </h1>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "#94a3b8" }}>
              Embed secret messages inside media files, encrypt them with AES-256-GCM, anchor every
              transfer on the Ethereum blockchain, and protect decryption keys with threshold
              cryptography — all in one pipeline.
            </p>

            {/* CTA buttons */}
            <div className="flex items-center justify-center gap-4 mt-10">
              <Link
                href="/send"
                className="px-8 py-3 rounded-lg font-semibold text-white no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#6366f1" }}
                data-testid="cta-send"
              >
                Send a Message
              </Link>
              <Link
                href="/receive"
                className="px-8 py-3 rounded-lg font-semibold no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#13131a", color: "#e2e8f0", border: "1px solid #1e1e2e" }}
                data-testid="cta-receive"
              >
                Retrieve a Message
              </Link>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: "🔐",
                title: "Steganography",
                desc: "Hide messages in images and audio files using LSB embedding and echo hiding — invisible to the naked eye.",
              },
              {
                icon: "⛓️",
                title: "Blockchain Verified",
                desc: "Every message transfer is anchored on-chain with a Merkle proof, creating an immutable audit trail.",
              },
              {
                icon: "🔑",
                title: "Threshold Access",
                desc: "k-of-n Shamir secret sharing means no single party holds the decryption key — distributed trust by design.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={CARD_STYLE} className="hover:border-indigo-500 transition-colors">
                <div className="text-3xl mb-4">{icon}</div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: "#e2e8f0" }}>{title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Live stats bar */}
          <div
            className="rounded-xl px-8 py-6 flex flex-wrap items-center justify-around gap-6"
            style={{ backgroundColor: "#13131a", border: "1px solid #1e1e2e" }}
          >
            <StatPill
              label="Records on Chain"
              value={stats?.total_records ?? "—"}
            />
            <div style={{ width: "1px", height: "40px", backgroundColor: "#1e1e2e" }} />
            <StatPill
              label="Network Nodes"
              value={summary?.total_nodes ?? "—"}
            />
            <div style={{ width: "1px", height: "40px", backgroundColor: "#1e1e2e" }} />
            <StatPill
              label="Network Edges"
              value={summary?.total_edges ?? "—"}
            />
            <div style={{ width: "1px", height: "40px", backgroundColor: "#1e1e2e" }} />
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-sm font-bold mono truncate max-w-xs"
                style={{ color: "#6366f1" }}
              >
                {stats?.contract_owner
                  ? stats.contract_owner.slice(0, 14) + "..."
                  : "—"}
              </span>
              <span className="text-xs uppercase tracking-widest" style={{ color: "#94a3b8" }}>
                Contract Owner
              </span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-8" style={{ color: "#94a3b8", fontSize: "13px" }}>
          StegoChain — Final Year Project | Blockchain + Steganography + AI
        </footer>
      </div>
    </>
  );
}
