const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
    console.log("==============================================");
    console.log(" StegoChain — Contract Deployment");
    console.log("==============================================");

    // ── Get deployer account ──────────────────────────────────────────────
    const [deployer] = await ethers.getSigners();
    const balance    = await ethers.provider.getBalance(deployer.address);

    console.log(`Deployer  : ${deployer.address}`);
    console.log(`Balance   : ${ethers.formatEther(balance)} ETH`);

    // ── Deploy StegoChain ─────────────────────────────────────────────────
    console.log("\nDeploying StegoChain...");
    const StegoChain = await ethers.getContractFactory("StegoChain");
    const contract   = await StegoChain.deploy();
    await contract.waitForDeployment();

    const address  = await contract.getAddress();
    const txHash   = contract.deploymentTransaction().hash;
    const receipt  = await ethers.provider.getTransactionReceipt(txHash);

    console.log(`\nContract address : ${address}`);
    console.log(`Transaction hash : ${txHash}`);
    console.log(`Block number     : ${receipt.blockNumber}`);
    console.log(`Gas used         : ${receipt.gasUsed.toString()}`);

    // ── Save deployment.json ──────────────────────────────────────────────
    const artifactsDir = path.join(__dirname, "..", "artifacts");
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Read compiled ABI from Hardhat artifacts
    const compiledPath = path.join(
        __dirname, "..", "artifacts", "contracts",
        "StegoChain.sol", "StegoChain.json"
    );

    let abi = [];
    if (fs.existsSync(compiledPath)) {
        const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf8"));
        abi = compiled.abi;
    }

    const deployment = {
        address:     address,
        txHash:      txHash,
        blockNumber: receipt.blockNumber,
        network:     hre.network.name,
        deployedAt:  new Date().toISOString(),
        abi:         abi,
    };

    const deploymentPath = path.join(artifactsDir, "deployment.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

    console.log(`\nDeployment info saved to: ${deploymentPath}`);

    // ── Instructions ──────────────────────────────────────────────────────
    console.log("\n==============================================");
    console.log(" NEXT STEP: Update your .env file");
    console.log("==============================================");
    console.log(`CONTRACT_ADDRESS=${address}`);
    console.log("==============================================\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
