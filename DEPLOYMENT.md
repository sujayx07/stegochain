# StegoChain V2 Deployment Guide

This guide details the steps required to configure, deploy, run, and verify the StegoChain V2 platform in both manual and containerized environments.

---

## 1. Prerequisites

Ensure you have the following installed on your host system:
* **Python**: v3.10 or higher
* **Node.js**: v18.0 or higher
* **Docker & Docker Compose**: (Required for containerized deployment)
* **MetaMask Browser Extension**: (For user-side interaction with the frontend)

---

## 2. External Services and Credentials

StegoChain V2 utilizes the following external services. Before running the project, make sure these are active:

1. **MongoDB Atlas**:
   * Create a free M0 tier cluster.
   * Obtain the MongoDB Connection URI: `mongodb+srv://<username>:<password>@cluster.mongodb.net/stegochain?retryWrites=true&w=majority`
2. **Base Sepolia Testnet RPC**:
   * Get an RPC URL from Infura, Alchemy, or use the public Base endpoint: `https://sepolia.base.org`
3. **Pinata IPFS Service**:
   * Create a Pinata account.
   * Generate an API Key and Secret Key to allow file pinning and retrieval.

---

## 3. Environment Configuration

Create a file named `.env.production` in the root directory (`stegochain/`) with the following variables:

```env
# Flask Backend Configuration
SECRET_KEY=your_flask_secret_key_here
FLASK_PORT=5000

# Base Sepolia Network Details
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=0xa33fE3cee390910f8832134De02f7DC9bf473AfF
PRIVATE_KEY=your_backend_wallet_private_key_here

# MongoDB Configuration
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/stegochain?retryWrites=true&w=majority

# Pinata IPFS Credentials
PINATA_API_KEY=your_pinata_api_key_here
PINATA_SECRET_KEY=your_pinata_secret_key_here
```

---

## 4. Manual Running Instructions

### 4.1 Running the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python app.py
   ```
The backend server will run on `http://localhost:5000`.

### 4.2 Running the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
The frontend application will be available at `http://localhost:3000`.

---

## 5. Dockerized Running Instructions

StegoChain V2 includes production-ready Docker configurations. In this mode, the system does not spin up any local blockchain or database containers since it utilizes live MongoDB Atlas and Base Sepolia.

1. Ensure `.env.production` is present in the root directory.
2. Build and start the services using Docker Compose:
   ```bash
   docker compose up --build -d
   ```
3. Verify that the containers are healthy:
   ```bash
   docker compose ps
   ```
4. Retrieve container logs if troubleshooting is needed:
   ```bash
   docker compose logs -f
   ```

To stop the containers:
```bash
docker compose down
```

---

## 6. Testing & Validation

To verify the end-to-end functionality of all integrated modules, execute the V2 master integration test suite:

```bash
python tests/integration_test_v2.py
```

This script automatically:
1. Validates connectivity to the backend, MongoDB Atlas, Base Sepolia RPC, and Pinata IPFS.
2. Registers a temporary user on the backend.
3. Obtains a JWT authentication token.
4. Performs steganographic encoding/decoding and AES crypto rounds.
5. Runs the Graph AI anomaly detection module.
6. Executes the complete V2 Send Pipeline (LSB embed, AES-GCM file encryption, fragment splitting, IPFS uploads, Merkle tree construction, and on-chain record registration on Base Sepolia).
7. Executes the V2 Receive Pipeline (IPFS retrieval, client-side fragment decryption, Merkle proof generation, Ethereum ECDSA signature challenge verification, and smart contract verification).
8. Revokes the transaction on-chain.

---

## 7. Security Best Practices

* **Private Key Safeguarding**: The `PRIVATE_KEY` specified in `.env.production` belongs to the backend relayer address. Never commit this file or expose it publicly.
* **JWT Expiration**: Ensure short token lifetimes on JWT configurations (`SECRET_KEY` should be randomized).
* **On-Chain Revocation**: Use the revocation route (`/api/blockchain/revoke/<record_id>`) as soon as a key compromise is detected to invalidate further read attempts on-chain.
