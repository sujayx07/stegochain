import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";

const WalletContext = createContext(null);

// Minimal ABI — just what we need from StegoChainV2
const CONTRACT_ABI = [
  {
    "inputs": [
      { "name": "publicKeyX", "type": "bytes" },
      { "name": "publicKeyY", "type": "bytes" }
    ],
    "name": "registerUser",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "userAddress", "type": "address" }],
    "name": "getUser",
    "outputs": [{
      "components": [
        { "name": "ethAddress",   "type": "address" },
        { "name": "publicKeyX",   "type": "bytes"   },
        { "name": "publicKeyY",   "type": "bytes"   },
        { "name": "isRegistered", "type": "bool"    },
        { "name": "registeredAt", "type": "uint256" }
      ],
      "name": "", "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  }
];

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const TARGET_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", () => window.location.reload());
      checkConnected();
    }
    return () => {
      if (typeof window !== "undefined" && window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  async function checkConnected() {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) await setupProvider();
    } catch {}
  }

  function handleAccountsChanged(accounts) {
    if (accounts.length === 0) { setAddress(null); setSigner(null); }
    else setupProvider();
  }

  async function setupProvider() {
    const web3Provider = new ethers.BrowserProvider(window.ethereum);
    const web3Signer = await web3Provider.getSigner();
    const network = await web3Provider.getNetwork();
    const addr = await web3Signer.getAddress();
    setProvider(web3Provider);
    setSigner(web3Signer);
    setAddress(addr);
    setChainId(Number(network.chainId));
  }

  async function connect() {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    setConnecting(true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await setupProvider();
    } finally {
      setConnecting(false);
    }
  }

  async function switchToSepolia() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }]  // 11155111 in hex
      });
      // Update state immediately after switching
      await setupProvider();
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Ethereum Sepolia",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/8eBBassAJ_lST02IZWB45"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"]
          }]
        });
        await setupProvider();
      }
    }
  }

  async function signChallenge(message) {
    if (!signer) throw new Error("Wallet not connected");
    return await signer.signMessage(message);
  }

  /**
   * Register the user ON-CHAIN by calling registerUser() directly from their
   * MetaMask signer. This ensures msg.sender = user's own address, which is
   * what the StegoChainV2 contract uses to map their profile.
   *
   * @param {string} publicKeyX  — hex string (without 0x prefix)
   * @param {string} publicKeyY  — hex string (without 0x prefix)
   * @returns {{ txHash: string, blockNumber: number }}
   */
  async function registerOnChain(publicKeyX, publicKeyY) {
    if (!signer) throw new Error("Wallet not connected. Connect MetaMask first.");
    if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS not configured.");

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Convert hex strings → Uint8Array bytes
    const xBytes = ethers.getBytes("0x" + publicKeyX.replace(/^0x/, "").padStart(64, "0"));
    const yBytes = ethers.getBytes("0x" + publicKeyY.replace(/^0x/, "").padStart(64, "0"));

    const tx = await contract.registerUser(xBytes, yBytes);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }

  const isCorrectChain = chainId === TARGET_CHAIN_ID;

  return (
    <WalletContext.Provider value={{
      address, provider, signer, chainId, connecting,
      connect, switchToSepolia, switchToBaseSepolia: switchToSepolia, signChallenge, registerOnChain,
      isCorrectChain, isConnected: !!address
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() { return useContext(WalletContext); }
