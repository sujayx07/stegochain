// frontend/components/Navbar.js
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { checkHealth } from "../utils/api";

const NAV_LINKS = [
  { label: "Home",    href: "/" },
  { label: "Send",    href: "/send" },
  { label: "Receive", href: "/receive" },
  { label: "Ledger",  href: "/ledger" },
  { label: "Anomaly", href: "/anomaly" },
];

export default function Navbar() {
  const router = useRouter();
  const [online, setOnline] = useState(null); // null=checking, true=online, false=offline

  useEffect(() => {
    checkHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  return (
    <nav
      data-testid="navbar"
      style={{ backgroundColor: "#13131a", borderBottom: "1px solid #1e1e2e" }}
      className="w-full px-6 py-3 flex items-center justify-between sticky top-0 z-50"
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 no-underline">
        <span className="text-xl font-bold" style={{ color: "#6366f1" }}>
          🔐 StegoChain
        </span>
      </Link>

      {/* Nav links */}
      <ul className="flex items-center gap-1 list-none m-0 p-0">
        {NAV_LINKS.map(({ label, href }) => {
          const active = router.pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                data-testid={`nav-link-${label.toLowerCase()}`}
                className="px-4 py-2 rounded text-sm font-medium transition-colors no-underline"
                style={{
                  color:           active ? "#6366f1" : "#94a3b8",
                  borderBottom:    active ? "2px solid #6366f1" : "2px solid transparent",
                  backgroundColor: active ? "rgba(99,102,241,0.08)" : "transparent",
                }}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{
            backgroundColor:
              online === null ? "#f59e0b" : online ? "#22c55e" : "#ef4444",
          }}
        />
        <span style={{ color: "#94a3b8" }}>
          {online === null ? "Checking..." : online ? "Online" : "Offline"}
        </span>
      </div>
    </nav>
  );
}
