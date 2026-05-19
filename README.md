# StegoChain

A secure, end-to-end communication platform that unifies **steganography**, **AES-256-GCM cryptography**, **Ethereum blockchain anchoring**, **Shamir threshold secret sharing**, and **PyTorch Geometric AI-based anomaly detection** into one coherent system.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SENDER PIPELINE                                │
│                                                                        │
│  Cover File (PNG/WAV)                                                  │
│       │                                                                │
│       ▼                                                                │
│  LSB / Echo Hiding ──► Stego File                                     │
│       │                                                                │
│       ▼                                                                │
│  AES-256-GCM Encrypt ──► Encrypted Blob                              │
│       │                                                                │
│       ▼                                                                │
│  Pinata / IPFS Upload ──► CID                                         │
│       │                                                                │
│       ▼                                                                │
│  Merkle Tree Build ──► Root Hash                                       │
│       │                                                                │
│       ▼                                                                │
│  Ethereum Smart Contract ──► record_id + tx_hash                      │
│       │                                                                │
│       ▼                                                                │
│  Shamir k-of-n Split ──► n Key Shares → MongoDB                       │
│       │                                                                │
│       ▼                                                                │
│  session_id returned to sender                                         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                       RECEIVER PIPELINE                                │
│                                                                        │
│  session_id + k owner IDs                                              │
│       │                                                                │
│       ▼                                                                │
│  MongoDB ──► k Key Shares                                              │
│       │                                                                │
│       ▼                                                                │
│  Shamir Reconstruct ──► AES Key                                        │
│       │                                                                │
│       ▼                                                                │
│  IPFS Retrieve ──► Encrypted Blob                                      │
│       │                                                                │
│       ▼                                                                │
│  AES-256-GCM Decrypt ──► Stego File                                   │
│       │                                                                │
│       ▼                                                                │
│  LSB / Echo Extract ──► Secret Message                                 │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│              GRAPH AI MONITORING (runs in parallel)                    │
│                                                                        │
│  MongoDB Transactions ──► Transaction Graph (nodes = ETH addresses)   │
│                                                                        │
│  PyTorch Geometric GAE ──► Node Anomaly Scores [0.0 – 1.0]           │
│                                                                        │
│  Threshold 0.7 ──► Flagged Nodes (potential spammers / fraud)         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component        | Technology                                      |
|------------------|-------------------------------------------------|
| Frontend         | Next.js 14, Tailwind CSS, React 18              |
| Backend          | Flask 3.0 (Python 3.11)                         |
| Encryption       | AES-256-GCM, ECC P-256 (ECDH + ECDSA)          |
| Steganography    | LSB embedding (images), Echo hiding (audio)     |
| Secret Sharing   | Shamir k-of-n (finite field, prime = 2²⁵⁶+297) |
| Blockchain       | Private Ethereum via Hardhat + Ganache          |
| Smart Contract   | Solidity 0.8.19 with Merkle proof storage       |
| IPFS Storage     | Pinata cloud IPFS                               |
| Graph AI         | PyTorch Geometric — Graph Autoencoder (GAE)     |
| Database         | MongoDB 7 (pymongo)                             |
| Testing          | pytest, Jest + RTL, custom integration runner   |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker and Docker Compose (for containerised setup)
- MongoDB 7 (or use Docker)
- Ganache (deterministic, chainId 1337, port 7545)
- Pinata account (free tier — get API key at pinata.cloud)
- PyTorch + torch-geometric (CPU is fine for local testing)

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone and enter the project
cd stegochain/

# 2. Copy environment template and fill in your secrets
cp .env.production .env
# Edit .env — set PINATA_API_KEY, PINATA_SECRET_KEY, SECRET_KEY

# 3. Start all services
docker-compose up --build

# 4. Deploy the smart contract (first run only)
docker exec stegochain_backend python ../scripts/deploy_contract.py

# 5. Update CONTRACT_ADDRESS in .env and restart backend
# (the deploy script prints:  export CONTRACT_ADDRESS=0x...)
docker-compose restart backend

# 6. Visit the app
# Frontend : http://localhost:3000
# Backend  : http://localhost:5000
# Health   : http://localhost:5000/health
```

---

## Manual Setup (Without Docker)

### 1 — Backend

```bash
cd stegochain/backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS/Linux

pip install -r requirements.txt

# Set environment variables (Windows)
set MONGO_URI=mongodb://localhost:27017/stegochain
set GANACHE_URL=http://127.0.0.1:7545
set PINATA_API_KEY=your_key
set PINATA_SECRET_KEY=your_secret
set PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
set CONTRACT_ADDRESS=0x...     # from deploy step below

python app.py
```

### 2 — Blockchain + Contract

```bash
cd stegochain/blockchain
npm install
npx hardhat node --port 7545   # runs Ganache-compatible node

# In another terminal
npx hardhat run scripts/deploy.js --network ganache
# Copy CONTRACT_ADDRESS from output
```

Or use the Python deploy helper:

```bash
python stegochain/scripts/deploy_contract.py
```

### 3 — Frontend

```bash
cd stegochain/frontend
npm install
npm run dev     # http://localhost:3000
```

---

## Running Tests

### Backend Unit Tests (15 tests)
```bash
cd stegochain/backend
python tests/test_routes.py
```

### Graph AI Module Tests (12 tests)
```bash
cd stegochain/backend
python tests/test_graph.py
```

### Frontend Smoke Tests (10 tests)
```bash
cd stegochain/frontend
npm test
```

### Integration Tests (12 tests — requires backend running)
```bash
# Start backend first
cd stegochain/backend && python app.py

# In another terminal
cd stegochain
python tests/integration_test.py
```

---

## API Reference

| Method | Endpoint                          | Description                          |
|--------|-----------------------------------|--------------------------------------|
| POST   | `/api/stego/send`                 | Full send pipeline (embed→IPFS→chain)|
| POST   | `/api/stego/receive`              | Full receive pipeline                |
| POST   | `/api/stego/embed`                | Embed message in media file          |
| POST   | `/api/stego/extract`              | Extract message from stego file      |
| GET    | `/api/stego/capacity`             | Estimate embedding capacity          |
| POST   | `/api/crypto/generate-keypair`    | Generate ECC P-256 keypair           |
| POST   | `/api/crypto/derive-shared-key`   | ECDH shared key derivation           |
| POST   | `/api/crypto/encrypt`             | AES-256-GCM encrypt                  |
| POST   | `/api/crypto/decrypt`             | AES-256-GCM decrypt                  |
| POST   | `/api/crypto/split-key`           | Shamir k-of-n key split              |
| POST   | `/api/crypto/reconstruct-key`     | Shamir key reconstruction            |
| POST   | `/api/ipfs/upload`                | Upload file to IPFS via Pinata       |
| GET    | `/api/ipfs/exists/{cid}`          | Check IPFS pin exists                |
| POST   | `/api/blockchain/register`        | Register CID on-chain                |
| GET    | `/api/blockchain/record/{id}`     | Fetch on-chain record                |
| POST   | `/api/blockchain/verify`          | Verify Merkle proof                  |
| POST   | `/api/blockchain/revoke/{id}`     | Revoke record on-chain               |
| GET    | `/api/blockchain/stats`           | Contract statistics                  |
| GET    | `/api/graph/anomaly-scores`       | Run GAE anomaly detection            |
| GET    | `/api/graph/summary`              | Transaction graph summary            |
| GET    | `/api/graph/node-stats/{addr}`    | Per-node statistics                  |
| POST   | `/api/graph/flag-node`            | Manually flag a node                 |
| GET    | `/health`                         | Backend health check                 |

---

## Project Structure

```
stegochain/
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
├── .env.production
├── README.md
│
├── backend/
│   ├── app.py                          Flask factory
│   ├── config.py
│   ├── requirements.txt
│   ├── models/
│   │   ├── user.py
│   │   ├── transaction.py
│   │   └── keyshare.py
│   ├── modules/
│   │   ├── steganography/
│   │   │   ├── lsb_image.py            LSB embed/extract
│   │   │   └── echo_audio.py           Echo hiding
│   │   ├── crypto/
│   │   │   ├── aes_cipher.py           AES-256-GCM
│   │   │   ├── ecc_keys.py             ECC P-256
│   │   │   └── ecdsa_sign.py           ECDSA signing
│   │   ├── secret_sharing/
│   │   │   └── shamir.py               k-of-n Shamir
│   │   ├── ipfs/
│   │   │   └── pinata.py               Pinata upload/retrieve
│   │   ├── blockchain/
│   │   │   └── web3_client.py          Web3, Merkle, register/verify
│   │   └── graph_ai/
│   │       ├── __init__.py
│   │       └── anomaly.py              GCNEncoder, GAE, scoring
│   ├── routes/
│   │   ├── stego_routes.py
│   │   ├── crypto_routes.py
│   │   ├── ipfs_routes.py
│   │   ├── blockchain_routes.py
│   │   └── graph_routes.py
│   └── tests/
│       ├── test_routes.py              15 unit tests
│       └── test_graph.py              12 graph AI tests
│
├── blockchain/
│   ├── contracts/
│   │   └── StegoChain.sol
│   ├── scripts/
│   │   └── deploy.js
│   ├── artifacts/
│   │   └── contracts/StegoChain.sol/StegoChain.json
│   └── hardhat.config.js
│
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── styles/globals.css
│   ├── pages/
│   │   ├── _app.js
│   │   ├── index.js                    Landing page
│   │   ├── send.js                     4-step send wizard
│   │   ├── receive.js                  Decrypt message
│   │   ├── ledger.js                   Blockchain records
│   │   └── anomaly.js                  Graph anomaly dashboard
│   ├── components/
│   │   ├── Navbar.js
│   │   ├── UploadMedia.js
│   │   ├── MessageForm.js
│   │   └── LedgerTable.js
│   ├── utils/
│   │   └── api.js                      14 API functions
│   └── tests/
│       └── frontend.test.js            10 smoke tests
│
├── scripts/
│   └── deploy_contract.py              Python deploy helper
│
└── tests/
    └── integration_test.py             12 E2E integration tests
```

---

## Build Order (9 Prompts)

| Prompt | What Was Built |
|--------|----------------|
| 1 | LSB image steganography + Echo audio steganography |
| 2 | AES-256-GCM cipher + ECC P-256 keypairs + ECDSA signing |
| 3 | Shamir k-of-n secret sharing (prime field arithmetic) |
| 4 | Pinata IPFS upload/retrieve + metadata builder |
| 5 | Web3 client + Merkle tree + StegoChain.sol smart contract |
| 6 | Flask routes (stego, crypto, ipfs, blockchain) + MongoDB models + app.py |
| 7 | PyTorch Geometric Graph Autoencoder anomaly detection + graph routes |
| 8 | Next.js 14 frontend (5 pages, 4 components, 14 API functions) |
| 9 | Docker + docker-compose + deploy script + integration tests + README |

---

## Known Limitations

1. **Echo hiding capacity** — audio steganography capacity depends on file duration and sample rate. Short WAV files (<1s) may not have enough capacity for long messages.
2. **GAE stochasticity** — the anomaly detection model is stochastic. Low epoch counts (<100) may not rank high-degree spammers highest. Use `epochs=200+` for more stable results.
3. **Pinata pinning cost** — Pinata free tier limits file pinning. Large files or high volume may exhaust the free quota.
4. **Ganache determinism** — the Ganache private key in `.env.production` is publicly known. Replace with a real key before any public deployment.
5. **Single-edge graph guard** — graphs with fewer than 2 edges skip GAE training and return all anomaly scores as 0.0.
6. **Windows temp file locking** — Pillow/OpenCV may hold temporary file handles on Windows. The `_cleanup()` helper swallows `PermissionError` silently.


 -- -  -- -- - --- -  - - - - ---  -- -- - ---- - - - --- - -- -- -- - -- - -- -- - --- -- --- - -- 

**Your Full Startup Routine Every Session**

Every time you restart your computer or close terminals, run these in order:

**Terminal 1 — Start Hardhat node (keep this running)**
```powershell
cd "C:\Users\biswa\OneDrive\Desktop\Final Year Project\stegochain\blockchain"
npx hardhat node --port 7545
```
Wait until you see `Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:7545`

**Terminal 2 — Deploy contract (run once per session)**
```powershell
cd "C:\Users\biswa\OneDrive\Desktop\Final Year Project\stegochain"
python scripts/deploy_contract.py
```
Copy the printed CONTRACT_ADDRESS and update your `.env` if it changed. Since Hardhat resets state on every restart, the address will be the same deterministically as long as it is the first deployment.

**Terminal 3 — Start backend**
```powershell
cd "C:\Users\biswa\OneDrive\Desktop\Final Year Project\stegochain\backend"
python app.py
```

**Terminal 4 — Start frontend**
```powershell
cd "C:\Users\biswa\OneDrive\Desktop\Final Year Project\stegochain\frontend"
npm run dev
```

**Terminal 5 — Run integration test**
```powershell
cd "C:\Users\biswa\OneDrive\Desktop\Final Year Project\stegochain"
python tests/integration_test.py
```

---

**What To Expect From Integration Test Now**

With Hardhat node live, MongoDB Atlas connected, and Pinata keys real, your results should be:

```
Test I1  - Backend Health Check         : PASS
Test I2  - ECC Keypair Generation       : PASS
Test I3  - AES Encrypt/Decrypt          : PASS
Test I4  - Stego Embed/Extract Image    : PASS
Test I5  - Shamir Split/Reconstruct     : PASS  (Atlas connected)
Test I6  - IPFS Upload/Retrieve         : PASS  (Pinata keys set)
Test I7  - Blockchain Register/Verify   : PASS  (Hardhat node live)
Test I8  - Graph Summary                : PASS  (Atlas connected)
Test I9  - Full Send Pipeline           : PASS  (all services live)
Test I10 - Full Receive Pipeline        : PASS  (depends on I9)
Test I11 - Blockchain Revoke            : PASS  (Hardhat node live)
Test I12 - Graph Anomaly Scores         : PASS  (Atlas connected)
```

12/12. Paste the output here if anything fails and we fix it.


Or with Docker: ``` cd stegochain && docker-compose up --build```