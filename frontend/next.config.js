module.exports = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000",
    NEXT_PUBLIC_CHAIN_ID: "11155111",
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xa33fE3cee390910f8832134De02f7DC9bf473AfF",
    NEXT_PUBLIC_BASESCAN_URL: "https://sepolia.etherscan.io"
  }
};
