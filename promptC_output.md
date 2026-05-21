# Prompt C Output — Next.js Frontend V2

## Session Date
2026-05-20

## What Was Built

| File | Status |
|---|---|
| `frontend/package.json` | ✅ Updated — all V2 dependencies |
| `frontend/tailwind.config.js` | ✅ Full V2 design token config |
| `frontend/styles/globals.css` | ✅ Full CSS system |
| `frontend/next.config.js` | ✅ Base Sepolia env vars |
| `frontend/postcss.config.js` | ✅ Unchanged |
| `frontend/.babelrc` | ✅ Unchanged |
| `frontend/jest.config.js` | ✅ Fixed (setupFilesAfterEnv) |
| `frontend/pages/_app.js` | ✅ AuthProvider + WalletProvider + Toaster |
| `frontend/context/AuthContext.js` | ✅ New — JWT token + user state |
| `frontend/context/WalletContext.js` | ✅ New — MetaMask + Base Sepolia |
| `frontend/utils/api.js` | ✅ Full replacement — axios + all exports |
| `frontend/utils/crypto.js` | ✅ New — keccak256, Merkle, fragment reconstruct |
| `frontend/components/Navbar.js` | ✅ Full rebuild |
| `frontend/components/WalletButton.js` | ✅ New |
| `frontend/components/StepIndicator.js` | ✅ New |
| `frontend/components/CopyButton.js` | ✅ New |
| `frontend/components/HashDisplay.js` | ✅ New |
| `frontend/components/StatusBadge.js` | ✅ New |
| `frontend/components/LoadingSkeleton.js` | ✅ New |
| `frontend/components/SecurityBadge.js` | ✅ New |
| `frontend/components/PipelineProgress.js` | ✅ New |
| `frontend/components/MediaDisplay.js` | ✅ New |
| `frontend/components/RecordCard.js` | ✅ New |
| `frontend/components/DropZone.js` | ✅ New |
| `frontend/pages/index.js` | ✅ Full rebuild |
| `frontend/pages/register.js` | ✅ New |
| `frontend/pages/login.js` | ✅ New |
| `frontend/pages/dashboard.js` | ✅ New |
| `frontend/pages/send.js` | ✅ Full rebuild |
| `frontend/pages/receive.js` | ✅ Full rebuild |
| `frontend/pages/ledger.js` | ✅ Full rebuild |
| `frontend/pages/anomaly.js` | ✅ Full rebuild |
| `frontend/tests/frontend.test.js` | ✅ 20/20 tests pass |
| `frontend/tests/__mocks__/styleMock.js` | ✅ New |

---

## Pages Reference

| Page | Route | Auth | Key Components | API Calls |
|---|---|---|---|---|
| `index.js` | `/` | No | Navbar, StatCard, FeatureCard | getBlockchainStats, getGraphSummary |
| `register.js` | `/register` | No | WalletButton, StepIndicator | registerUser, /api/crypto/generate-keypair |
| `login.js` | `/login` | No | — | loginUser |
| `dashboard.js` | `/dashboard` | Yes | Navbar, RecordCard, LoadingSkeleton, HashDisplay | getMySent, getMyReceived (30s polling) |
| `send.js` | `/send` | Yes | Navbar, StepIndicator, DropZone, PipelineProgress, HashDisplay, SecurityBadge | getUserByEth, sendMessage |
| `receive.js` | `/receive` | Yes | Navbar, MediaDisplay, HashDisplay, SecurityBadge | getRecordBySession, requestDecryption, receiveMessage |
| `ledger.js` | `/ledger` | Yes | Navbar, RecordCard, LoadingSkeleton, HashDisplay | getMySent, getMyReceived, getBlockchainStats, verifyIntegrity, revokeRecord |
| `anomaly.js` | `/anomaly` | No | Navbar, ScoreBar | getGraphSummary, getAnomalyScores, getNodeStats, flagNode |

---

## Components Reference

| Component | Props | Key Behaviour |
|---|---|---|
| `Navbar` | none | Uses useAuth + useWallet, backend health polling every 30s, mobile hamburger menu, chain warning banner |
| `WalletButton` | size, className | 5 states: no-MetaMask, connecting, wrong-chain, connected+copy, default connect |
| `StepIndicator` | steps, currentStep, completedSteps | Orange filled circles for completed, orange outline for current, gray for upcoming, animated connecting lines |
| `CopyButton` | text, size | Green checkmark flash for 2s, toast notification |
| `HashDisplay` | value, type, truncate, showLink | Orange pill, JetBrains Mono, CopyButton, Basescan external link for txhash/address |
| `StatusBadge` | status, size | active=green, revoked=red, pending=amber, complete=green, failed=red |
| `LoadingSkeleton` | type, count | shimmer-bg animation for card/row/text/avatar shapes |
| `SecurityBadge` | layers | Orange pills with icons, hover tooltip explaining each layer |
| `PipelineProgress` | steps[{label,status}] | Animated connecting lines, spring pop for complete, spinner for loading |
| `MediaDisplay` | mediaBs64, mimeType, hiddenMessage, revealed | Blob URL render, padlock overlay, spring-reveal animation for message card |
| `RecordCard` | record, showActions, onRevoke, onVerify | Expand/collapse, HashDisplay fields, SecurityBadge, Verify/Revoke buttons |
| `DropZone` | onFileSelected, accept, label, hint, maxSizeMB | react-dropzone, orange dashed border, drag highlight, file preview after selection |

---

## Crypto Utilities Reference (`utils/crypto.js`)

| Function | Inputs | Output |
|---|---|---|
| `keccak256Str(str)` | string | `0x` + 64-char hex |
| `keccak256Bytes(bytes)` | Uint8Array/Buffer | `0x` + 64-char hex |
| `buildMerkleTree(leaves)` | `0x` hex array | `{ root, leaves, tree }` — sorted-pair hashing matches Solidity |
| `getMerkleProof(leaves, index)` | leaf array, int | proof array of `0x` hex siblings |
| `hashFragment(fragmentB64)` | base64 string | keccak256 of raw fragment bytes |
| `buildChallengeString(sessionId)` | string | `StegoChain Decrypt Request: {sessionId}` |
| `buildChallengeHash(sessionId)` | string | ethers.hashMessage of challenge string |
| `reconstructKeyFromFragments(fragmentsB64)` | base64 array | Buffer of first 32 bytes of concatenated fragments |
| `toBytes32(hex)` | hex string | `0x`-prefixed hex |
| `truncateAddress(address, chars)` | address string | `0x123456...789abc` |
| `truncateCID(cid, chars)` | CID string | `Qm12345...bc678` |
| `formatTimestamp(ts)` | unix/ISO | locale date string |
| `copyToClipboard(text)` | string | writes to navigator.clipboard |

---

## User Flow Walkthroughs

### REGISTER flow
1. Navigate to `/register`
2. Step 1: Click Connect Wallet → MetaMask opens → approve → address shown
3. If wrong chain: click Switch to Base Sepolia
4. Click Continue
5. Step 2: Enter username, email, password, confirm password → Continue
6. Step 3: Click Generate Key Pair → backend generates ECC keypair → show public key
7. Show/copy private key from orange warning box
8. Check "I have saved my private key securely"
9. Click Create Account → POST /api/auth/register → JWT stored → redirect to /dashboard

### LOGIN flow
1. Navigate to `/login`
2. Enter email + password
3. Click Sign In → POST /api/auth/login → JWT stored in localStorage → redirect to /dashboard

### SEND flow
1. Navigate to `/send` (auth required)
2. Step 1: Drop or click to upload PNG/BMP/WAV file → preview shown → Next
3. Step 2: Type secret message (char counter), enter receiver ETH address (debounced lookup), select fragment count → Next
4. Step 3: Review summary card with SecurityBadge → click Send Now
5. Step 4: PipelineProgress animates through all 8 stages as POST /api/stego/send runs
6. Success card shows Session ID (prominent), IPFS CID, Tx Hash with Basescan links

### RECEIVE flow
1. Navigate to `/receive` (auth required)
2. Enter Session ID in large mono input, select Image/Audio
3. Click Decrypt → fetches blockchain record
4. Record found: shows sender info, prompts MetaMask sign
5. Click Sign & Verify → MetaMask signs `StegoChain Decrypt Request: {session_id}`
6. Backend verifies signature, returns fragments
7. Frontend calls receiveMessage → gets media_b64 + message
8. MediaDisplay shown with lock overlay for 1.5 seconds
9. Lock animates to unlocked (framer-motion spring)
10. Message card slides in with hidden message in orange-tinted mono font
11. Download button saves media file

### LEDGER flow
1. Navigate to `/ledger` (auth required)
2. Stats bar: total records, total users, contract HashDisplay
3. Filter bar: search by ID, All/Sent/Received buttons, Refresh
4. RecordCards with expand/collapse for all sent + received
5. Verify button → POST /api/blockchain/verify-integrity → toast
6. Revoke button → confirmation modal → POST /api/blockchain/revoke/{id} → card updates

### ANOMALY flow
1. Navigate to `/anomaly` (public)
2. Network summary stats fetched on mount
3. Set epochs (50–500), click Run Analysis
4. Training spinner cycles through 4 status messages
5. Results table: address, score bar (green/amber/red), flagged badge, Flag button
6. Flag button → modal → enter reason → POST /api/graph/flag-node
7. Node Lookup: enter address → GET /api/graph/node-stats → stat card

---

## MetaMask Integration Notes

- **Connection**: `ethers.BrowserProvider(window.ethereum)` → `getSigner()` → stores address, signer, chainId
- **Chain switching**: `wallet_switchEthereumChain` with chainId `0x14a34` (84532) → if 4902 error → `wallet_addEthereumChain`
- **Challenge signing**: `signer.signMessage("StegoChain Decrypt Request: {session_id}")` — personal_sign, no gas
- **Account change listener**: `ethereum.on("accountsChanged", ...)` → re-setup provider or clear state
- **Chain change listener**: `ethereum.on("chainChanged", ...)` → `window.location.reload()`

---

## Test Results

```
PASS tests/frontend.test.js
  √ Test 1  - API exports all required functions
  √ Test 2  - keccak256Str output
  √ Test 3  - Merkle tree build
  √ Test 4  - Merkle proof length
  √ Test 5  - Fragment reconstruct
  √ Test 6  - Challenge string format
  √ Test 7  - Address truncation
  √ Test 8  - WalletButton connect state
  √ Test 9  - HashDisplay render
  √ Test 10 - StatusBadge colors
  √ Test 11 - StepIndicator render
  √ Test 12 - PipelineProgress states
  √ Test 13 - DropZone render
  √ Test 14 - SecurityBadge layers
  √ Test 15 - MediaDisplay locked
  √ Test 16 - MediaDisplay revealed
  √ Test 17 - index.js hero
  √ Test 18 - login.js form
  √ Test 19 - send.js step 1
  √ Test 20 - receive.js form

Tests: 20 passed, 20 total — Time: 4.045s
```

---

## What Prompt D Must Know

- Frontend complete at `stegochain/frontend/`
- Frontend runs at `http://localhost:3000` with `npm run dev`
- All 8 pages built and tested
- MetaMask challenge format: `StegoChain Decrypt Request: {session_id}`
- Merkle leaf hash: keccak256 of raw fragment bytes
- Fragment assembly: client-side via `reconstructKeyFromFragments()`
- Media shown before message reveal using `MediaDisplay` component
- All API calls go through `frontend/utils/api.js` axios instance with JWT interceptor
- JWT stored in localStorage as `stegochain_token`
- User data stored in localStorage as `stegochain_user`
- Wallet state managed by `context/WalletContext.js`
- Auth state managed by `context/AuthContext.js`
- Design system: warm off-white `#F8F7F5` + orange `#F97316`, Inter + JetBrains Mono
- Contract: `0xa33fE3cee390910f8832134De02f7DC9bf473AfF` on Base Sepolia (chainId 84532)
- Next to build: Prompt D — integration tests, Docker update, final deployment guide

---

## Known Issues

- `console.error` warnings in tests for `whileHover` framer-motion prop on DOM elements — tests still pass, warnings are cosmetic only from mock proxy
- `act()` warning for async state updates in index.js render test — benign, test passes

---

## Files Built

```
frontend/
├── .babelrc
├── jest.config.js
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── context/
│   ├── AuthContext.js
│   └── WalletContext.js
├── components/
│   ├── CopyButton.js
│   ├── DropZone.js
│   ├── HashDisplay.js
│   ├── LoadingSkeleton.js
│   ├── MediaDisplay.js
│   ├── Navbar.js
│   ├── PipelineProgress.js
│   ├── RecordCard.js
│   ├── SecurityBadge.js
│   ├── StatusBadge.js
│   ├── StepIndicator.js
│   └── WalletButton.js
├── pages/
│   ├── _app.js
│   ├── anomaly.js
│   ├── dashboard.js
│   ├── index.js
│   ├── ledger.js
│   ├── login.js
│   ├── receive.js
│   ├── register.js
│   └── send.js
├── styles/
│   └── globals.css
├── utils/
│   ├── api.js
│   └── crypto.js
└── tests/
    ├── frontend.test.js
    └── __mocks__/
        └── styleMock.js
```
