require("@nomicfoundation/hardhat-toolbox");
// Load .env.production first (production keys), fall back to .env for local dev
require("dotenv").config({ path: "../.env.production", override: true });
require("dotenv").config({ path: "../.env", override: false });

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    // Ethereum Sepolia (migrated from Base Sepolia)
    sepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  // Etherscan v2 API — single key format
  etherscan: {
    apiKey: process.env.BASESCAN_API_KEY || "",
  },
  sourcify: { enabled: false },
};
