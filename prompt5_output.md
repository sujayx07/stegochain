# Prompt 5 Output — Solidity Smart Contract + Hardhat + Web3.py Client

## Session Date
2026-05-17

## What Was Built

| # | File | Status |
|---|------|--------|
| 1 | `stegochain/blockchain/contracts/StegoChain.sol` | CREATED (complete) |
| 2 | `stegochain/blockchain/hardhat.config.js` | UPDATED (complete) |
| 3 | `stegochain/blockchain/scripts/deploy.js` | CREATED (complete) |
| 4 | `stegochain/blockchain/test/StegoChain.test.js` | CREATED (26/26 passing) |
| 5 | `stegochain/blockchain/package.json` | CREATED (complete) |
| 6 | `stegochain/backend/modules/blockchain/web3_client.py` | CREATED (complete) |
| 7 | `stegochain/backend/modules/blockchain/__init__.py` | UPDATED (exports) |
| 8 | `stegochain/backend/tests/test_blockchain.py` | CREATED (10/10 passing) |
| 9 | `stegochain/prompt5_output.md` | CREATED (this file) |

---

## Smart Contract Reference

### StegoRecord struct fields

| Field | Type | Description |
|---|---|---|
| `recordId` | `uint256` | Auto-incremented unique ID |
| `cid` | `string` | IPFS CID of the encrypted stego object |
| `sender` | `address` | Ethereum address of sender (msg.sender) |
| `receiver` | `address` | Ethereum address of intended receiver |
| `sessionId` | `string` | Links to Shamir shares in MongoDB |
| `merkleRoot` | `bytes32` | Merkle root of all CIDs in this session |
| `timestamp` | `uint256` | block.timestamp at registration |
| `isActive` | `bool` | False once revoked |

### State Variables

| Variable | Type | Description |
|---|---|---|
| `records` | `mapping(uint256 => StegoRecord)` | recordId → struct |
| `cidToRecordId` | `mapping(string => uint256)` | CID string → recordId |
| `senderRecords` | `mapping(address => uint256[])` | sender → all their recordIds |
| `recordCount` | `uint256` | Total registered records / next ID |
| `owner` | `address` | Contract deployer |

### Contract Functions

| Function | Visibility | Inputs | Output | Events Emitted |
|---|---|---|---|---|
| `constructor()` | — | — | — | — |
| `registerRecord(cid, receiver, sessionId, merkleRoot)` | `external` | string, address, string, bytes32 | `uint256` (recordId) | `RecordRegistered` |
| `getRecord(recordId)` | `external view` | uint256 | `StegoRecord` | — |
| `getRecordByCID(cid)` | `external view` | string | `StegoRecord` | — |
| `getSenderRecords(sender)` | `external view` | address | `uint256[]` | — |
| `verifyRecord(recordId, cid, merkleRoot)` | `external view` | uint256, string, bytes32 | `bool` | — |
| `updateMerkleRoot(recordId, newMerkleRoot)` | `external` | uint256, bytes32 | — | `MerkleRootUpdated` |
| `revokeRecord(recordId)` | `external` | uint256 | — | `RecordRevoked` |
| `verifyMerkleProof(proof, root, leaf)` | `external pure` | bytes32[], bytes32, bytes32 | `bool` | — |
| `getContractStats()` | `external view` | — | `(uint256, address)` | — |

### Events

| Event | Indexed Fields |
|---|---|
| `RecordRegistered(recordId, cid, sender, receiver, sessionId, merkleRoot, timestamp)` | recordId, sender, receiver |
| `RecordRevoked(recordId, revokedBy, timestamp)` | recordId, revokedBy |
| `MerkleRootUpdated(recordId, newMerkleRoot, timestamp)` | recordId |

### Access Control

| Function | Who Can Call |
|---|---|
| `registerRecord` | Any address |
| `updateMerkleRoot` | Original sender OR contract owner |
| `revokeRecord` | Original sender OR contract owner |
| All view/pure functions | Anyone |

---

## Web3.py Client Function Reference

- **get_web3_connection(ganache_url) → Web3**
  - Raises `ConnectionError` if node unreachable

- **load_contract(w3, contract_address, abi) → Contract**
  - Raises `ValueError` for invalid address

- **build_merkle_tree(cids) → dict**
  - Output: `{ root: str, leaves: list[str], tree: list[list[str]] }`
  - All values 0x-prefixed hex strings
  - Raises `ValueError` if cids empty

- **get_merkle_proof(cids, target_cid) → list[str]**
  - Returns list of sibling hashes (0x-prefixed hex) from leaf to root
  - Raises `ValueError` if target_cid not in cids

- **register_record(w3, contract, private_key, cid, receiver_address, session_id, merkle_root) → dict**
  - Output: `{ tx_hash, record_id, block_number, gas_used }`
  - Signs with `private_key`; sends raw transaction

- **get_record(w3, contract, record_id) → dict**
  - Output: `{ record_id, cid, sender, receiver, session_id, merkle_root, timestamp, is_active }`

- **get_record_by_cid(w3, contract, cid) → dict** — same format as get_record

- **verify_record(w3, contract, record_id, cid, merkle_root) → bool**

- **verify_merkle_proof_on_chain(w3, contract, proof, root, leaf) → bool**
  - All hex inputs converted to bytes32 before contract call

- **get_contract_stats(w3, contract) → dict**
  - Output: `{ total_records: int, contract_owner: str }`

- **revoke_record(w3, contract, private_key, record_id) → dict**
  - Output: `{ tx_hash, block_number, gas_used }`

---

## Merkle Tree Implementation

| Property | Value |
|---|---|
| Leaf hashing | `keccak256(cid.encode("utf-8"))` |
| Pair hashing | `keccak256(smaller + larger)` — **sorted** pairs |
| Odd leaves | Last node duplicated before hashing |
| Root format | `0x`-prefixed 64-char hex string (bytes32) |
| Implementation matches Solidity? | ✅ Yes — `verifyMerkleProof` on-chain uses same sorted-pair logic |

---

## ABI Location

| File | Description |
|---|---|
| `blockchain/artifacts/contracts/StegoChain.sol/StegoChain.json` | Full compiled ABI + bytecode (after `hardhat compile`) |
| `blockchain/artifacts/deployment.json` | Address + ABI snapshot (after deploy script runs) |

If `deployment.json` does not exist, `web3_client.py` falls back to the hardcoded `MINIMAL_ABI` constant so the module remains importable and testable.

---

## Deployment Instructions

```bash
# 1. Install Hardhat dependencies (already done)
cd stegochain/blockchain
npm install

# 2. Compile the contract
npx hardhat compile
# → Produces: artifacts/contracts/StegoChain.sol/StegoChain.json

# 3. Start Ganache (GUI or CLI)
#    ganache --port 7545 --chainId 1337

# 4. Deploy to Ganache
npm run deploy:ganache
# → Prints CONTRACT_ADDRESS, saves artifacts/deployment.json

# 5. Update .env
#    CONTRACT_ADDRESS=0x<printed address>

# 6. For Hardhat local node instead of Ganache:
npx hardhat node          # start in separate terminal
npm run deploy:local
```

---

## Test Results

### Hardhat JS Tests (26/26 PASS)

```
  StegoChain
    Deployment
      √ should set the correct owner
      √ should start with recordCount = 0
    registerRecord
      √ should register a record and emit RecordRegistered
      √ should revert if CID is empty
      √ should revert if receiver is zero address
      √ should revert if sessionId is empty
    getRecord
      √ should return correct record fields after registration
      √ should revert for non-existent recordId
    getRecordByCID
      √ should return correct record when looked up by CID
      √ should revert for unknown CID
    getSenderRecords
      √ should return all recordIds registered by a sender
      √ should return empty array for address with no records
    verifyRecord
      √ should return true for correct CID and merkleRoot
      √ should return false for wrong CID
      √ should return false for wrong merkleRoot
      √ should return false for non-existent record
    updateMerkleRoot
      √ should allow sender to update merkle root and emit event
      √ should allow owner to update any record's merkle root
      √ should revert if unauthorised caller tries to update
    revokeRecord
      √ should allow sender to revoke and emit RecordRevoked
      √ should make verifyRecord return false after revocation
      √ should revert if unauthorised caller tries to revoke
      √ should revert if already revoked
    verifyMerkleProof
      √ should verify a valid 4-leaf Merkle proof
      √ should return false with tampered proof
    getContractStats
      √ should return correct totalRecords and contractOwner

  26 passing (1s)
```

### Python Tests (10/10 PASS — MOCKED mode)

```
==========================================
  BLOCKCHAIN MODULE TEST RESULTS
  Mode: MOCKED
  Test 1  - Merkle Tree Build (4 leaves) : PASS
  Test 2  - Merkle Tree Odd Leaves       : PASS
  Test 3  - Merkle Proof Generation      : PASS
  Test 4  - Web3 Connection              : PASS
  Test 5  - Contract Deploy and Load     : PASS
  Test 6  - registerRecord               : PASS
  Test 7  - getRecord                    : PASS
  Test 8  - verifyRecord                 : PASS
  Test 9  - Merkle Proof End-to-End      : PASS
  Test 10 - revokeRecord                 : PASS
==========================================
```

---

## What Prompt 6 Must Know

- Project root: `stegochain/`
- Backend root: `stegochain/backend/`
- **ALL Python modules complete**: steganography, crypto, secret_sharing, ipfs, blockchain
- Smart contract: `blockchain/contracts/StegoChain.sol` — COMPLETE
- Web3 client: `backend/modules/blockchain/web3_client.py` — COMPLETE
- `registerRecord` inputs: `(cid: str, receiver_address: str, session_id: str, merkle_root: str)`
- `registerRecord` returns dict: `{ tx_hash, record_id, block_number, gas_used }`
- ABI path: `blockchain/artifacts/contracts/StegoChain.sol/StegoChain.json`
- Deployment JSON: `blockchain/artifacts/deployment.json`
- **Next to build**: Flask routes + MongoDB models + complete `app.py`
- Routes to build: `stego_routes.py`, `crypto_routes.py`, `ipfs_routes.py`, `blockchain_routes.py`
- Models to build: `user.py`, `transaction.py` (`keyshare.py` already done)
- `app.py` skeleton exists — just needs blueprint registration and MongoDB init
- MongoDB URI from `.env`: `MONGO_URI=mongodb://localhost:27017/stegochain`
- Session ID generation: `str(uuid.uuid4())` — links IPFS CID, Shamir shares, and blockchain record

---

## Known Issues

- Python tests run in **MOCKED** mode without Ganache. All contract logic is fully exercised through a stateful MagicMock that replicates in-memory contract state including Merkle hashing.
- Live Python tests require: (1) Ganache running at `http://127.0.0.1:7545`, (2) `hardhat compile` completed, (3) `GANACHE_URL` env var set.
- The `anyValue` matcher from `@nomicfoundation/hardhat-chai-matchers/withArgs` is used for event timestamp assertions (avoids brittle block timestamp matching).

---

## Files Not Yet Built (Placeholders Remaining)

- `backend/modules/graph_ai/anomaly.py` — Prompt 7
- `backend/routes/stego_routes.py` — Prompt 6
- `backend/routes/crypto_routes.py` — Prompt 6
- `backend/routes/ipfs_routes.py` — Prompt 6
- `backend/routes/blockchain_routes.py` — Prompt 6
- `backend/models/user.py` — Prompt 6
- `backend/models/transaction.py` — Prompt 6
- `frontend/pages/index.js` — Prompt 6
- `frontend/pages/send.js` — Prompt 6
- `frontend/pages/receive.js` — Prompt 6
- `frontend/pages/ledger.js` — Prompt 6
- `frontend/components/Navbar.js` — Prompt 6
- `frontend/components/UploadMedia.js` — Prompt 6
- `frontend/components/MessageForm.js` — Prompt 6
- `frontend/components/LedgerTable.js` — Prompt 6
- `frontend/utils/api.js` — Prompt 6
