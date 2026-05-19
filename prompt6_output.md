# Prompt 6 Output — Flask Routes + MongoDB Models + Complete app.py

## Session Date
2026-05-17

## What Was Built

| # | File | Status |
|---|------|--------|
| 1 | `stegochain/backend/models/user.py` | CREATED |
| 2 | `stegochain/backend/models/transaction.py` | CREATED |
| 3 | `stegochain/backend/models/__init__.py` | UPDATED |
| 4 | `stegochain/backend/routes/stego_routes.py` | CREATED |
| 5 | `stegochain/backend/routes/crypto_routes.py` | CREATED |
| 6 | `stegochain/backend/routes/ipfs_routes.py` | CREATED |
| 7 | `stegochain/backend/routes/blockchain_routes.py` | CREATED |
| 8 | `stegochain/backend/app.py` | REPLACED (complete) |
| 9 | `stegochain/backend/tests/test_routes.py` | CREATED (15/15 PASS) |
| 10 | `stegochain/prompt6_output.md` | CREATED (this file) |

---

## API Endpoint Reference

### Steganography Routes (`/api/stego`)

| Method | Path | Inputs | Output | Notes |
|--------|------|--------|--------|-------|
| POST | `/api/stego/embed` | `file` (multipart), `message`, `file_type` | `{ stego_file_path, file_type, capacity_used }` | Keeps stego file for `/encrypt` |
| POST | `/api/stego/extract` | `file` (multipart), `file_type` | `{ message, file_type }` | Returns 404 if no delimiter found |
| GET | `/api/stego/capacity` | `?file_type`, `?width`, `?height` (or `?duration`, `?sample_rate`) | `{ capacity_characters, file_type }` | No file upload needed |
| POST | `/api/stego/send` | `file`, `message`, `file_type`, `sender_id`, `receiver_id`, `receiver_eth_address`, `k`, `n`, `owner_ids` | `{ session_id, ipfs_cid, gateway_url, blockchain_record_id, tx_hash, merkle_root, shares_created, k, n }` | Full pipeline |
| POST | `/api/stego/receive` | JSON `{ session_id, owner_ids, file_type }` | `{ session_id, message, file_type, blockchain_verified, sender_id }` | Full reverse pipeline |

### Crypto Routes (`/api/crypto`)

| Method | Path | Inputs | Output | Notes |
|--------|------|--------|--------|-------|
| POST | `/api/crypto/generate-keypair` | None | `{ public_key, private_key, warning }` | ECC P-256 PEM |
| POST | `/api/crypto/encrypt` | JSON `{ message, aes_key_b64 }` | `{ ciphertext, nonce, tag }` | AES-256-GCM |
| POST | `/api/crypto/decrypt` | JSON `{ ciphertext, nonce, tag, aes_key_b64 }` | `{ message }` | Returns 400 on auth failure |
| POST | `/api/crypto/derive-shared-key` | JSON `{ private_key_pem, peer_public_key_pem }` | `{ shared_key_b64, key_length_bytes }` | ECDH, always 32 bytes |
| POST | `/api/crypto/split-key` | JSON `{ aes_key_b64, k, n, session_id, owner_ids }` | `{ session_id, shares_created, k, n, share_indices }` | Saves to MongoDB, does NOT return share data |
| POST | `/api/crypto/reconstruct-key` | JSON `{ session_id, owner_ids }` | `{ aes_key_b64, session_id }` | Fetches from MongoDB |

### IPFS Routes (`/api/ipfs`)

| Method | Path | Inputs | Output | Notes |
|--------|------|--------|--------|-------|
| POST | `/api/ipfs/upload` | `file`, `session_id`, `sender_id`, `receiver_id`, `file_type` | `{ cid, gateway_url, size, timestamp }` | Pinata upload with metadata |
| GET | `/api/ipfs/retrieve/<cid>` | Path param `cid` | Binary file download | `application/octet-stream`, filename `stegochain_{cid[:16]}.bin` |
| GET | `/api/ipfs/exists/<cid>` | Path param `cid` | `{ cid, exists }` | Never raises, returns false on error |
| GET | `/api/ipfs/list` | `?limit` (default 10, max 50) | `{ pins, count }` | Pinata pin list |

### Blockchain Routes (`/api/blockchain`)

| Method | Path | Inputs | Output | Notes |
|--------|------|--------|--------|-------|
| POST | `/api/blockchain/register` | JSON `{ cid, receiver_address, session_id, cids_in_session }` | `{ record_id, tx_hash, block_number, gas_used, merkle_root }` | Returns 503 if Ganache unreachable |
| GET | `/api/blockchain/record/<record_id>` | Path param `record_id` | Full StegoRecord dict | |
| GET | `/api/blockchain/record/cid/<cid>` | Path param `cid` | Full StegoRecord dict | |
| POST | `/api/blockchain/verify` | JSON `{ record_id, cid, merkle_root }` | `{ record_id, verified }` | |
| POST | `/api/blockchain/verify-proof` | JSON `{ cids_in_session, target_cid, root }` | `{ verified, proof }` | On-chain Merkle verification |
| POST | `/api/blockchain/revoke/<record_id>` | Path param `record_id` | `{ record_id, tx_hash, revoked }` | |
| GET | `/api/blockchain/stats` | None | `{ total_records, contract_owner }` | |
| GET | `/api/blockchain/sender/<address>` | Path param `address` | `{ sender, record_ids }` | |

### Error Response Format

All errors return:
```json
{ "error": "description of what went wrong", "status": <http_code> }
```

All successes include `"status": 200` in the JSON body.

---

## MongoDB Collections

### `users`

| Field | Type | Default | Description |
|---|---|---|---|
| `user_id` | `str` | `uuid4()` | Primary identifier |
| `username` | `str` | required | Display name |
| `eth_address` | `str` | required | Ethereum wallet address |
| `public_key_pem` | `str` | required | ECC P-256 public key PEM |
| `created_at` | `str` | UTC ISO now | Creation timestamp |
| `is_active` | `bool` | `True` | Soft-delete flag |

### `transactions`

| Field | Type | Default | Description |
|---|---|---|---|
| `session_id` | `str` | `uuid4()` | Primary key, links keyshares + blockchain |
| `sender_id` | `str` | required | `User.user_id` of sender |
| `receiver_id` | `str` | required | `User.user_id` of receiver |
| `sender_eth` | `str` | `""` | Sender Ethereum address |
| `receiver_eth` | `str` | `""` | Receiver Ethereum address |
| `file_type` | `str` | `"image"` | `"image"` or `"audio"` |
| `original_filename` | `str` | required | Original uploaded filename |
| `ipfs_cid` | `str` | `""` | IPFS CID returned by Pinata |
| `ipfs_gateway_url` | `str` | `""` | Full Pinata gateway URL |
| `nonce` | `str` | `""` | base64 AES-GCM nonce (from `encrypt_file`) |
| `tag` | `str` | `""` | base64 AES-GCM tag (from `encrypt_file`) |
| `merkle_root` | `str` | `""` | 0x hex Merkle root stored on blockchain |
| `blockchain_record_id` | `int` | `-1` | `recordId` from `registerRecord()` |
| `tx_hash` | `str` | `""` | Ethereum transaction hash |
| `block_number` | `int` | `-1` | Block number of inclusion |
| `k` | `int` | `3` | Shamir threshold |
| `n` | `int` | `5` | Total Shamir shares |
| `status` | `str` | `"pending"` | `pending / complete / failed / revoked` |
| `created_at` | `str` | UTC ISO now | Creation timestamp |
| `completed_at` | `str` | `None` | Set when status changes to `complete` |

### `keyshares`

| Field | Type | Description |
|---|---|---|
| `share_id` | `str` | `uuid4()` primary identifier |
| `share_index` | `int` | Shamir x-coordinate (1 to n) |
| `share_data` | `str` | base64-encoded (x, y) tuple |
| `k` | `int` | Threshold required to reconstruct |
| `n` | `int` | Total shares created |
| `checksum` | `str` | SHA-256 of original secret for verification |
| `owner_id` | `str` | User ID of the share holder |
| `session_id` | `str` | Links to transactions collection |
| `created_at` | `str` | UTC ISO timestamp |

---

## Data Flow: Full Send Pipeline (`POST /api/stego/send`)

```
1.  Generate session_id = uuid4()
2.  Generate AES-256 key (32 random bytes)
3.  Save uploaded cover file to temp path
4.  embed_message_in_image(cover, message) -> stego file
5.  encrypt_file(stego, aes_key) -> encrypted binary + { nonce, tag }
6.  build_ipfs_metadata(session_id, sender_id, receiver_id, file_type)
7.  upload_file_to_ipfs(encrypted_file, pinata_keys) -> { cid, gateway_url }
8.  build_merkle_tree([cid]) -> { root, leaves, tree }
9.  register_record(w3, contract, private_key, cid, receiver_eth, session_id, root)
    -> { record_id, tx_hash, block_number, gas_used }
10. split_secret(aes_key, k, n) -> list of { share_index, share_data, checksum }
11. For each share: KeyShare(...) -> MongoDB.keyshares.insert_one()
12. Transaction(status="complete", ...) -> MongoDB.transactions.insert_one()
13. Cleanup all temp files
14. Return { session_id, ipfs_cid, gateway_url, blockchain_record_id, tx_hash,
             merkle_root, shares_created, k, n }
```

**On any step failure:** `Transaction(status="failed")` is saved, all temp files cleaned up, returns 500 with `{ error, step }`.

---

## Data Flow: Full Receive Pipeline (`POST /api/stego/receive`)

```
1.  Fetch Transaction from MongoDB by session_id
    -> Returns 404 if not found
2.  verify_record(record_id, cid, merkle_root) on StegoChain contract
    -> Returns 403 if record is revoked/inactive
3.  Fetch k KeyShare docs from MongoDB by session_id + owner_ids
    -> Returns 400 if fewer than k shares available
4.  reconstruct_secret(k_shares) -> aes_key bytes
5.  retrieve_from_ipfs(ipfs_cid) -> encrypted bytes
6.  Write encrypted bytes to temp file
7.  decrypt_file(enc_path, aes_key, nonce, tag) -> decrypted stego file
8.  extract_message_from_image(stego_path) -> hidden message string
9.  Cleanup all temp files
10. Return { session_id, message, file_type, blockchain_verified, sender_id }
```

---

## Test Results (15/15 PASS)

```
==========================================
  FLASK ROUTES TEST SUITE
==========================================

--------------------------------------
 TEST 1 - Health Check
--------------------------------------
  [result] PASS - GET /health -> 200, status=ok, modules present

--------------------------------------
 TEST 2 - Stego Embed Image
--------------------------------------
  [result] PASS - POST /api/stego/embed -> 200, stego_file_path returned

--------------------------------------
 TEST 3 - Stego Extract Image
--------------------------------------
  [result] PASS - POST /api/stego/extract -> correct message extracted

--------------------------------------
 TEST 4 - Stego Capacity
--------------------------------------
  [result] PASS - GET /api/stego/capacity -> 3750 chars for 100x100 image

--------------------------------------
 TEST 5 - Crypto Keypair Generation
--------------------------------------
  [result] PASS - POST /api/crypto/generate-keypair -> PEM keys returned

--------------------------------------
 TEST 6 - Crypto Encrypt/Decrypt
--------------------------------------
  [result] PASS - POST /api/crypto/encrypt+decrypt -> round-trip correct

--------------------------------------
 TEST 7 - Crypto Derive Shared Key
--------------------------------------
  [result] PASS - POST /api/crypto/derive-shared-key -> 32-byte key

--------------------------------------
 TEST 8 - Crypto Split/Reconstruct Key
--------------------------------------
  [result] PASS - POST split-key(5) + reconstruct-key(3 owners) -> key matches

--------------------------------------
 TEST 9 - IPFS Upload (mocked Pinata)
--------------------------------------
  [result] PASS - POST /api/ipfs/upload -> cid and gateway_url returned

--------------------------------------
 TEST 10 - IPFS Exists (mocked)
--------------------------------------
  [result] PASS - GET /api/ipfs/exists/<cid> -> exists field present

--------------------------------------
 TEST 11 - Blockchain Register (mocked)
--------------------------------------
  [result] PASS - POST /api/blockchain/register -> record_id, tx_hash, merkle_root

--------------------------------------
 TEST 12 - Blockchain Verify (mocked)
--------------------------------------
  [result] PASS - POST /api/blockchain/verify -> verified field present

--------------------------------------
 TEST 13 - Blockchain Stats (mocked)
--------------------------------------
  [result] PASS - GET /api/blockchain/stats -> total_records and contract_owner

--------------------------------------
 TEST 14 - Full Send Pipeline (mocked)
--------------------------------------
  [result] PASS - POST /api/stego/send -> full pipeline, all fields present

--------------------------------------
 TEST 15 - Full Receive Pipeline (mocked)
--------------------------------------
  [result] PASS - POST /api/stego/receive -> message correctly extracted

==========================================
  FLASK ROUTES TEST RESULTS
  Test 1  - Health Check                 : PASS
  Test 2  - Stego Embed Image            : PASS
  Test 3  - Stego Extract Image          : PASS
  Test 4  - Stego Capacity               : PASS
  Test 5  - Crypto Keypair Generation    : PASS
  Test 6  - Crypto Encrypt/Decrypt       : PASS
  Test 7  - Crypto Derive Shared Key     : PASS
  Test 8  - Crypto Split/Reconstruct Key : PASS
  Test 9  - IPFS Upload                  : PASS
  Test 10 - IPFS Exists                  : PASS
  Test 11 - Blockchain Register          : PASS
  Test 12 - Blockchain Verify            : PASS
  Test 13 - Blockchain Stats             : PASS
  Test 14 - Full Send Pipeline           : PASS
  Test 15 - Full Receive Pipeline        : PASS
==========================================
```

---

## What Prompt 7 Must Know

- **Project root:** `stegochain/`
- **Backend root:** `stegochain/backend/`
- **All modules complete:** steganography, crypto, secret_sharing, ipfs, blockchain
- **All routes complete:** stego (`/api/stego`), crypto (`/api/crypto`), ipfs (`/api/ipfs`), blockchain (`/api/blockchain`)
- **All models complete:** `User`, `Transaction`, `KeyShare`
- **`app.py` is complete** — factory function `create_app()`, MongoDB via `current_app.db`
- **MongoDB collections:** `users`, `transactions`, `keyshares`
- **`session_id`** is a `uuid4()` string linking all three collections
- **Run backend:** `cd stegochain/backend && python app.py` (default port 5000)
- **Next module to build:** `backend/modules/graph_ai/anomaly.py`
- **Graph AI goal:** PyTorch Geometric anomaly detection for spam/fraud detection
- **Graph nodes:** Ethereum addresses (users)
- **Graph edges:** blockchain transactions (one directed edge per `registerRecord` call)
- **Edge features:** `timestamp`, `file_type`, `session_id` hash
- **Node features:** `num_sent`, `num_received`, `last_active_timestamp`
- **Anomaly definition:** node with unusually high out-degree in a short time window (sender spam)
- **Data source:** MongoDB `transactions` collection + contract `getSenderRecords`
- **PyTorch Geometric** version already in `requirements.txt`
- **Model type:** Graph Autoencoder (GAE) or GCN-based anomaly scorer
- **Output:** anomaly score per node (0.0–1.0), threshold at 0.7 → flagged
- **API route needed:** `GET /api/graph/anomaly-scores` and `POST /api/graph/flag-node`

---

## Known Issues

- **Blockchain routes fail gracefully** if Ganache is not running (returns 503)
- **IPFS routes fail gracefully** if Pinata credentials are missing (returns 400/502)
- **`_cleanup()` on Windows** silently ignores `PermissionError` when PIL still holds a file handle — files are left in `/tmp/stegochain/` and cleaned on next OS restart
- **Audio steganography** is gated behind `_AUDIO_AVAILABLE` flag — returns 501 if `echo_audio` module is not importable

---

## Files Not Yet Built

| File | Prompt |
|---|---|
| `backend/modules/graph_ai/__init__.py` | 7 |
| `backend/modules/graph_ai/anomaly.py` | 7 |
| `backend/routes/graph_routes.py` | 7 |
| `backend/tests/test_graph.py` | 7 |
| `frontend/pages/index.js` | 9 |
| `frontend/pages/send.js` | 9 |
| `frontend/pages/receive.js` | 9 |
| `frontend/pages/ledger.js` | 9 |
| `frontend/components/Navbar.js` | 9 |
| `frontend/components/UploadMedia.js` | 9 |
| `frontend/components/MessageForm.js` | 9 |
| `frontend/components/LedgerTable.js` | 9 |
| `frontend/utils/api.js` | 9 |
| `docker-compose.yml` | 10 |
| `Dockerfile.backend` | 10 |
