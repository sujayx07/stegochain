import { keccak256 } from "js-sha3";
import { ethers } from "ethers";

// Compute keccak256 of a string, returns 0x hex
export function keccak256Str(str) {
  return "0x" + keccak256(str);
}

// Compute keccak256 of bytes (Uint8Array or Buffer), returns 0x hex
export function keccak256Bytes(bytes) {
  return "0x" + keccak256(bytes);
}

// Build Merkle tree from array of 0x hex leaf hashes
// Returns { root, leaves, tree }
export function buildMerkleTree(leaves) {
  if (leaves.length === 0)
    return { root: "0x" + "0".repeat(64), leaves: [], tree: [] };
  let layer = [...leaves];
  const tree = [layer];
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      // Sorted pair hashing to match Solidity contract
      const pair =
        left <= right
          ? left.slice(2) + right.slice(2)
          : right.slice(2) + left.slice(2);
      next.push("0x" + keccak256(Buffer.from(pair, "hex")));
    }
    layer = next;
    tree.push(layer);
  }
  return { root: tree[tree.length - 1][0], leaves, tree };
}

// Get Merkle proof for leaf at index
export function getMerkleProof(leaves, index) {
  const { tree } = buildMerkleTree(leaves);
  const proof = [];
  let idx = index;
  for (let i = 0; i < tree.length - 1; i++) {
    const layer = tree[i];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < layer.length) proof.push(layer[siblingIdx]);
    else proof.push(layer[idx]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

// Hash fragment bytes to produce Merkle leaf
export function hashFragment(fragmentB64) {
  const bytes = Buffer.from(fragmentB64, "base64");
  return keccak256Bytes(bytes);
}

// Build challenge string for MetaMask signing
export function buildChallengeString(sessionId) {
  return `StegoChain Decrypt Request: ${sessionId}`;
}

// Compute challenge hash for smart contract
export function buildChallengeHash(sessionId) {
  const message = buildChallengeString(sessionId);
  // Raw keccak256 of the challenge string (no prefix).
  // The contract applies the Ethereum signed message prefix to this 32-byte hash.
  return ethers.keccak256(ethers.toUtf8Bytes(message));
}

// Reconstruct AES key from base64 fragments
export function reconstructKeyFromFragments(fragmentsB64) {
  const buffers = fragmentsB64.map((f) => Buffer.from(f, "base64"));
  const combined = Buffer.concat(buffers);
  return combined.slice(0, 32);
}

// Convert hex string to bytes32 format for contract
export function toBytes32(hex) {
  return hex.startsWith("0x") ? hex : "0x" + hex;
}

// Truncate address for display
export function truncateAddress(address, chars = 6) {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Truncate CID for display
export function truncateCID(cid, chars = 8) {
  if (!cid) return "";
  return `${cid.slice(0, chars)}...${cid.slice(-chars)}`;
}

// Format timestamp
export function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  return d.toLocaleString();
}

// Copy to clipboard
export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}
