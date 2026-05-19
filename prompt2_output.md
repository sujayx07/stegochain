# Prompt 2 Output — AES-256 Encryption + ECC Key Exchange Module

## Session Date
2026-05-17

## What Was Built

| # | File | Status |
|---|------|--------|
| 1 | `stegochain/backend/modules/crypto/aes_cipher.py` | CREATED (complete) |
| 2 | `stegochain/backend/modules/crypto/key_exchange.py` | CREATED (complete) |
| 3 | `stegochain/backend/modules/crypto/__init__.py` | UPDATED (exports) |
| 4 | `stegochain/backend/tests/test_crypto.py` | CREATED (all 8 tests pass) |
| 5 | `stegochain/prompt2_output.md` | CREATED (this file) |

---

## Module Function Reference

### aes_cipher.py

- **generate_aes_key() → bytes**
  - Input: none
  - Output: 32 raw bytes (os.urandom — cryptographically secure)
  - Raises: nothing

- **encrypt_message(message: str, key: bytes) → dict**
  - Input: plaintext string, 32-byte AES key
  - Output: `{ "ciphertext": str(b64), "nonce": str(b64), "tag": str(b64) }`
  - Raises: nothing under normal use

- **decrypt_message(encrypted_data: dict, key: bytes) → str**
  - Input: dict from encrypt_message, same 32-byte key
  - Output: original plaintext string
  - Raises: `ValueError` if decryption fails or GCM tag verification fails (tampered or wrong key)

- **encrypt_file(file_path: str, key: bytes, output_path: str) → dict**
  - Input: source file path, 32-byte key, output path for encrypted binary
  - Output: `{ "nonce": str(b64), "tag": str(b64) }` — ciphertext is written to output_path
  - Raises: `FileNotFoundError` if source file not found

- **decrypt_file(encrypted_file_path: str, key: bytes, nonce: str, tag: str, output_path: str) → str**
  - Input: encrypted file path, 32-byte key, base64 nonce, base64 tag, output path
  - Output: output_path string on success
  - Raises: `ValueError` if decryption or tag verification fails

### key_exchange.py

- **generate_ecc_keypair() → dict**
  - Input: none
  - Output: `{ "private_key": str(PEM), "public_key": str(PEM) }` — NIST P-256 curve
  - Raises: nothing

- **export_public_key(private_key_pem: str) → str**
  - Input: PEM private key string
  - Output: PEM public key string
  - Raises: nothing under normal use

- **derive_shared_key(private_key_pem: str, peer_public_key_pem: str) → bytes**
  - Input: own PEM private key, peer's PEM public key
  - Output: 32 bytes (SHA-256 of ECDH shared point x-coordinate)
  - Raises: `ValueError` if keys are invalid
  - Property: `derive_shared_key(A_priv, B_pub) == derive_shared_key(B_priv, A_pub)` always

- **sign_data(data: bytes, private_key_pem: str) → str**
  - Input: raw bytes to sign, PEM private key
  - Output: base64-encoded DER ECDSA signature string
  - Raises: nothing under normal use

- **verify_signature(data: bytes, signature_b64: str, public_key_pem: str) → bool**
  - Input: original bytes, base64 signature, PEM public key
  - Output: `True` if valid, `False` if not — never raises

---

## Data Formats

| Value | Format |
|---|---|
| AES key | 32 raw bytes |
| AES encrypted message | `{ ciphertext: str(b64), nonce: str(b64), tag: str(b64) }` |
| AES encrypted file | binary written to disk; caller stores `nonce` + `tag` separately |
| ECC private key | PEM string (`-----BEGIN PRIVATE KEY-----`) |
| ECC public key | PEM string (`-----BEGIN PUBLIC KEY-----`) |
| ECDH derived shared key | 32 raw bytes (SHA-256 of x-coordinate) |
| ECDSA signature | base64 DER-encoded string (~88 chars) |

---

## Implementation Details

### AES-256-GCM
- Mode: GCM (Galois/Counter Mode) — authenticated encryption (confidentiality + integrity in one step)
- Key size: 256 bits (32 bytes)
- Nonce: 16 bytes random per message/file (generated fresh each call)
- Tag: 16 bytes (GCM authentication tag, detects any tampering)
- Library: `pycryptodome` (`Crypto.Cipher.AES`)

### ECC P-256 (ECDH)
- Curve: NIST P-256 (secp256r1 / prime256v1)
- ECDH: raw shared point x-coordinate hashed with SHA-256 → 32-byte AES key
- Library: `pycryptodome` (`Crypto.PublicKey.ECC`)

### ECDSA
- Hash: SHA-256
- Mode: FIPS 186-3 (deterministic-safe)
- Library: `pycryptodome` (`Crypto.Signature.DSS`)

---

## Integration Notes

- `derive_shared_key()` output is directly compatible with `generate_aes_key()` output (both 32 raw bytes) — pass either directly to `encrypt_message()` / `decrypt_message()`
- `encrypt_file()` output will be uploaded to IPFS in Prompt 4 — the returned `nonce` and `tag` are stored in MongoDB alongside the IPFS CID
- `sign_data()` will be used in Prompt 5 to sign blockchain transaction payloads before submitting via Web3.py
- All base64 values in encrypted dicts are JSON-serialisable and MongoDB-safe strings

---

## Test Results

```
--------------------------------------
 TEST 1 - AES Key Generation
--------------------------------------
  [info] Key length: 32 bytes
  [result] PASS - Key is 32 bytes of raw bytes

--------------------------------------
 TEST 2 - AES Encrypt/Decrypt Round Trip
--------------------------------------
  [info] Encrypted keys: ['ciphertext', 'nonce', 'tag']
  [info] Decrypted: "Confidential StegoChain payload - patient record 2026"
  [result] PASS - Encrypt/Decrypt round trip successful

--------------------------------------
 TEST 3 - AES Wrong Key Rejection
--------------------------------------
  [info] Wrong-key decryption raised an exception as expected
  [result] PASS - Wrong key correctly rejected

--------------------------------------
 TEST 4 - AES File Encryption Round Trip
--------------------------------------
  [setup] Wrote source file: ...test_source.txt
  [encrypt] Encrypted file written: ...test_encrypted.bin
  [encrypt] Meta keys: ['nonce', 'tag']
  [decrypt] Decrypted file written: ...test_decrypted.txt
  [verify] Recovered content: "StegoChain file encryption test content 9876"
  [result] PASS - File encrypt/decrypt round trip successful
  [cleanup] Temporary files removed

--------------------------------------
 TEST 5 - ECC Key Pair Generation
--------------------------------------
  [info] Returned keys: ['private_key', 'public_key']
  [info] Private key header: -----BEGIN PRIVATE KEY-----
  [info] Public  key header: -----BEGIN PUBLIC KEY-----
  [info] export_public_key works correctly
  [result] PASS - ECC key pair generated with valid PEM headers

--------------------------------------
 TEST 6 - ECDH Shared Key Agreement
--------------------------------------
  [info] Alice derived key length: 32 bytes
  [info] Bob   derived key length: 32 bytes
  [info] Keys match: 80abe4e5b094fed0...
  [result] PASS - Alice and Bob derived the same 32-byte shared key

--------------------------------------
 TEST 7 - Full ECC+AES Pipeline
--------------------------------------
  [info] Shared key established: 8ef6e284318e03fd...
  [encrypt] Alice encrypted: ciphertext length = 84 chars
  [decrypt] Bob decrypted: "IoT sensor data: temperature=36.7 humidity=82 location=ward_4"
  [result] PASS - Full ECC key exchange + AES encryption pipeline successful

--------------------------------------
 TEST 8 - ECDSA Sign and Verify
--------------------------------------
  [sign]   Signature length: 88 chars (base64)
  [verify] With correct key:  True
  [verify] With impostor key: False
  [result] PASS - ECDSA sign and verify works correctly

==========================================
  CRYPTO MODULE TEST RESULTS
  Test 1 - AES Key Generation        : PASS
  Test 2 - AES Encrypt/Decrypt       : PASS
  Test 3 - AES Wrong Key Rejection   : PASS
  Test 4 - AES File Encryption       : PASS
  Test 5 - ECC Key Pair Generation   : PASS
  Test 6 - ECDH Shared Key Agreement : PASS
  Test 7 - Full ECC+AES Pipeline     : PASS
  Test 8 - ECDSA Sign and Verify     : PASS
==========================================
```

---

## What Prompt 3 Must Know

- Project root: `stegochain/`
- Backend root: `stegochain/backend/`
- Steganography module: `backend/modules/steganography/` — COMPLETE, do not touch
- Crypto module: `backend/modules/crypto/` — COMPLETE, do not touch
- AES key format: 32 raw bytes
- Encrypted message format: `{ "ciphertext": str(b64), "nonce": str(b64), "tag": str(b64) }`
- ECC keys: PEM strings (`-----BEGIN PRIVATE KEY-----` / `-----BEGIN PUBLIC KEY-----`)
- ECDH derived shared key: 32 raw bytes — directly usable as AES key
- ECDSA signatures: base64 DER string (~88 chars)
- **Next module to build:** Shamir's Secret Sharing in `backend/modules/secret_sharing/shamir.py`
- The AES key (32 raw bytes) is what gets split into n=5 shares by Shamir, requiring k=3 to reconstruct
- k and n must be configurable parameters (not hardcoded)
- The `secretsharing` package is already listed in requirements.txt

---

## Known Issues

- None. All 8 tests pass cleanly.
- Note: ECDH shared key derivation uses a manual `private_key.d * peer_pub.pointQ` multiplication since pycryptodome does not expose a high-level ECDH API. This is mathematically correct and follows the ECDH standard.

---

## Files Not Yet Built (Placeholders Remaining)

- `backend/modules/secret_sharing/shamir.py` — Prompt 3
- `backend/modules/ipfs/pinata.py` — Prompt 4
- `backend/modules/blockchain/web3_client.py` — Prompt 5
- `backend/modules/graph_ai/anomaly.py` — Prompt 7
- `backend/routes/stego_routes.py` — Prompt 6
- `backend/routes/crypto_routes.py` — Prompt 6
- `backend/routes/ipfs_routes.py` — Prompt 6
- `backend/routes/blockchain_routes.py` — Prompt 6
- `backend/models/user.py` — Prompt 6
- `backend/models/transaction.py` — Prompt 6
- `backend/models/keyshare.py` — Prompt 3
- `backend/tests/test_shamir.py` — Prompt 3
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
