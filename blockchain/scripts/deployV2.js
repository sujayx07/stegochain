const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);
  console.log(
    `Balance: ${ethers.formatEther(
      await deployer.provider.getBalance(deployer.address)
    )} ETH`
  );

  const StegoChainV2 = await ethers.getContractFactory("StegoChainV2");
  console.log("Deploying StegoChainV2...");
  const contract = await StegoChainV2.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const txHash  = contract.deploymentTransaction().hash;

  console.log(`\nStegoChainV2 deployed to: ${address}`);
  console.log(`Transaction hash: ${txHash}`);
  console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  console.log(`\nAdd to your .env:`);
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);

  // Save deployment info
  const artifact    = await hre.artifacts.readArtifact("StegoChainV2");
  const deployment  = {
    address,
    txHash,
    network:    "sepolia",
    chainId:    11155111,
    deployedAt: new Date().toISOString(),
    abi:        artifact.abi,
  };

  const artifactDir = path.join(__dirname, "../artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log(`\nDeployment saved to blockchain/artifacts/deployment.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
