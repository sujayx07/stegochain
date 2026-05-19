// frontend/utils/api.js
// Centralised API utility — all components import from here.

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:5000";

async function request(method, path, body = null, isFormData = false) {
  const options = {
    method,
    headers: isFormData ? {} : { "Content-Type": "application/json" },
    body: body ? (isFormData ? body : JSON.stringify(body)) : null,
  };
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok || data.status >= 400) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

// ── Stego ─────────────────────────────────────────────────────────────────────
export async function sendMessage(formData) {
  return request("POST", "/api/stego/send", formData, true);
}

export async function receiveMessage({ session_id, owner_ids, file_type }) {
  return request("POST", "/api/stego/receive", { session_id, owner_ids, file_type });
}

// ── Crypto ────────────────────────────────────────────────────────────────────
export async function generateKeypair() {
  return request("POST", "/api/crypto/generate-keypair");
}

export async function deriveSharedKey({ private_key_pem, peer_public_key_pem }) {
  return request("POST", "/api/crypto/derive-shared-key", {
    private_key_pem,
    peer_public_key_pem,
  });
}

// ── Blockchain ────────────────────────────────────────────────────────────────
export async function getBlockchainRecord(recordId) {
  return request("GET", `/api/blockchain/record/${recordId}`);
}

export async function getBlockchainStats() {
  return request("GET", "/api/blockchain/stats");
}

export async function getBlockchainSenderRecords(address) {
  return request("GET", `/api/blockchain/sender/${address}`);
}

export async function verifyRecord({ record_id, cid, merkle_root }) {
  return request("POST", "/api/blockchain/verify", { record_id, cid, merkle_root });
}

export async function revokeRecord(recordId) {
  return request("POST", `/api/blockchain/revoke/${recordId}`);
}

// ── Graph AI ─────────────────────────────────────────────────────────────────
export async function getAnomalyScores(epochs = 100) {
  return request("GET", `/api/graph/anomaly-scores?epochs=${epochs}`);
}

export async function getGraphSummary() {
  return request("GET", "/api/graph/summary");
}

export async function getNodeStats(address) {
  return request("GET", `/api/graph/node-stats/${address}`);
}

export async function flagNode({ address, reason }) {
  return request("POST", "/api/graph/flag-node", { address, reason });
}

// ── Health ────────────────────────────────────────────────────────────────────
export async function checkHealth() {
  return request("GET", "/health");
}
