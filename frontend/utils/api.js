import axios from "axios";
import toast from "react-hot-toast";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("stegochain_token");
}

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const message = err.response?.data?.error || err.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

// Auth
export const registerUser = (data) => api.post("/api/auth/register", data);
export const loginUser = (data) => api.post("/api/auth/login", data);
export const getMe = () => api.get("/api/auth/me");
export const getUserByEth = (address) => api.get(`/api/auth/user/eth/${address}`);

// Stego — do NOT set Content-Type manually for FormData;
// axios sets it automatically WITH the correct multipart boundary.
export const sendMessage    = (formData) => api.post("/api/stego/send",    formData);
export const finalizeSend   = (data)     => api.post("/api/stego/finalize-send", data);
export const receiveMessage = (data)     => api.post("/api/stego/receive", data);
export const embedMessage   = (formData) => api.post("/api/stego/embed",   formData);
export const extractMessage = (formData) => api.post("/api/stego/extract", formData);

// Blockchain
export const registerRecord = (data) => api.post("/api/blockchain/register-record", data);
export const requestDecryption = (data) => api.post("/api/blockchain/request-decryption", data);
export const getMySent = () => api.get("/api/blockchain/my-sent");
export const getMyReceived = () => api.get("/api/blockchain/my-received");
export const getRecord = (id) => api.get(`/api/blockchain/record/${id}`);
export const getRecordBySession = (sid) => api.get(`/api/blockchain/record/session/${sid}`);
export const verifyIntegrity = (data) => api.post("/api/blockchain/verify-integrity", data);
export const revokeRecord = (id) => api.post(`/api/blockchain/revoke/${id}`);
export const getBlockchainStats = () => api.get("/api/blockchain/stats");
export const getUserOnChain = (address) => api.get(`/api/blockchain/user/${address}`);

// Graph AI
export const getAnomalyScores = (epochs = 100) => api.get(`/api/graph/anomaly-scores?epochs=${epochs}`);
export const getGraphSummary = () => api.get("/api/graph/summary");
export const getNodeStats = (address) => api.get(`/api/graph/node-stats/${address}`);
export const flagNode = (data) => api.post("/api/graph/flag-node", data);

// Health
export const checkHealth = () => api.get("/health");

export { api };
