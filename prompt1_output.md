# Prompt 1 Output — Project Scaffold + Steganography Module

## Session Date
2026-05-17

## What Was Built

| # | File |
|---|------|
| 1 | `stegochain/backend/modules/steganography/lsb_image.py` |
| 2 | `stegochain/backend/modules/steganography/echo_audio.py` |
| 3 | `stegochain/backend/modules/steganography/__init__.py` |
| 4 | `stegochain/backend/modules/__init__.py` |
| 5 | `stegochain/backend/modules/crypto/__init__.py` |
| 6 | `stegochain/backend/modules/crypto/aes_cipher.py` |
| 7 | `stegochain/backend/modules/crypto/key_exchange.py` |
| 8 | `stegochain/backend/modules/secret_sharing/__init__.py` |
| 9 | `stegochain/backend/modules/secret_sharing/shamir.py` |
| 10 | `stegochain/backend/modules/ipfs/__init__.py` |
| 11 | `stegochain/backend/modules/ipfs/pinata.py` |
| 12 | `stegochain/backend/modules/blockchain/__init__.py` |
| 13 | `stegochain/backend/modules/blockchain/web3_client.py` |
| 14 | `stegochain/backend/modules/graph_ai/__init__.py` |
| 15 | `stegochain/backend/modules/graph_ai/anomaly.py` |
| 16 | `stegochain/backend/routes/__init__.py` |
| 17 | `stegochain/backend/routes/stego_routes.py` |
| 18 | `stegochain/backend/routes/crypto_routes.py` |
| 19 | `stegochain/backend/routes/ipfs_routes.py` |
| 20 | `stegochain/backend/routes/blockchain_routes.py` |
| 21 | `stegochain/backend/models/__init__.py` |
| 22 | `stegochain/backend/models/user.py` |
| 23 | `stegochain/backend/models/transaction.py` |
| 24 | `stegochain/backend/models/keyshare.py` |
| 25 | `stegochain/backend/tests/test_steganography.py` |
| 26 | `stegochain/backend/tests/test_crypto.py` |
| 27 | `stegochain/backend/tests/test_shamir.py` |
| 28 | `stegochain/backend/tests/test_ipfs.py` |
| 29 | `stegochain/backend/tests/test_blockchain.py` |
| 30 | `stegochain/backend/requirements.txt` |
| 31 | `stegochain/backend/config.py` |
| 32 | `stegochain/backend/app.py` |
| 33 | `stegochain/blockchain/contracts/StegoChain.sol` |
| 34 | `stegochain/blockchain/scripts/deploy.js` |
| 35 | `stegochain/blockchain/test/StegoChain.test.js` |
| 36 | `stegochain/blockchain/hardhat.config.js` |
| 37 | `stegochain/frontend/pages/index.js` |
| 38 | `stegochain/frontend/pages/send.js` |
| 39 | `stegochain/frontend/pages/receive.js` |
| 40 | `stegochain/frontend/pages/ledger.js` |
| 41 | `stegochain/frontend/components/Navbar.js` |
| 42 | `stegochain/frontend/components/UploadMedia.js` |
| 43 | `stegochain/frontend/components/MessageForm.js` |
| 44 | `stegochain/frontend/components/LedgerTable.js` |
| 45 | `stegochain/frontend/utils/api.js` |
| 46 | `stegochain/frontend/package.json` |
| 47 | `stegochain/.env.example` |
| 48 | `stegochain/README.md` |
| 49 | `stegochain/prompt1_output.md` (this file) |

---

## Folder Structure

```
stegochain/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   ├── modules/
│   │   ├── __init__.py
│   │   ├── steganography/
│   │   │   ├── __init__.py
│   │   │   ├── lsb_image.py        ← COMPLETE
│   │   │   └── echo_audio.py       ← COMPLETE
│   │   ├── crypto/
│   │   │   ├── __init__.py
│   │   │   ├── aes_cipher.py       ← placeholder
│   │   │   └── key_exchange.py     ← placeholder
│   │   ├── secret_sharing/
│   │   │   ├── __init__.py
│   │   │   └── shamir.py           ← placeholder
│   │   ├── ipfs/
│   │   │   ├── __init__.py
│   │   │   └── pinata.py           ← placeholder
│   │   ├── blockchain/
│   │   │   ├── __init__.py
│   │   │   └── web3_client.py      ← placeholder
│   │   └── graph_ai/
│   │       ├── __init__.py
│   │       └── anomaly.py          ← placeholder
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── stego_routes.py         ← placeholder
│   │   ├── crypto_routes.py        ← placeholder
│   │   ├── ipfs_routes.py          ← placeholder
│   │   └── blockchain_routes.py    ← placeholder
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py                 ← placeholder
│   │   ├── transaction.py          ← placeholder
│   │   └── keyshare.py             ← placeholder
│   └── tests/
│       ├── test_steganography.py   ← COMPLETE (all tests PASS)
│       ├── test_crypto.py          ← placeholder
│       ├── test_shamir.py          ← placeholder
│       ├── test_ipfs.py            ← placeholder
│       └── test_blockchain.py      ← placeholder
├── blockchain/
│   ├── contracts/
│   │   └── StegoChain.sol          ← placeholder
│   ├── scripts/
│   │   └── deploy.js               ← placeholder
│   ├── test/
│   │   └── StegoChain.test.js      ← placeholder
│   └── hardhat.config.js           ← skeleton
├── frontend/
│   ├── pages/
│   │   ├── index.js                ← placeholder
│   │   ├── send.js                 ← placeholder
│   │   ├── receive.js              ← placeholder
│   │   └── ledger.js               ← placeholder
│   ├── components/
│   │   ├── Navbar.js               ← placeholder
│   │   ├── UploadMedia.js          ← placeholder
│   │   ├── MessageForm.js          ← placeholder
│   │   └── LedgerTable.js          ← placeholder
│   ├── utils/
│   │   └── api.js                  ← placeholder
│   └── package.json
├── .env.example
├── README.md
└── prompt1_output.md
```

---

## Steganography Module — Function Reference

### lsb_image.py

- **embed_message_in_image(image_path, message, output_path) → str**
  - Input: image path (PNG/BMP), message string, output path string
  - Output: output path string
  - Raises: `ValueError` if message + delimiter is too large for the image
  - Algorithm: converts each character to 8 bits, replaces the LSB of R/G/B channels in sequential pixels, appends `#####` as a delimiter

- **extract_message_from_image(stego_image_path) → str**
  - Input: stego image path (PNG/BMP)
  - Output: extracted message string (delimiter stripped)
  - Raises: `ValueError` if delimiter not found (no message present)

- **get_image_capacity(image_path) → int**
  - Input: image path
  - Output: max characters as integer
  - Formula: `(width × height × 3) // 8`

### echo_audio.py

- **embed_message_in_audio(audio_path, message, output_path) → str**
  - Input: WAV path (broadband/noise audio works best), message string, output path
  - Output: output path string
  - Algorithm: splits audio into segments of `SEGMENT_SAMPLES=512`, adds a decayed echo at `DELAY_ZERO=37` samples (bit 0) or `DELAY_ONE=73` samples (bit 1)

- **extract_message_from_audio(stego_audio_path) → str**
  - Input: stego WAV path
  - Output: extracted message string (delimiter stripped)
  - Algorithm: for each segment computes the real cepstrum (IFFT of log power spectrum), compares magnitude at the two delay lags to determine the embedded bit

- **get_audio_capacity(audio_path) → int**
  - Input: WAV path
  - Output: max characters as integer
  - Formula: `floor(total_samples / SEGMENT_SAMPLES) // 8`

---

## Key Implementation Notes

| Parameter | Value | Reason |
|---|---|---|
| Delimiter | `#####` | Used by both image and audio modules to mark end-of-message |
| Image formats | PNG, BMP | Lossless — JPEG would corrupt LSB bits |
| Audio format | WAV | Lossless — MP3 would corrupt echo timing |
| Echo delays | 37 / 73 samples | Prime values chosen to avoid harmonic collision with common audio frequencies |
| Segment size | 512 samples | Large enough for cepstrum resolution, small enough for acceptable capacity |
| Carrier type | Broadband / white noise | Echo hiding is designed for broadband signals; pure tones cause cepstrum ambiguity |

---

## Dependencies Installed

```
Pillow==10.2.0
numpy==1.26.3
scipy==1.12.0
python-dotenv==1.0.0
flask==3.0.0
flask-cors==4.0.0
```

*(Full requirements.txt also lists pycryptodome, web3, torch, torch-geometric, pymongo, secretsharing, pytest — to be used in future prompts)*

---

## Test Results

```
--------------------------------------
 IMAGE LSB STEGANOGRAPHY TEST
--------------------------------------
  [setup] Created test image: ...source_test_image.png  (100x100 px)
  [info] Image capacity: 3750 characters
  [embed] Hiding message: "StegoChain test message 12345"
  [embed] Stego image saved -> ...test_stego_image.png
  [extract] Recovered message: "StegoChain test message 12345"
  [result] PASS - Messages match
  [cleanup] Temporary files removed.

--------------------------------------
 AUDIO ECHO HIDING STEGANOGRAPHY TEST
--------------------------------------
  [setup] Created test audio: ...source_test_audio.wav  (3.0s @ 44100 Hz, white noise)
  [info] Audio capacity: 32 characters
  [embed] Hiding message: "StegoChain audio test 67890"
  [embed] Stego audio saved -> ...test_stego_audio.wav
  [extract] Recovered message: "StegoChain audio test 67890"
  [result] PASS - Messages match
  [cleanup] Temporary files removed.

==========================================
  STEGANOGRAPHY MODULE TEST RESULTS
  Image LSB Test : PASS
  Audio Echo Test: PASS
==========================================
```

---

## What The Next Prompt (Prompt 2) Must Know

- Project root is at: `stegochain/`
- Backend is at: `stegochain/backend/`
- Steganography module is complete and tested at: `backend/modules/steganography/`
- Delimiter used for message boundary: `#####`
- Image formats supported: PNG, BMP
- Audio format supported: WAV (broadband carrier recommended)
- Echo hiding parameters: DELAY_ZERO=37, DELAY_ONE=73, SEGMENT_SAMPLES=512, ECHO_AMPLITUDE=0.5
- Extraction method: real cepstrum (IFFT of log power spectrum)
- Requirements.txt is complete and already partially installed
- `config.py` and `.env.example` are in place
- `app.py` skeleton is ready — routes will be added in Prompt 6
- **Next module to build:** AES-256 encryption and ECC key exchange in `backend/modules/crypto/`

---

## Known Issues

1. **Echo hiding audio capacity is limited** — a 3s 44100Hz audio at 512 samples/segment holds only 32 characters. For longer messages, use longer audio files or reduce the segment size (with accuracy trade-off).
2. **Echo hiding requires broadband carriers** — pure sine/tonal audio causes cepstrum ambiguity. Real-world use with music or speech audio is fine.
3. **Audio normalisation after embedding** slightly alters sample values, which is expected and does not affect extraction accuracy.

---

## Files Not Yet Built (Placeholders)

- `backend/modules/crypto/aes_cipher.py` — Prompt 2
- `backend/modules/crypto/key_exchange.py` — Prompt 2
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
- `backend/tests/test_crypto.py` — Prompt 2
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
