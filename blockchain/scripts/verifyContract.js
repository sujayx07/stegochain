const { run } = require("hardhat");
const deployment = require("../artifacts/deployment.json");

async function main() {
  console.log(`Verifying contract at ${deployment.address} on Etherscan (Sepolia)...`);
  await run("verify:verify", {
    address: deployment.address,
    constructorArguments: [],
  });
  console.log("Contract verified on Etherscan");
  console.log(`View: https://sepolia.etherscan.io/address/${deployment.address}#code`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
