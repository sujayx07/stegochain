# Prompt A Output — StegoChainV2 Smart Contract + Base Sepolia Deployment

## Session Date
2026-05-19

## Contract Details
- **Address:** `0xa33fE3cee390910f8832134De02f7DC9bf473AfF`
- **Network:** Base Sepolia (chainId 84532)
- **Basescan URL:** https://sepolia.basescan.org/address/0xa33fE3cee390910f8832134De02f7DC9bf473AfF
- **Transaction hash:** `0x30b07292331b91d34438d20d3bac7577bb894a9edd0dd890ad2a71bc41c1173c`
- **Deployer:** `0x867E78c6965a5040caFFf2A9Bd85e48810e8fC2F`

---

## What Was Built

| File | Description |
|---|---|
| `blockchain/contracts/StegoChainV2.sol` | New Solidity 0.8.19 contract — on-chain Merkle proof + ECDSA signature authorisation |
| `blockchain/hardhat.config.js` | Updated: Base Sepolia network, Basescan etherscan config, Solidity 0.8.19 optimizer |
| `blockchain/scripts/deployV2.js` | Deploy script — saves ABI + address to `blockchain/artifacts/deployment.json` |
| `blockchain/scripts/verifyContract.js` | Basescan source verification script |
| `blockchain/test/StegoChainV2.test.js` | 27-test Hardhat suite (all 53 total passing) |
| `blockchain/package.json` | Updated scripts: `deploy:local`, `deploy:baseSepolia`, `verify:baseSepolia` |

---

## Contract Function Reference

### `registerUser(bytes publicKeyX, bytes publicKeyY)`
- Registers caller's ECC P-256 public key on-chain
- Reverts if already registered or if either key coordinate is empty
- **Event:** `UserRegistered(address indexed user, uint256 timestamp)`

### `getUser(address userAddress) → UserProfile`
- Returns the stored `UserProfile` for any address

### `registerRecord(string ipfsCID, string[] fragmentCIDs, address receiver, string sessionId, bytes32 merkleRoot, bytes32 mediaHash, uint8 totalFragments) → uint256`
- Caller (sender) and receiver must both be registered
- Validates all inputs non-empty; sessionId must be unique
- Stores `StegoRecord` on-chain with all metadata
- **Returns:** new `recordId`
- **Event:** `RecordRegistered(uint256 indexed recordId, address indexed sender, address indexed receiver, string sessionId, bytes32 merkleRoot, uint256 timestamp)`

### `requestDecryption(uint256 recordId, bytes32[] merkleProof, bytes32 leafHash, bytes signature, bytes32 challengeHash)`
- **Merkle check:** `verifyMerkleProof(merkleProof, record.merkleRoot, leafHash)` must return `true`
- **ECDSA check:** `ecrecover(ethSignedHash, v, r, s)` must equal `msg.sender`
- Reverts with specific messages on any failure
- **Event:** `DecryptionAuthorised(uint256 indexed recordId, address indexed receiver, uint256 timestamp)`

### `verifyMerkleProof(bytes32[] proof, bytes32 root, bytes32 leaf) → bool`
- Standard sorted-pair Merkle tree verification
- Pure function, callable off-chain or from other contracts

### `getRecord(uint256 recordId) → StegoRecord`
- Reverts for non-existent record

### `getRecordBySession(string sessionId) → StegoRecord`
- Looks up record by unique session ID string

### `getReceiverRecords(address receiver) → uint256[]`
- Returns all record IDs where this address is the receiver

### `getSenderRecords(address sender) → uint256[]`
- Returns all record IDs where this address is the sender

### `revokeRecord(uint256 recordId)`
- Only sender or contract owner can call
- Sets `isActive = false`; `requestDecryption` will revert afterward
- **Event:** `RecordRevoked(uint256 indexed recordId, address indexed revokedBy, uint256 timestamp)`

### `verifyMediaIntegrity(uint256 recordId, bytes32 mediaHash) → bool`
- Returns `true` if stored `mediaHash` matches provided hash

### `getContractStats() → (uint256 totalRecords, uint256 totalUsers, address contractOwner)`

---

## Key Architecture Change From V1

| | V1 | V2 |
|---|---|---|
| **Key storage** | Shamir shares in MongoDB | AES key fragments hashed into Merkle tree, stored on-chain |
| **Authorisation** | k-of-n users click Approve buttons in UI | Receiver submits ECDSA signature + Merkle proof to smart contract |
| **Human approval** | Required | **None — fully on-chain cryptographic proof** |
| **Decryption trigger** | Backend polls DB for approval count | Backend listens for `DecryptionAuthorised` event |
| **Privacy** | Fragments in DB (centralised) | Fragment CIDs on IPFS, Merkle root on-chain |

---

## ABI Location

`blockchain/artifacts/deployment.json`

---

## Test Results

```
  StegoChain (V1 — kept green)
    √ should set the correct owner
    √ should start with recordCount = 0
    √ should register a record and emit RecordRegistered
    √ should revert if CID is empty
    √ should revert if receiver is zero address
    √ should revert if sessionId is empty
    √ should return correct record fields after registration
    √ should revert for non-existent recordId
    √ should return correct record when looked up by CID
    √ should revert for unknown CID
    √ should return all recordIds registered by a sender
    √ should return empty array for address with no records
    √ should return true for correct CID and merkleRoot
    √ should return false for wrong CID
    √ should return false for wrong merkleRoot
    √ should return false for non-existent record
    √ should allow sender to update merkle root and emit event
    √ should allow owner to update any record's merkle root
    √ should revert if unauthorised caller tries to update
    √ should allow sender to revoke and emit RecordRevoked
    √ should make verifyRecord return false after revocation
    √ should revert if unauthorised caller tries to revoke
    √ should revert if already revoked
    √ should verify a valid 4-leaf Merkle proof
    √ should return false with tampered proof
    √ should return correct totalRecords and contractOwner

  StegoChainV2 (27 new tests)
    √ 1. Deployment sets owner correctly
    √ 2. registerUser stores public key correctly
    √ 3. registerUser emits UserRegistered event
    √ 4. registerUser reverts on duplicate registration
    √ 5. registerUser reverts when publicKeyX is empty
    √ 6. registerRecord requires sender to be registered
    √ 7. registerRecord requires receiver to be registered
    √ 8. registerRecord stores all fields correctly
    √ 9. registerRecord emits RecordRegistered event
    √ 10. registerRecord increments recordCount
    √ 11. requestDecryption with valid proof emits DecryptionAuthorised
    √ 12. requestDecryption reverts for wrong receiver
    √ 13. requestDecryption reverts for invalid Merkle proof
    √ 14. requestDecryption reverts for invalid signature
    √ 15. requestDecryption reverts on non-existent record
    √ 16. verifyMerkleProof returns true for valid proof
    √ 17. verifyMerkleProof returns false for tampered proof
    √ 18. verifyMediaIntegrity returns true for matching hash
    √ 19. verifyMediaIntegrity returns false for wrong hash
    √ 20. revokeRecord sets isActive to false
    √ 21. revokeRecord emits RecordRevoked event
    √ 22. revokeRecord prevents decryption after revocation
    √ 23. revokeRecord reverts for unauthorised caller
    √ 24. revokeRecord can be called by contract owner
    √ 25. getContractStats returns correct counts
    √ 26. getSenderRecords and getReceiverRecords return correct IDs
    √ 27. getRecordBySession returns the correct record

  53 passing (2s)
```

---

## What Prompt B Must Know

- **Contract address:** `0xa33fE3cee390910f8832134De02f7DC9bf473AfF`
- **Network:** Base Sepolia, chainId 84532
- **RPC URL:** `https://sepolia.base.org` (stored in `.env.production` as `BASE_SEPOLIA_RPC_URL`)
- **Deployer / owner wallet:** `0x867E78c6965a5040caFFf2A9Bd85e48810e8fC2F`
- **ABI:** `blockchain/artifacts/deployment.json`

### New contract functions the Flask backend must call

| Function | When |
|---|---|
| `registerUser(pkX, pkY)` | User registration — stores ECC P-256 public key on-chain |
| `registerRecord(...)` | Sender embeds message — stores Merkle root + fragment CIDs + media hash |
| `requestDecryption(...)` | Receiver requests access — verified on-chain, emits event |
| `verifyMerkleProof(...)` | Optional off-chain cross-check |
| `verifyMediaIntegrity(...)` | Verify downloaded IPFS file was not tampered with |

### Event backend must listen for
- `DecryptionAuthorised(recordId, receiver, timestamp)` — backend returns IPFS fragment CIDs to frontend on receipt of this event

### Fragment CIDs
- Stored in `StegoRecord.fragmentCIDs[]` on-chain — fetch via `getRecord(recordId)`
- Frontend assembles fragments → reconstructs AES key → decrypts stego payload

### Media file
- `StegoRecord.ipfsCID` holds encrypted stego media CID on IPFS
- **Must be returned to frontend on receive** (not just the text message)

### JWT auth
- Keep existing `register` and `login` Flask routes
- All protected routes require JWT Bearer token

### Routes to keep
- `POST /stego/embed`, `POST /stego/extract`
- `POST /crypto/encrypt`, `POST /crypto/decrypt`
- `POST /ipfs/upload`, `GET /ipfs/retrieve/<cid>`

### Routes to replace with V2 equivalents
- `POST /blockchain/register` → now calls `registerRecord(...)` on `StegoChainV2`
- New route: `POST /blockchain/request-decryption` → calls `requestDecryption(...)` then listens for `DecryptionAuthorised` event

### Routes to REMOVE entirely
- All Shamir split/reconstruct routes (replaced by on-chain Merkle system)
- All MongoDB keyshares routes
- All guardian approval routes
