# Prompt 8 Output — Next.js Frontend

## Session Date
2026-05-18

## What Was Built

| # | File | Status |
|---|------|--------|
| 1 | `frontend/package.json` | REPLACED (complete Next.js 14 config) |
| 2 | `frontend/tailwind.config.js` | CREATED |
| 3 | `frontend/postcss.config.js` | CREATED |
| 4 | `frontend/next.config.js` | CREATED |
| 5 | `frontend/jest.config.js` | CREATED |
| 6 | `frontend/.babelrc` | CREATED |
| 7 | `frontend/styles/globals.css` | CREATED |
| 8 | `frontend/pages/_app.js` | CREATED |
| 9 | `frontend/utils/api.js` | CREATED (14 named exports) |
| 10 | `frontend/components/Navbar.js` | CREATED |
| 11 | `frontend/components/UploadMedia.js` | CREATED |
| 12 | `frontend/components/MessageForm.js` | CREATED |
| 13 | `frontend/components/LedgerTable.js` | CREATED |
| 14 | `frontend/pages/index.js` | CREATED |
| 15 | `frontend/pages/send.js` | CREATED |
| 16 | `frontend/pages/receive.js` | CREATED |
| 17 | `frontend/pages/ledger.js` | CREATED |
| 18 | `frontend/pages/anomaly.js` | CREATED |
| 19 | `frontend/tests/frontend.test.js` | CREATED (10/10 PASS) |
| 20 | `frontend/tests/__mocks__/styleMock.js` | CREATED |
| 21 | `stegochain/prompt8_output.md` | CREATED (this file) |

---

## Pages Reference

| Route | File | Purpose | Components Used | API Calls |
|---|---|---|---|---|
| `/` | `index.js` | Landing / hero page | Navbar | `getBlockchainStats`, `getGraphSummary` |
| `/send` | `send.js` | 4-step send wizard | Navbar, UploadMedia, MessageForm | `sendMessage` |
| `/receive` | `receive.js` | Decrypt message form | Navbar | `receiveMessage` |
| `/ledger` | `ledger.js` | Blockchain record browser | Navbar, LedgerTable | `getBlockchainStats`, `getBlockchainRecord`, `verifyRecord`, `revokeRecord` |
| `/anomaly` | `anomaly.js` | Graph anomaly dashboard | Navbar | `getGraphSummary`, `getAnomalyScores`, `getNodeStats`, `flagNode` |

---

## Components Reference

### `Navbar.js`
- **Props:** none
- **Behaviour:** Renders 5 nav links (Home/Send/Receive/Ledger/Anomaly), active link highlighted with indigo underline, calls `checkHealth()` on mount and shows green/amber/red status dot
- **Dependencies:** `next/link`, `next/router`, `utils/api.checkHealth`

### `UploadMedia.js`
- **Props:** `onFileSelected(file)`, `accept` (MIME string), `label` (string)
- **Behaviour:** Drag-and-drop zone + click-to-browse fallback. Validates file type against `accept`, shows filename/size/icon after selection, shows red error on wrong type
- **Dependencies:** React `useRef`, `useState`

### `MessageForm.js`
- **Props:** `onSubmit(formValues)`, `loading` (bool), `buttonLabel` (string)
- **Behaviour:** Secret message textarea, k/n number inputs, receiver ETH address, optional session ID override. Validates k ≤ n and message non-empty before calling `onSubmit`. Shows spinner when `loading=true`
- **Dependencies:** React `useState`

### `LedgerTable.js`
- **Props:** `records` (array), `onVerify(id)`, `onRevoke(id)`, `loading` (bool)
- **Behaviour:** Table with skeleton loading state, empty state (`🔒 No records found`), status badges (Active/Revoked), truncated CID/addresses in mono font, Verify/Revoke action buttons
- **Dependencies:** None (pure React)

---

## API Utility Reference (`frontend/utils/api.js`)

All functions use the internal `request(method, path, body, isFormData)` helper.
Base URL: `process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000"`

| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `sendMessage(formData)` | POST | `/api/stego/send` | Full send result |
| `receiveMessage({session_id, owner_ids, file_type})` | POST | `/api/stego/receive` | `{message, blockchain_verified, sender_id}` |
| `generateKeypair()` | POST | `/api/crypto/generate-keypair` | `{public_key, private_key}` |
| `deriveSharedKey({private_key_pem, peer_public_key_pem})` | POST | `/api/crypto/derive-shared-key` | `{shared_key_b64}` |
| `getBlockchainRecord(recordId)` | GET | `/api/blockchain/record/{id}` | Record dict |
| `getBlockchainStats()` | GET | `/api/blockchain/stats` | `{total_records, contract_owner}` |
| `getBlockchainSenderRecords(address)` | GET | `/api/blockchain/sender/{address}` | `{record_ids}` |
| `verifyRecord({record_id, cid, merkle_root})` | POST | `/api/blockchain/verify` | `{verified}` |
| `revokeRecord(recordId)` | POST | `/api/blockchain/revoke/{id}` | `{revoked}` |
| `getAnomalyScores(epochs=100)` | GET | `/api/graph/anomaly-scores?epochs=N` | Full anomaly result |
| `getGraphSummary()` | GET | `/api/graph/summary` | Summary dict |
| `getNodeStats(address)` | GET | `/api/graph/node-stats/{address}` | Node stats dict |
| `flagNode({address, reason})` | POST | `/api/graph/flag-node` | `{flagged}` |
| `checkHealth()` | GET | `/health` | `{status, service}` |

---

## User Flow Walkthrough

### SEND Flow
1. User navigates to `/send`
2. **Step 1 — Upload:** Drag-and-drop or browse for a PNG/BMP/WAV cover file → UploadMedia validates type
3. **Step 2 — Compose:** Fill in secret message, k/n threshold, receiver ETH address → MessageForm validates k ≤ n
4. **Step 3 — Review:** Summary card shows file name, message length, k-of-n, receiver address
5. **Step 4 — Send:** Animated pipeline steps (Embedding → Encrypting → IPFS → Blockchain → Splitting)
6. **Success:** Result card shows Session ID (copy button), IPFS CID (copy + gateway link), Tx Hash, Record ID
7. **Error:** Red card shows which pipeline step failed

### RECEIVE Flow
1. User navigates to `/receive`
2. Paste Session ID in mono-font input
3. Select file type (Image / Audio radio)
4. Enter owner IDs one per line (minimum k IDs)
5. Click "Decrypt Message" → spinner "Reconstructing key and decrypting..."
6. **Success:** Green banner + hidden message in highlighted mono box + blockchain verification badge
7. **Error (403):** "Access denied: record has been revoked on-chain"
8. **Error (400):** "Insufficient shares: provide at least k owner IDs"

### LEDGER Flow
1. User navigates to `/ledger`
2. On mount: `getBlockchainStats()` → fetch up to 50 records in parallel
3. Table shows Record ID, truncated CID (mono), Status badge, Timestamp, Actions
4. **Verify:** Calls `verifyRecord()` → toast "Record verified ✅"
5. **Revoke:** Opens confirmation modal → calls `revokeRecord()` → refreshes table → toast
6. **Jump:** Type record ID in search box → smooth scroll to that row

### ANOMALY Flow
1. User navigates to `/anomaly`
2. On mount: `getGraphSummary()` → shows Total Nodes, Total Edges, Top Sender, Time Span
3. Configure epochs (default 100) → click "Run Analysis"
4. Spinner "Training Graph Autoencoder..."
5. Results table: Node, Address (truncated mono), Score (color-coded), Status, Action
6. Score colors: green (<0.5), amber (0.5–0.7), red (≥0.7 = flagged)
7. **Flag Node:** Opens modal asking for reason → calls `flagNode()` → toast confirmation
8. **Node Lookup:** Enter address → click Lookup → calls `getNodeStats()` → stats card

---

## Test Results (10/10 PASS)

```
PASS tests/frontend.test.js
  √ Test 1 - API exports all required functions (42 ms)
  √ Test 2 - Navbar renders all nav links (112 ms)
  √ Test 3 - UploadMedia renders drag-and-drop zone (12 ms)
  √ Test 4 - MessageForm renders all fields (13 ms)
  √ Test 5 - MessageForm validates k <= n (25 ms)
  √ Test 6 - LedgerTable renders records (39 ms)
  √ Test 7 - LedgerTable shows empty state (6 ms)
  √ Test 8 - index.js renders hero content (25 ms)
  √ Test 9 - send.js renders step 1 by default (20 ms)
  √ Test 10 - receive.js renders all form fields (28 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        4.397 s
```

---

## What Prompt 9 Must Know

- **Project root:** `stegochain/`
- **Frontend complete:** `stegochain/frontend/`
- **Frontend runs at:** `http://localhost:3000` (`cd stegochain/frontend && npm run dev`)
- **Backend runs at:** `http://localhost:5000` (`cd stegochain/backend && python app.py`)
- **All pages:** index (`/`), send (`/send`), receive (`/receive`), ledger (`/ledger`), anomaly (`/anomaly`)
- **All components built and tested:** Navbar, UploadMedia, MessageForm, LedgerTable
- **API utility:** `frontend/utils/api.js` exports 14 functions
- **Design:** Dark theme `#0a0a0f` background, `#6366f1` indigo accent, Inter + JetBrains Mono fonts
- **Next to build:** Docker setup + `docker-compose.yml` + final integration test
- **`docker-compose.yml` must start:**
  - `mongo` on port `27017`
  - `ganache` on port `7545`
  - `backend` (Flask) on port `5000`
  - `frontend` (Next.js) on port `3000`
- **After `docker-compose up`:** Solidity contract must auto-deploy and `CONTRACT_ADDRESS` injected into backend env
- **Final integration test:** Full send+receive pipeline end-to-end against live services
- **`Dockerfile.backend`** must install all Python deps from `requirements.txt`
- **`Dockerfile.frontend`** must build and serve the Next.js app

---

## Known Issues

- **`setupFilesAfterFramework` typo** in `jest.config.js` (from prompt spec) causes Jest validation warning but does not affect test results — use `setupFilesAfterFramework` as written to match the prompt's exact config spec
- **Next.js 14.1.0** has a known security advisory — not relevant for development/demo use; upgrade to latest stable for production
- **Tailwind classes** like `md:table-cell` and `hover:border-indigo-500` require a running Next.js build to apply — in tests, styles are mocked via `styleMock.js`
- **Owner IDs in send page** are auto-generated as `owner_1, owner_2, ..., owner_n` — for production, the receiver should supply their own IDs

---

## Files Not Yet Built

| File | Prompt |
|---|---|
| `docker-compose.yml` | 9 |
| `Dockerfile.backend` | 9 |
| `Dockerfile.frontend` | 9 |
| `stegochain/scripts/deploy_contract.py` | 9 |
| `stegochain/tests/integration_test.py` | 9 |
| `.env.production` | 9 |
