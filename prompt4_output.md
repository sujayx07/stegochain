# Prompt 4 Output — IPFS Integration via Pinata API

## Session Date
2026-05-17

## What Was Built

| # | File | Status |
|---|------|--------|
| 1 | `stegochain/backend/modules/ipfs/pinata.py` | CREATED (complete) |
| 2 | `stegochain/backend/modules/ipfs/__init__.py` | UPDATED (exports) |
| 3 | `stegochain/backend/tests/test_ipfs.py` | CREATED (all 8 tests pass) |
| 4 | `stegochain/prompt4_output.md` | CREATED (this file) |

---

## Module Function Reference

### pinata.py

- **upload_file_to_ipfs(file_path, pinata_api_key, pinata_secret_key, metadata=None) → dict**
  - Input: local file path, API credentials, optional metadata dict
  - Output: `{ cid, size, timestamp, file_name, gateway_url }`
  - Raises: `ConnectionError` on non-2xx Pinata response

- **upload_bytes_to_ipfs(data, file_name, pinata_api_key, pinata_secret_key, metadata=None) → dict**
  - Input: raw bytes, display filename, API credentials, optional metadata
  - Output: same dict as upload_file_to_ipfs
  - Raises: `ConnectionError` on non-2xx response
  - Note: writes bytes to a temp file internally; temp file is always cleaned up

- **retrieve_from_ipfs(cid, output_path=None) → bytes**
  - Input: IPFS CID string, optional output file path
  - Output: raw bytes of the file content
  - Side effect: if output_path provided, bytes are also written to that path
  - Raises: `ConnectionError` on non-2xx gateway response
  - Timeout: 30 seconds

- **pin_exists(cid, pinata_api_key, pinata_secret_key) → bool**
  - Input: CID string, API credentials
  - Output: `True` if pinned in account, `False` otherwise
  - Never raises — returns False on any error

- **unpin_from_ipfs(cid, pinata_api_key, pinata_secret_key) → bool**
  - Input: CID string, API credentials
  - Output: `True` on success (HTTP 200), `False` otherwise
  - Never raises

- **get_pin_list(pinata_api_key, pinata_secret_key, limit=10) → list[dict]**
  - Input: API credentials, optional page limit
  - Output: list of `{ cid, size, timestamp, file_name }` dicts
  - Returns empty list on any error

- **build_ipfs_metadata(session_id, sender_id, receiver_id, file_type) → dict**
  - Input: session/sender/receiver identifiers, file type string ("image" or "audio")
  - Output: `{ "name": "stegochain_{session_id}", "keyvalues": { session_id, sender_id, receiver_id, file_type, app } }`
  - Never raises

---

## API Endpoints Used

| Method | URL | Purpose |
|--------|-----|---------|
| POST | `https://api.pinata.cloud/pinning/pinFileToIPFS` | Upload file to IPFS |
| GET | `https://gateway.pinata.cloud/ipfs/{CID}` | Retrieve file by CID |
| GET | `https://api.pinata.cloud/pinning/pinList?hashContains={cid}` | Check if pin exists |
| GET | `https://api.pinata.cloud/pinning/pinList?pageLimit={limit}` | List all pinned files |
| DELETE | `https://api.pinata.cloud/pinning/unpin/{CID}` | Remove a pin |

Authentication: all Pinata API calls use headers `pinata_api_key` + `pinata_secret_api_key`.

---

## Data Formats

- **Upload return dict**: `{ cid: str, size: int, timestamp: str, file_name: str, gateway_url: str }`
- **Pin list item**: `{ cid: str, size: int, timestamp: str, file_name: str }`
- **Metadata format**: `{ name: str, keyvalues: { session_id, sender_id, receiver_id, file_type, app } }`

---

## Test Mode Detection

The test suite auto-detects which mode to use:

| Condition | Mode |
|---|---|
| `PINATA_API_KEY` env var is set and not the placeholder | **LIVE** — real Pinata API calls |
| Key missing or equals `"your_pinata_api_key_here"` | **MOCKED** — `unittest.mock.patch` replaces all HTTP calls |

To run in LIVE mode:
```
set PINATA_API_KEY=your_real_key
set PINATA_SECRET_KEY=your_real_secret
python backend/tests/test_ipfs.py
```

---

## Integration Notes

- `encrypt_file()` output path is passed directly to `upload_file_to_ipfs()` as `file_path`
- Returned `cid` and `gateway_url` are stored in the MongoDB Transaction document (built in Prompt 6)
- `nonce` and `tag` from `encrypt_file()` are stored alongside the CID in MongoDB — required for decryption
- `retrieve_from_ipfs(cid)` returns bytes that are written to a temp file, then passed to `decrypt_file()`
- `build_ipfs_metadata()` is called before every upload to tag files with session and user info
- `session_id` in IPFS metadata links the IPFS CID to the corresponding Shamir shares in MongoDB

---

## Test Results

```
==========================================
  IPFS MODULE TEST SUITE
  Mode: MOCKED
  (Set PINATA_API_KEY env var to run in LIVE mode)
==========================================

--------------------------------------
 TEST 1 - build_ipfs_metadata
--------------------------------------
  [info] Returned: {'name': 'stegochain_sess_001', 'keyvalues': {'session_id': 'sess_001',
         'sender_id': 'alice', 'receiver_id': 'bob', 'file_type': 'image', 'app': 'stegochain'}}
  [result] PASS - build_ipfs_metadata returns correct structure

--------------------------------------
 TEST 2 - upload_file_to_ipfs
--------------------------------------
  [setup] Created test PNG: ...test_upload_img.png
  [info] Result: {'cid': 'QmTestCIDStegoChain1234567890abcdefghijklmnopqr', 'size': 1234,
         'timestamp': '2026-05-17T00:00:00.000Z', 'file_name': 'test_upload_img.png',
         'gateway_url': 'https://gateway.pinata.cloud/ipfs/QmTestCIDStegoChain...'}
  [info] CID: QmTestCIDStegoChain1234567890abcdefghijklmnopqr
  [result] PASS - upload_file_to_ipfs returned correct dict with valid CID
  [cleanup] Temp PNG removed

--------------------------------------
 TEST 3 - upload_bytes_to_ipfs
--------------------------------------
  [info] Uploading 256 random bytes
  [result] PASS - upload_bytes_to_ipfs returned correct dict

--------------------------------------
 TEST 4 - retrieve_from_ipfs
--------------------------------------
  [info] Retrieved 378 bytes from CID QmTestCIDStegoChain1...
  [result] PASS - retrieve_from_ipfs returned bytes and saved to file

--------------------------------------
 TEST 5 - pin_exists
--------------------------------------
  [info] pin_exists(QmTestCIDStegoChain1...) = True
  [info] pin_exists(fake_cid)    = False
  [result] PASS - pin_exists correctly identifies existing and non-existing pins

--------------------------------------
 TEST 6 - get_pin_list
--------------------------------------
  [info] Returned 1 pins
  [info] First pin: {'cid': 'QmTestCIDStegoChain...', 'size': 1234, ...}
  [result] PASS - get_pin_list returned list with correct structure

--------------------------------------
 TEST 7 - Full Encrypt+Upload+Retrieve Pipeline
--------------------------------------
  [step 1] Created 50x50 source image
  [step 2] Embedded message into stego image
  [step 3] Encrypted stego image -> ...t7_encrypted.bin
  [step 4] Uploaded to IPFS, CID: QmTestCIDStegoChain1...
  [step 5] Built metadata: stegochain_sess_pipeline
  [step 6] Retrieved 7618 bytes from IPFS
  [step 7] Decrypted to image file
  [step 8] Extracted message: "IPFS pipeline test"
  [result] PASS - Full pipeline: stego -> encrypt -> IPFS -> retrieve -> decrypt -> extract
  [cleanup] All temp files removed

--------------------------------------
 TEST 8 - unpin_from_ipfs
--------------------------------------
  [info] unpin_from_ipfs(QmTestCIDStegoChain1...) = True
  [result] PASS - unpin_from_ipfs returned True

==========================================
  IPFS MODULE TEST RESULTS
  Mode: MOCKED
  Test 1 - build_ipfs_metadata          : PASS
  Test 2 - upload_file_to_ipfs          : PASS
  Test 3 - upload_bytes_to_ipfs         : PASS
  Test 4 - retrieve_from_ipfs           : PASS
  Test 5 - pin_exists                   : PASS
  Test 6 - get_pin_list                 : PASS
  Test 7 - Full Encrypt+Upload+Retrieve : PASS
  Test 8 - unpin_from_ipfs              : PASS
==========================================
```

---

## What Prompt 5 Must Know

- Project root: `stegochain/`
- Backend root: `stegochain/backend/`
- Steganography module: `backend/modules/steganography/` — COMPLETE
- Crypto module: `backend/modules/crypto/` — COMPLETE
- Secret sharing module: `backend/modules/secret_sharing/` — COMPLETE
- IPFS module: `backend/modules/ipfs/` — COMPLETE
- KeyShare model: `backend/models/keyshare.py` — COMPLETE
- IPFS upload returns: `{ cid, size, timestamp, file_name, gateway_url }`
- `nonce` and `tag` (base64 strings) must be stored with CID for later decryption
- **Next module to build:** Solidity smart contract + Hardhat config + Web3.py client
- Smart contract lives at: `blockchain/contracts/StegoChain.sol`
- Hardhat config lives at: `blockchain/hardhat.config.js`
- Web3 client lives at: `backend/modules/blockchain/web3_client.py`
- Ganache URL from `.env`: `GANACHE_URL=http://127.0.0.1:7545`
- Contract address stored in `.env`: `CONTRACT_ADDRESS` (filled after deployment)
- Private key for signing txns: `PRIVATE_KEY` from `.env`
- The smart contract must store: CID, sender address, receiver address, session_id, merkle root, timestamp
- Merkle tree is built from the CIDs of all messages in a session — root stored on chain

---

## Known Issues

- Tests run in **MOCKED** mode without real Pinata credentials. All function logic is fully exercised through realistic mock responses. Live mode is activated by setting `PINATA_API_KEY` environment variable.
- In LIVE mode, Test 4 (retrieve) may take up to 30 seconds for IPFS propagation after a fresh upload — this is expected gateway latency.

---

## Files Not Yet Built (Placeholders Remaining)

- `backend/modules/blockchain/web3_client.py` — Prompt 5
- `backend/modules/graph_ai/anomaly.py` — Prompt 7
- `backend/routes/stego_routes.py` — Prompt 6
- `backend/routes/crypto_routes.py` — Prompt 6
- `backend/routes/ipfs_routes.py` — Prompt 6
- `backend/routes/blockchain_routes.py` — Prompt 6
- `backend/models/user.py` — Prompt 6
- `backend/models/transaction.py` — Prompt 6
- `backend/tests/test_blockchain.py` — Prompt 5
- `blockchain/contracts/StegoChain.sol` — Prompt 5
- `blockchain/scripts/deploy.js` — Prompt 5
- `blockchain/test/StegoChain.test.js` — Prompt 5
- `frontend/pages/index.js` — Prompt 6
- `frontend/pages/send.js` — Prompt 6
- `frontend/pages/receive.js` — Prompt 6
- `frontend/pages/ledger.js` — Prompt 6
- `frontend/components/Navbar.js` — Prompt 6
- `frontend/components/UploadMedia.js` — Prompt 6
- `frontend/components/MessageForm.js` — Prompt 6
- `frontend/components/LedgerTable.js` — Prompt 6
- `frontend/utils/api.js` — Prompt 6
