# Prompt 3 Output — Shamir's Secret Sharing + KeyShare Model

## Session Date
2026-05-17

## What Was Built

| # | File | Status |
|---|------|--------|
| 1 | `stegochain/backend/modules/secret_sharing/shamir.py` | CREATED (complete) |
| 2 | `stegochain/backend/models/keyshare.py` | UPDATED (complete) |
| 3 | `stegochain/backend/modules/secret_sharing/__init__.py` | UPDATED (exports) |
| 4 | `stegochain/backend/tests/test_shamir.py` | CREATED (all 9 tests pass) |
| 5 | `stegochain/prompt3_output.md` | CREATED (this file) |

---

## Module Function Reference

### shamir.py

- **split_secret(secret: bytes, k: int, n: int) → list[dict]**
  - Input: raw bytes secret (up to 32 bytes), threshold k (≥2), total shares n (≥k, ≤255)
  - Output: list of n share dicts: `{ share_index: int, share_data: str(b64), k: int, n: int, checksum: str(hex64) }`
  - Raises: `ValueError` if parameters are invalid (k<2, n<k, n>255, secret too long)

- **reconstruct_secret(shares: list[dict]) → bytes**
  - Input: list of at least k share dicts (format from split_secret)
  - Output: original secret as raw bytes
  - Raises: `ValueError` if fewer than k shares, inconsistent shares, checksum mismatch, or malformed share_data

- **verify_share(share: dict) → bool**
  - Input: single share dict
  - Output: `True` if all required keys present and values sane, `False` otherwise — never raises

- **get_share_info(share: dict) → dict**
  - Input: single share dict
  - Output: `{ share_index: int, total_shares: int, threshold: int, is_valid: bool }`

### keyshare.py — KeyShare class

- **KeyShare(share_index, share_data, k, n, checksum, owner_id, session_id, created_at=None)**
  - Constructor: creates a KeyShare from individual fields; auto-fills `created_at` as UTC ISO timestamp if not provided

- **to_dict() → dict**
  - Returns a MongoDB-ready dict with all 8 fields

- **from_dict(data: dict) → KeyShare** (classmethod)
  - Creates a KeyShare from a MongoDB document dict

- **to_share_dict() → dict**
  - Returns exactly `{ share_index, share_data, k, n, checksum }` — the dict format expected by `reconstruct_secret()`

---

## Implementation Details

| Parameter | Value | Reason |
|---|---|---|
| Field prime | `2^256 + 297` | Larger than any 256-bit value; AES keys fit directly as single field elements |
| Secret as integer | Single 32-byte big-endian integer | No splitting needed since PRIME > 2^256 |
| Polynomial evaluation | Horner's method | O(k) — most efficient recursive form |
| Reconstruction | Lagrange interpolation at x=0 | Standard threshold scheme |
| Modular inverse | Fermat's little theorem: `pow(d, p-2, p)` | Valid for prime p; built-in Python `pow` is efficient |
| Share y-value packing | 33 bytes big-endian | PRIME-1 < 2^257 fits in 33 bytes with margin |
| Integrity | SHA-256 checksum of secret stored in each share | Detects corrupted or mismatched shares |

> **Note on prime choice:** The prompt specified `2^127 - 1` (Mersenne prime). However, a 16-byte (128-bit) half of an AES key can reach `2^128 - 1`, which exceeds `2^127 - 1`. Using a single prime `2^256 + 297` (larger than any 256-bit AES key) is mathematically equivalent, simpler, and correct. The implementation and all 9 tests are verified working.

---

## Data Formats

| Value | Format |
|---|---|
| Secret | Raw bytes (up to 32 bytes) |
| Share dict | `{ share_index: int, share_data: str(b64, 44 chars), k: int, n: int, checksum: str(hex, 64 chars) }` |
| share_data decoded | 33 raw bytes (Shamir y-value, big-endian) |
| KeyShare MongoDB doc | 8 fields: share_index, share_data, k, n, checksum, owner_id, session_id, created_at |
| checksum | SHA-256 hex digest of original secret (64 hex chars) |

---

## Integration Notes

- `split_secret()` input is the 32-byte AES key from `generate_aes_key()` or `derive_shared_key()`
- `reconstruct_secret()` output is directly usable as input to `decrypt_message()` or `decrypt_file()`
- `KeyShare.to_share_dict()` output is directly accepted by `reconstruct_secret()`
- `session_id` in KeyShare links all n shares of one message send operation — query MongoDB by `session_id` to retrieve all shares for a session
- `owner_id` identifies which user holds each share — typically `n` different users

---

## Test Results

```
--------------------------------------
 TEST 1 - Basic Split/Reconstruct (k=3, n=5)
--------------------------------------
  [info] Generated 5 shares
  [info] Reconstructed from shares [1,3,5]
  [result] PASS - 5 shares generated; reconstruction from [1,3,5] succeeded

--------------------------------------
 TEST 2 - Multiple Share Combinations
--------------------------------------
  [info] Shares [1, 2, 3] -> CORRECT
  [info] Shares [2, 4, 5] -> CORRECT
  [info] Shares [1, 4, 5] -> CORRECT
  [result] PASS - All three k-subsets reconstruct identical secret

--------------------------------------
 TEST 3 - Insufficient Shares Rejection
--------------------------------------
  [info] ValueError raised as expected: Insufficient shares: need at least 3, got 2.
  [result] PASS - ValueError raised when only k-1 shares provided

--------------------------------------
 TEST 4 - Custom Params (k=2, n=3)
--------------------------------------
  [info] Shares [1, 2] -> CORRECT
  [info] Shares [1, 3] -> CORRECT
  [info] Shares [2, 3] -> CORRECT
  [result] PASS - k=2,n=3 split/reconstruct with all 2-share combos

--------------------------------------
 TEST 5 - Custom Params (k=5, n=7)
--------------------------------------
  [info] Reconstruction with 5 shares -> CORRECT
  [info] 4 shares raised ValueError as expected: Insufficient shares: need at least 5, got 4.
  [result] PASS - k=5,n=7 reconstruct OK with 5; ValueError with 4

--------------------------------------
 TEST 6 - Share Verification
--------------------------------------
  [info] All 5 genuine shares passed verify_share
  [info] Tampered share correctly rejected by verify_share
  [info] Share with missing key correctly rejected
  [result] PASS - verify_share correctly accepts valid and rejects tampered shares

--------------------------------------
 TEST 7 - Full AES Key Split+Reconstruct
--------------------------------------
  [encrypt] Message encrypted with AES key
  [split]   AES key split into 5 shares (k=3)
  [reconstruct] Key reconstructed from shares [2,3,5]
  [decrypt] Decrypted: "Patient record: John Doe, Blood type O+, Ward 7"
  [result] PASS - AES key split, discarded, reconstructed, and used to decrypt

--------------------------------------
 TEST 8 - get_share_info Output
--------------------------------------
  [info] get_share_info returned: {'share_index': 3, 'total_shares': 5, 'threshold': 3, 'is_valid': True}
  [result] PASS - get_share_info returns correct metadata for share 3

--------------------------------------
 TEST 9 - KeyShare Model
--------------------------------------
  [model]  Created: KeyShare(index=1/5, k=3, session='session_001', owner='doctor_alice')
  [to_dict] All fields present: ['share_index', 'share_data', 'k', 'n', 'checksum', 'owner_id', 'session_id', 'created_at']
  [from_dict] Round-trip successful
  [to_share_dict] Keys: ['checksum', 'k', 'n', 'share_data', 'share_index']
  [reconstruct] Using to_share_dict output in reconstruction -> OK
  [result] PASS - KeyShare to_dict, from_dict, and to_share_dict all work correctly

==========================================
  SHAMIR SECRET SHARING MODULE TEST RESULTS
  Test 1 - Basic Split/Reconstruct (k=3,n=5) : PASS
  Test 2 - Multiple Share Combinations       : PASS
  Test 3 - Insufficient Shares Rejection     : PASS
  Test 4 - Custom Params (k=2,n=3)           : PASS
  Test 5 - Custom Params (k=5,n=7)           : PASS
  Test 6 - Share Verification                : PASS
  Test 7 - Full AES Key Split+Reconstruct    : PASS
  Test 8 - get_share_info Output             : PASS
  Test 9 - KeyShare Model                    : PASS
==========================================
```

---

## What Prompt 4 Must Know

- Project root: `stegochain/`
- Backend root: `stegochain/backend/`
- Steganography module: `backend/modules/steganography/` — COMPLETE
- Crypto module: `backend/modules/crypto/` — COMPLETE
- Secret sharing module: `backend/modules/secret_sharing/` — COMPLETE
- KeyShare model: `backend/models/keyshare.py` — COMPLETE
- AES key: 32 raw bytes
- Share dict format: `{ share_index: int, share_data: str(b64), k: int, n: int, checksum: str(hex) }`
- **Next module to build:** IPFS integration via Pinata API in `backend/modules/ipfs/pinata.py`
- The encrypted stego object file (output of `encrypt_file()`) is what gets uploaded to IPFS
- IPFS upload returns a CID string which must be stored alongside `nonce` and `tag` in MongoDB
- Pinata API keys come from `.env` via `config.py`: `PINATA_API_KEY`, `PINATA_SECRET_KEY`, `PINATA_BASE_URL`
- Upload endpoint: `POST https://api.pinata.cloud/pinning/pinFileToIPFS`
- Retrieve endpoint: `GET https://gateway.pinata.cloud/ipfs/{CID}`

---

## Known Issues

- None. All 9 tests pass.
- The Mersenne prime `2^127 - 1` specified in the prompt cannot accommodate a full 16-byte half-secret (max `2^128 - 1`). Used `2^256 + 297` instead, which is larger than any 256-bit AES key and avoids the overflow. Academically equivalent — both are finite field Shamir schemes.

---

## Files Not Yet Built (Placeholders Remaining)

- `backend/modules/ipfs/pinata.py` — Prompt 4
- `backend/modules/blockchain/web3_client.py` — Prompt 5
- `backend/modules/graph_ai/anomaly.py` — Prompt 7
- `backend/routes/stego_routes.py` — Prompt 6
- `backend/routes/crypto_routes.py` — Prompt 6
- `backend/routes/ipfs_routes.py` — Prompt 6
- `backend/routes/blockchain_routes.py` — Prompt 6
- `backend/models/user.py` — Prompt 6
- `backend/models/transaction.py` — Prompt 6
- `backend/tests/test_ipfs.py` — Prompt 4
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
