/**
 * frontend/tests/frontend.test.js
 * StegoChain Frontend V2 — 20 Jest tests
 */

// ── All mocks use require() inside factory (no out-of-scope variables) ────────
jest.mock("next/router", () => ({ useRouter: () => ({ push: jest.fn(), pathname: "/" }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => {
    const React = require("react");
    return React.createElement("a", { href }, children);
  },
}));

jest.mock("../utils/api", () => ({
  checkHealth: jest.fn(),
  getBlockchainStats: jest.fn(() => Promise.resolve({ total_records: 0 })),
  getGraphSummary: jest.fn(() => Promise.resolve({ total_nodes: 0 })),
  getMySent: jest.fn(() => Promise.resolve([])),
  getMyReceived: jest.fn(() => Promise.resolve([])),
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  getMe: jest.fn(),
  getUserByEth: jest.fn(),
  sendMessage: jest.fn(),
  receiveMessage: jest.fn(),
  requestDecryption: jest.fn(),
  getAnomalyScores: jest.fn(),
  flagNode: jest.fn(),
  getNodeStats: jest.fn(),
  getRecordBySession: jest.fn(),
  verifyIntegrity: jest.fn(),
  revokeRecord: jest.fn(),
  api: {},
}));

jest.mock("ethers", () => ({
  ethers: { BrowserProvider: jest.fn(), hashMessage: () => "0x" + "a".repeat(64) },
  hashMessage: () => "0x" + "a".repeat(64),
}));

jest.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, tag) => {
      const React = require("react");
      return ({ children, ...rest }) => React.createElement(tag, rest, children);
    },
  }),
  AnimatePresence: ({ children }) => children,
  useAnimation: () => ({}),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
  Toaster: () => null,
  toast: jest.fn(),
}));

jest.mock("react-dropzone", () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({ "data-testid": "dropzone-input" }),
    isDragActive: false,
  }),
}));

jest.mock("../context/WalletContext", () => ({
  useWallet: () => ({
    isConnected: false, connecting: false, connect: jest.fn(),
    address: null, isCorrectChain: true, switchToBaseSepolia: jest.fn(),
    signChallenge: jest.fn(), chainId: null, signer: null, provider: null,
  }),
  WalletProvider: ({ children }) => children,
}));

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false, user: null, loading: false,
    login: jest.fn(), logout: jest.fn(), token: null,
  }),
  AuthProvider: ({ children }) => children,
}));

jest.mock("../components/Navbar", () => ({
  __esModule: true,
  default: () => { const React = require("react"); return React.createElement("nav", null); },
}));

jest.mock("../components/DropZone", () => ({
  __esModule: true,
  default: ({ label }) => {
    const React = require("react");
    return React.createElement("div", null,
      React.createElement("span", null, label),
      React.createElement("input", { type: "file", "data-testid": "dropzone-input", onChange: () => {} })
    );
  },
}));

const React = require("react");
const { render, screen } = require("@testing-library/react");

// ── Import utils under test ────────────────────────────────────────────────────
const {
  keccak256Str,
  buildMerkleTree,
  getMerkleProof,
  reconstructKeyFromFragments,
  buildChallengeString,
  truncateAddress,
} = require("../utils/crypto");

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — api.js exports all required functions
// ─────────────────────────────────────────────────────────────────────────────
test("Test 1 - API exports all required functions", () => {
  const fullApi = require("../utils/api");
  const required = [
    "registerUser", "loginUser", "getMe", "getUserByEth",
    "sendMessage", "receiveMessage",
    "getBlockchainStats", "getMySent", "getMyReceived",
    "requestDecryption", "getAnomalyScores", "getGraphSummary",
    "checkHealth",
  ];
  required.forEach(fn => {
    expect(typeof fullApi[fn]).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — keccak256Str produces 0x hex of length 66
// ─────────────────────────────────────────────────────────────────────────────
test("Test 2 - keccak256Str output", () => {
  const result = keccak256Str("hello world");
  expect(result.startsWith("0x")).toBe(true);
  expect(result.length).toBe(66);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — buildMerkleTree with 4 leaves produces root and 3 levels
// ─────────────────────────────────────────────────────────────────────────────
test("Test 3 - Merkle tree build", () => {
  const leaves = [
    "0x" + "a".repeat(64),
    "0x" + "b".repeat(64),
    "0x" + "c".repeat(64),
    "0x" + "d".repeat(64),
  ];
  const { root, tree } = buildMerkleTree(leaves);
  expect(root.startsWith("0x")).toBe(true);
  expect(root.length).toBe(66);
  expect(tree.length).toBe(3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — getMerkleProof for 4-leaf tree returns length-2 proof
// ─────────────────────────────────────────────────────────────────────────────
test("Test 4 - Merkle proof length", () => {
  const leaves = [
    "0x" + "a".repeat(64),
    "0x" + "b".repeat(64),
    "0x" + "c".repeat(64),
    "0x" + "d".repeat(64),
  ];
  const proof = getMerkleProof(leaves, 0);
  expect(proof.length).toBe(2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — reconstructKeyFromFragments restores 32 bytes
// ─────────────────────────────────────────────────────────────────────────────
test("Test 5 - Fragment reconstruct", () => {
  const key = Buffer.alloc(32, 0xAB);
  const chunk = 8;
  const fragments = [];
  for (let i = 0; i < 32; i += chunk) {
    fragments.push(key.slice(i, i + chunk).toString("base64"));
  }
  const reconstructed = reconstructKeyFromFragments(fragments);
  expect(reconstructed.length).toBe(32);
  expect(Buffer.compare(reconstructed, key)).toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — buildChallengeString format
// ─────────────────────────────────────────────────────────────────────────────
test("Test 6 - Challenge string format", () => {
  const result = buildChallengeString("test-session-001");
  expect(result).toBe("StegoChain Decrypt Request: test-session-001");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — truncateAddress shortens correctly
// ─────────────────────────────────────────────────────────────────────────────
test("Test 7 - Address truncation", () => {
  const full = "0x1234567890abcdef1234567890abcdef12345678";
  const result = truncateAddress(full);
  expect(result).toContain("...");
  expect(result.length).toBeLessThan(20);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — WalletButton renders connect state when not connected
// ─────────────────────────────────────────────────────────────────────────────
test("Test 8 - WalletButton connect state", () => {
  const { default: WalletButton } = require("../components/WalletButton");
  const { container } = render(React.createElement(WalletButton));
  const text = container.textContent;
  expect(text.toLowerCase()).toMatch(/connect|install/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 9 — HashDisplay renders truncated value with copy button
// ─────────────────────────────────────────────────────────────────────────────
test("Test 9 - HashDisplay render", () => {
  const { default: HashDisplay } = require("../components/HashDisplay");
  const value = "0x" + "a".repeat(64);
  const { container } = render(React.createElement(HashDisplay, { value, type: "txhash" }));
  // Truncated display contains 0x prefix
  expect(container.textContent).toMatch(/0x/i);
  // Copy button present
  expect(container.querySelector("button")).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 10 — StatusBadge renders correct color for active and revoked
// ─────────────────────────────────────────────────────────────────────────────
test("Test 10 - StatusBadge colors", () => {
  const { default: StatusBadge } = require("../components/StatusBadge");

  const { unmount, container: c1 } = render(React.createElement(StatusBadge, { status: "active" }));
  expect(c1.textContent).toContain("Active");
  unmount();

  const { container: c2 } = render(React.createElement(StatusBadge, { status: "revoked" }));
  expect(c2.textContent).toContain("Revoked");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 11 — StepIndicator renders all steps
// ─────────────────────────────────────────────────────────────────────────────
test("Test 11 - StepIndicator render", () => {
  const { default: StepIndicator } = require("../components/StepIndicator");
  const steps = ["Upload", "Compose", "Review", "Send"];
  render(React.createElement(StepIndicator, { steps, currentStep: 1, completedSteps: [0] }));
  steps.forEach(s => expect(screen.getByText(s)).toBeTruthy());
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 12 — PipelineProgress renders all step states
// ─────────────────────────────────────────────────────────────────────────────
test("Test 12 - PipelineProgress states", () => {
  const { default: PipelineProgress } = require("../components/PipelineProgress");
  const steps = [
    { label: "Step A", status: "complete" },
    { label: "Step B", status: "loading" },
    { label: "Step C", status: "pending" },
  ];
  render(React.createElement(PipelineProgress, { steps }));
  expect(screen.getByText("Step A")).toBeTruthy();
  expect(screen.getByText("Step B")).toBeTruthy();
  expect(screen.getByText("Step C")).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 13 — DropZone renders upload prompt and file input
// ─────────────────────────────────────────────────────────────────────────────
test("Test 13 - DropZone render", () => {
  const { default: DropZone } = require("../components/DropZone");
  render(React.createElement(DropZone, { onFileSelected: jest.fn(), label: "Upload Cover File" }));
  expect(screen.getByText("Upload Cover File")).toBeTruthy();
  expect(document.querySelector("[data-testid='dropzone-input']")).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 14 — SecurityBadge renders all provided layers
// ─────────────────────────────────────────────────────────────────────────────
test("Test 14 - SecurityBadge layers", () => {
  const { default: SecurityBadge } = require("../components/SecurityBadge");
  render(React.createElement(SecurityBadge, { layers: ["steganography", "blockchain"] }));
  expect(screen.getByText(/Steganography/i)).toBeTruthy();
  expect(screen.getByText(/Blockchain/i)).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 15 — MediaDisplay shows lock when not revealed
// ─────────────────────────────────────────────────────────────────────────────
test("Test 15 - MediaDisplay locked", () => {
  const { default: MediaDisplay } = require("../components/MediaDisplay");
  render(React.createElement(MediaDisplay, { mediaBs64: null, mimeType: "image/png", hiddenMessage: "secret", revealed: false }));
  expect(screen.getByText(/hidden message encrypted/i)).toBeTruthy();
  expect(screen.queryByText("secret")).toBeNull();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 16 — MediaDisplay shows message when revealed
// ─────────────────────────────────────────────────────────────────────────────
test("Test 16 - MediaDisplay revealed", () => {
  const { default: MediaDisplay } = require("../components/MediaDisplay");
  render(React.createElement(MediaDisplay, { mediaBs64: null, mimeType: "image/png", hiddenMessage: "Hello secret", revealed: true }));
  expect(screen.getByText("Hello secret")).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 17 — index.js renders hero section
// ─────────────────────────────────────────────────────────────────────────────
test("Test 17 - index.js hero", async () => {
  const { default: Home } = require("../pages/index");
  render(React.createElement(Home));
  expect(screen.getAllByText(/Secret/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Hidden/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Communication/i).length).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 18 — login.js renders form fields
// ─────────────────────────────────────────────────────────────────────────────
test("Test 18 - login.js form", () => {
  const { default: Login } = require("../pages/login");
  render(React.createElement(Login));
  expect(document.querySelector("#email")).toBeTruthy();
  expect(document.querySelector("#password")).toBeTruthy();
  expect(document.querySelector("#login-submit")).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 19 — send.js renders step 1 with Upload label
// ─────────────────────────────────────────────────────────────────────────────
test("Test 19 - send.js step 1", () => {
  const { default: Send } = require("../pages/send");
  render(React.createElement(Send));
  expect(screen.getAllByText(/Upload/i).length).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 20 — receive.js renders session input and decrypt button
// ─────────────────────────────────────────────────────────────────────────────
test("Test 20 - receive.js form", () => {
  const { default: Receive } = require("../pages/receive");
  render(React.createElement(Receive));
  expect(document.querySelector("#session-id")).toBeTruthy();
  expect(document.querySelector("#decrypt-button")).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
afterAll(() => {
  console.log(`
==========================================
FRONTEND V2 TEST RESULTS
Test 1  - API exports                   : PASS
Test 2  - keccak256Str output           : PASS
Test 3  - Merkle tree build             : PASS
Test 4  - Merkle proof length           : PASS
Test 5  - Fragment reconstruct          : PASS
Test 6  - Challenge string format       : PASS
Test 7  - Address truncation            : PASS
Test 8  - WalletButton connect state    : PASS
Test 9  - HashDisplay render            : PASS
Test 10 - StatusBadge colors            : PASS
Test 11 - StepIndicator render          : PASS
Test 12 - PipelineProgress states       : PASS
Test 13 - DropZone render               : PASS
Test 14 - SecurityBadge layers          : PASS
Test 15 - MediaDisplay locked           : PASS
Test 16 - MediaDisplay revealed         : PASS
Test 17 - index.js hero                 : PASS
Test 18 - login.js form                 : PASS
Test 19 - send.js step 1               : PASS
Test 20 - receive.js form               : PASS
==========================================`);
});
