import CopyButton from "./CopyButton";
import { truncateAddress, truncateCID } from "../utils/crypto";

const BASESCAN = process.env.NEXT_PUBLIC_BASESCAN_URL || "https://sepolia.etherscan.io";

function truncate(value, type) {
  if (!value) return "—";
  if (type === "address") return truncateAddress(value);
  if (type === "txhash") return `${value.slice(0, 10)}...${value.slice(-8)}`;
  if (type === "cid") return truncateCID(value);
  if (type === "sessionid") return `${value.slice(0, 12)}...${value.slice(-8)}`;
  return value;
}

function getExternalUrl(value, type) {
  if (type === "txhash") return `${BASESCAN}/tx/${value}`;
  if (type === "address") return `${BASESCAN}/address/${value}`;
  return null;
}

export default function HashDisplay({ value, type = "address", truncate: doTruncate = true, showLink = true }) {
  if (!value) return <span style={{ color: "#BBBBBB" }}>—</span>;

  const displayValue = doTruncate ? truncate(value, type) : value;
  const externalUrl = showLink ? getExternalUrl(value, type) : null;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "#FFF4EB", borderRadius: 8,
      padding: "3px 10px", fontSize: 12
    }}>
      <span
        className="mono"
        style={{ color: "#B85A0C" }}
        title={value}
      >
        {displayValue}
      </span>
      <CopyButton text={value} size="sm" />
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", color: "#888888" }}
          title="View on Etherscan"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7 1h4v4M11 1L5 7M2 3h3M2 3v7h7V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </a>
      )}
    </span>
  );
}
