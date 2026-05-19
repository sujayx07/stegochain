/**
 * frontend/tests/frontend.test.js
 * Jest + RTL smoke tests — all API calls are mocked.
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock next/router ──────────────────────────────────────────────────────────
jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/" }),
}));

// ── Mock next/link ────────────────────────────────────────────────────────────
jest.mock("next/link", () => {
  return function MockLink({ href, children, ...rest }) {
    return <a href={href} {...rest}>{children}</a>;
  };
});

// ── Mock next/head ────────────────────────────────────────────────────────────
jest.mock("next/head", () => {
  return function MockHead({ children }) { return <>{children}</>; };
});

// ── Mock all API functions ────────────────────────────────────────────────────
jest.mock("../utils/api", () => ({
  checkHealth:               jest.fn().mockResolvedValue({ status: "ok", service: "StegoChain Backend" }),
  sendMessage:               jest.fn().mockResolvedValue({ session_id: "sess_001", ipfs_cid: "QmTest", tx_hash: "0xabc", blockchain_record_id: 0, gateway_url: "" }),
  receiveMessage:            jest.fn().mockResolvedValue({ message: "hello", session_id: "sess_001", blockchain_verified: true, sender_id: "alice", file_type: "image" }),
  generateKeypair:           jest.fn().mockResolvedValue({ public_key: "PEM_PUB", private_key: "PEM_PRIV" }),
  deriveSharedKey:           jest.fn().mockResolvedValue({ shared_key_b64: "abc123" }),
  getBlockchainRecord:       jest.fn().mockResolvedValue({ record_id: 0, cid: "QmABCDEFGHIJKLMN1234", sender_address: "0xSender", receiver_address: "0xReceiver", is_active: true, timestamp: 1716000000 }),
  getBlockchainStats:        jest.fn().mockResolvedValue({ total_records: 0, contract_owner: "0xOwner" }),
  getBlockchainSenderRecords:jest.fn().mockResolvedValue({ record_ids: [] }),
  verifyRecord:              jest.fn().mockResolvedValue({ verified: true }),
  revokeRecord:              jest.fn().mockResolvedValue({ revoked: true }),
  getAnomalyScores:          jest.fn().mockResolvedValue({ num_nodes: 5, num_edges: 10, anomaly_scores: { "0": 0.1 }, flagged_nodes: [], threshold: 0.7, trained_epochs: 100 }),
  getGraphSummary:           jest.fn().mockResolvedValue({ total_nodes: 5, total_edges: 10, most_active_sender: "0xSender", most_active_receiver: "0xRecv", avg_out_degree: 2.0, avg_in_degree: 2.0, time_span_hours: 2.5 }),
  getNodeStats:              jest.fn().mockResolvedValue({ address: "0x1", num_sent: 3, num_received: 1, total_interactions: 4, unique_receivers: 2, unique_senders: 1, first_seen: "2026-05-17", last_seen: "2026-05-17" }),
  flagNode:                  jest.fn().mockResolvedValue({ flagged: true }),
}));

// ── Lazy component imports (after mocks) ──────────────────────────────────────
const Navbar      = require("../components/Navbar").default;
const UploadMedia = require("../components/UploadMedia").default;
const MessageForm = require("../components/MessageForm").default;
const LedgerTable = require("../components/LedgerTable").default;
const api         = require("../utils/api");

// ── Helpers ──────────────────────────────────────────────────────────────────
function _pass(name) { console.log(`  [result] PASS - ${name}`); }
function _fail(name, e) { console.error(`  [result] FAIL - ${name}\n  ${e}`); }

// ── Test 1 — API exports ──────────────────────────────────────────────────────
test("Test 1 - API exports all required functions", () => {
  try {
    const required = [
      "sendMessage","receiveMessage","generateKeypair","deriveSharedKey",
      "getBlockchainRecord","getBlockchainStats","verifyRecord","revokeRecord",
      "getAnomalyScores","getGraphSummary","getNodeStats","flagNode","checkHealth",
    ];
    for (const fn of required) {
      expect(typeof api[fn]).toBe("function");
    }
    _pass("All 13 API functions exported");
  } catch(e) { _fail("API exports", e); throw e; }
});

// ── Test 2 — Navbar nav links ─────────────────────────────────────────────────
test("Test 2 - Navbar renders all nav links", async () => {
  try {
    await act(async () => { render(<Navbar />); });
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.getByText("Receive")).toBeInTheDocument();
    expect(screen.getByText("Ledger")).toBeInTheDocument();
    expect(screen.getByText("Anomaly")).toBeInTheDocument();
    _pass("All 5 nav links present");
  } catch(e) { _fail("Navbar nav links", e); throw e; }
});

// ── Test 3 — UploadMedia drag zone ────────────────────────────────────────────
test("Test 3 - UploadMedia renders drag-and-drop zone", () => {
  try {
    render(<UploadMedia label="Upload Cover File" accept="image/png" onFileSelected={() => {}} />);
    expect(screen.getByText("Upload Cover File")).toBeInTheDocument();
    expect(document.querySelector("input[type=file]")).toBeInTheDocument();
    _pass("Label and file input present");
  } catch(e) { _fail("UploadMedia drag zone", e); throw e; }
});

// ── Test 4 — MessageForm fields ───────────────────────────────────────────────
test("Test 4 - MessageForm renders all fields", () => {
  try {
    render(<MessageForm onSubmit={jest.fn()} loading={false} buttonLabel="Send" />);
    expect(document.querySelector("textarea")).toBeInTheDocument();
    const numInputs = document.querySelectorAll("input[type=number]");
    expect(numInputs.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("submit-button")).toHaveTextContent("Send");
    _pass("Textarea, number inputs, and submit button present");
  } catch(e) { _fail("MessageForm fields", e); throw e; }
});

// ── Test 5 — MessageForm k<=n validation ─────────────────────────────────────
test("Test 5 - MessageForm validates k <= n", () => {
  try {
    const onSubmit = jest.fn();
    render(<MessageForm onSubmit={onSubmit} loading={false} buttonLabel="Send" />);

    // Type a message so "message empty" doesn't fire first
    fireEvent.change(document.querySelector("textarea"), { target: { value: "test msg" } });

    // Set k=5, n=3 (invalid)
    const [kInput, nInput] = document.querySelectorAll("input[type=number]");
    fireEvent.change(kInput, { target: { value: "5" } });
    fireEvent.change(nInput, { target: { value: "3" } });

    fireEvent.click(screen.getByTestId("submit-button"));

    // Error message should appear
    const errEl = screen.getByTestId("form-error");
    const txt = errEl.textContent.toLowerCase();
    expect(txt.includes("threshold") || txt.includes("k") || txt.includes("must")).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    _pass("k>n shows error, onSubmit not called");
  } catch(e) { _fail("MessageForm k<=n validation", e); throw e; }
});

// ── Test 6 — LedgerTable with records ────────────────────────────────────────
test("Test 6 - LedgerTable renders records", () => {
  try {
    const records = [
      { record_id: 0, cid: "QmABCDEFGHIJKLMN1234", sender_address: "0xSender1", receiver_address: "0xReceiver1", is_active: true, timestamp: 1716000000 },
      { record_id: 1, cid: "QmXXXXXXXXXXXXXX5678", sender_address: "0xSender2", receiver_address: "0xReceiver2", is_active: false, timestamp: 1716001000 },
    ];
    render(<LedgerTable records={records} onVerify={jest.fn()} onRevoke={jest.fn()} loading={false} />);
    expect(screen.getByText("#0")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    // CID truncated to 16 chars + "..."
    expect(screen.getByText("QmABCDEFGHIJKLMN...")).toBeInTheDocument();
    const verifyBtns = screen.getAllByText("Verify");
    expect(verifyBtns.length).toBe(2);
    const revokeBtns = screen.getAllByText("Revoke");
    expect(revokeBtns.length).toBe(2);
    _pass("Both records, CIDs, Verify and Revoke buttons present");
  } catch(e) { _fail("LedgerTable with records", e); throw e; }
});

// ── Test 7 — LedgerTable empty state ─────────────────────────────────────────
test("Test 7 - LedgerTable shows empty state", () => {
  try {
    render(<LedgerTable records={[]} onVerify={jest.fn()} onRevoke={jest.fn()} loading={false} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No records found");
    _pass("Empty state 'No records found' shown");
  } catch(e) { _fail("LedgerTable empty state", e); throw e; }
});

// ── Test 8 — index.js hero content ───────────────────────────────────────────
test("Test 8 - index.js renders hero content", async () => {
  try {
    const IndexPage = require("../pages/index").default;
    await act(async () => { render(<IndexPage />); });
    // Heading is split across spans; confirm the page title contains the text
    const heading = document.querySelector("h1");
    expect(heading.textContent).toMatch(/Secure Hidden/i);
    expect(screen.getByTestId("cta-send")).toBeInTheDocument();
    expect(screen.getByTestId("cta-receive")).toBeInTheDocument();
    _pass("Hero heading and CTA buttons present");
  } catch(e) { _fail("index.js hero content", e); throw e; }
});

// ── Test 9 — send.js step 1 ───────────────────────────────────────────────────
test("Test 9 - send.js renders step 1 by default", async () => {
  try {
    const SendPage = require("../pages/send").default;
    await act(async () => { render(<SendPage />); });
    // First step label "Upload" visible in step indicator
    const uploadTexts = screen.getAllByText(/Upload/i);
    expect(uploadTexts.length).toBeGreaterThanOrEqual(1);
    // File input from UploadMedia
    expect(document.querySelector("input[type=file]")).toBeInTheDocument();
    _pass("'Upload' step label and file input present on step 1");
  } catch(e) { _fail("send.js step 1", e); throw e; }
});

// ── Test 10 — receive.js form fields ─────────────────────────────────────────
test("Test 10 - receive.js renders all form fields", async () => {
  try {
    const ReceivePage = require("../pages/receive").default;
    await act(async () => { render(<ReceivePage />); });
    expect(screen.getByTestId("session-id-input")).toBeInTheDocument();
    expect(screen.getByTestId("owner-ids-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("decrypt-button")).toBeInTheDocument();
    _pass("Session ID input, owner IDs textarea, and Decrypt button present");
  } catch(e) { _fail("receive.js form fields", e); throw e; }
});
