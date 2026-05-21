const { expect }  = require("chai");
const { ethers }  = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper: build a minimal Merkle tree from an array of leaf hashes and return
 * { root, proof } for a given leaf index.
 * Uses the same sorted-pair algorithm as the contract.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function buildMerkleTree(leaves) {
  // pad to power-of-two
  let layer = [...leaves];
  while (layer.length & (layer.length - 1)) {
    layer.push(layer[layer.length - 1]); // duplicate last leaf
  }

  const layers = [layer];
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i];
      const b = layer[i + 1] || layer[i];
      if (a <= b) {
        next.push(ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [a, b])));
      } else {
        next.push(ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [b, a])));
      }
    }
    layer = next;
    layers.push(layer);
  }

  const root = layer[0];
  return { root, layers };
}

function getMerkleProof(layers, leafIndex) {
  const proof = [];
  let idx = leafIndex;
  for (let i = 0; i < layers.length - 1; i++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < layers[i].length) {
      proof.push(layers[i][siblingIdx]);
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Test Suite
// ─────────────────────────────────────────────────────────────────────────────
describe("StegoChainV2", function () {
  let contract;
  let owner, sender, receiver, stranger;

  // Sample ECC public key material (32-byte each, arbitrary for testing)
  const PK_X = ethers.hexlify(ethers.randomBytes(32));
  const PK_Y = ethers.hexlify(ethers.randomBytes(32));

  // Session and IPFS fixture data
  const SESSION_ID    = "session-test-001";
  const IPFS_CID      = "QmTestMediaCID000000000000000000000000000000001";
  const FRAGMENT_CIDS = ["QmFrag001", "QmFrag002", "QmFrag003"];
  const MEDIA_HASH    = ethers.keccak256(ethers.toUtf8Bytes("test-media-content"));

  // Build a 3-leaf Merkle tree from the fragment CIDs
  const leaves = FRAGMENT_CIDS.map((cid) =>
    ethers.keccak256(ethers.toUtf8Bytes(cid))
  );
  const { root: MERKLE_ROOT, layers: MERKLE_LAYERS } = buildMerkleTree(leaves);
  const LEAF_HASH    = leaves[0];
  const MERKLE_PROOF = getMerkleProof(MERKLE_LAYERS, 0);

  // ── Before each: fresh deploy ──────────────────────────────────────────────
  beforeEach(async function () {
    [owner, sender, receiver, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("StegoChainV2");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function registerBoth() {
    // idempotent — skip if already registered (needed when registerRecord is
    // called more than once within the same test using the same signers)
    if (!(await contract.getUser(sender.address)).isRegistered) {
      await contract.connect(sender).registerUser(PK_X, PK_Y);
    }
    if (!(await contract.getUser(receiver.address)).isRegistered) {
      await contract.connect(receiver).registerUser(PK_X, PK_Y);
    }
  }

  async function registerRecord(sessionId = SESSION_ID) {
    await registerBoth();
    return contract
      .connect(sender)
      .registerRecord(
        IPFS_CID,
        FRAGMENT_CIDS,
        receiver.address,
        sessionId,
        MERKLE_ROOT,
        MEDIA_HASH,
        FRAGMENT_CIDS.length
      );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Deployment
  // ────────────────────────────────────────────────────────────────────────────
  it("1. Deployment sets owner correctly", async function () {
    expect(await contract.owner()).to.equal(owner.address);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. registerUser
  // ────────────────────────────────────────────────────────────────────────────
  it("2. registerUser stores public key correctly", async function () {
    await contract.connect(sender).registerUser(PK_X, PK_Y);
    const profile = await contract.getUser(sender.address);
    expect(profile.isRegistered).to.equal(true);
    expect(profile.ethAddress).to.equal(sender.address);
    expect(profile.publicKeyX).to.equal(PK_X);
    expect(profile.publicKeyY).to.equal(PK_Y);
  });

  it("3. registerUser emits UserRegistered event", async function () {
    await expect(contract.connect(sender).registerUser(PK_X, PK_Y))
      .to.emit(contract, "UserRegistered")
      .withArgs(sender.address, anyValue);  // block.timestamp asserted via anyValue
  });

  it("4. registerUser reverts on duplicate registration", async function () {
    await contract.connect(sender).registerUser(PK_X, PK_Y);
    await expect(
      contract.connect(sender).registerUser(PK_X, PK_Y)
    ).to.be.revertedWith("StegoChainV2: already registered");
  });

  it("5. registerUser reverts when publicKeyX is empty", async function () {
    await expect(
      contract.connect(sender).registerUser("0x", PK_Y)
    ).to.be.revertedWith("StegoChainV2: publicKeyX empty");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. registerRecord
  // ────────────────────────────────────────────────────────────────────────────
  it("6. registerRecord requires sender to be registered", async function () {
    await contract.connect(receiver).registerUser(PK_X, PK_Y);
    await expect(
      contract
        .connect(sender)
        .registerRecord(
          IPFS_CID, FRAGMENT_CIDS, receiver.address,
          SESSION_ID, MERKLE_ROOT, MEDIA_HASH, FRAGMENT_CIDS.length
        )
    ).to.be.revertedWith("StegoChainV2: caller not registered");
  });

  it("7. registerRecord requires receiver to be registered", async function () {
    await contract.connect(sender).registerUser(PK_X, PK_Y);
    await expect(
      contract
        .connect(sender)
        .registerRecord(
          IPFS_CID, FRAGMENT_CIDS, receiver.address,
          SESSION_ID, MERKLE_ROOT, MEDIA_HASH, FRAGMENT_CIDS.length
        )
    ).to.be.revertedWith("StegoChainV2: receiver not registered");
  });

  it("8. registerRecord stores all fields correctly", async function () {
    const tx = await registerRecord();
    await tx.wait();
    const rec = await contract.getRecord(1);

    expect(rec.recordId).to.equal(1n);
    expect(rec.ipfsCID).to.equal(IPFS_CID);
    expect(rec.sender).to.equal(sender.address);
    expect(rec.receiver).to.equal(receiver.address);
    expect(rec.sessionId).to.equal(SESSION_ID);
    expect(rec.merkleRoot).to.equal(MERKLE_ROOT);
    expect(rec.mediaHash).to.equal(MEDIA_HASH);
    expect(rec.isActive).to.equal(true);
    expect(rec.totalFragments).to.equal(FRAGMENT_CIDS.length);
    for (let i = 0; i < FRAGMENT_CIDS.length; i++) {
      expect(rec.fragmentCIDs[i]).to.equal(FRAGMENT_CIDS[i]);
    }
  });

  it("9. registerRecord emits RecordRegistered event", async function () {
    await registerBoth();
    await expect(
      contract
        .connect(sender)
        .registerRecord(
          IPFS_CID, FRAGMENT_CIDS, receiver.address,
          SESSION_ID, MERKLE_ROOT, MEDIA_HASH, FRAGMENT_CIDS.length
        )
    )
      .to.emit(contract, "RecordRegistered")
      .withArgs(
        1n,
        sender.address,
        receiver.address,
        SESSION_ID,
        MERKLE_ROOT,
        anyValue  // block.timestamp — asserted via anyValue to avoid off-by-one
      );
  });

  it("10. registerRecord increments recordCount", async function () {
    expect(await contract.recordCount()).to.equal(0n);
    await registerRecord("session-a");
    expect(await contract.recordCount()).to.equal(1n);
    await registerRecord("session-b");
    expect(await contract.recordCount()).to.equal(2n);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. requestDecryption
  // ────────────────────────────────────────────────────────────────────────────
  it("11. requestDecryption with valid proof emits DecryptionAuthorised", async function () {
    const tx = await registerRecord();
    await tx.wait();

    // receiver signs challengeHash
    const challengeHash = ethers.keccak256(ethers.toUtf8Bytes("challenge-nonce-001"));
    const sig = await receiver.signMessage(ethers.getBytes(challengeHash));

    await expect(
      contract
        .connect(receiver)
        .requestDecryption(1n, MERKLE_PROOF, LEAF_HASH, sig, challengeHash)
    )
      .to.emit(contract, "DecryptionAuthorised")
      .withArgs(1n, receiver.address, anyValue);
  });

  it("12. requestDecryption reverts for wrong receiver", async function () {
    const tx = await registerRecord();
    await tx.wait();

    await contract.connect(stranger).registerUser(PK_X, PK_Y);
    const challengeHash = ethers.keccak256(ethers.toUtf8Bytes("challenge"));
    const sig = await stranger.signMessage(ethers.getBytes(challengeHash));

    await expect(
      contract
        .connect(stranger)
        .requestDecryption(1n, MERKLE_PROOF, LEAF_HASH, sig, challengeHash)
    ).to.be.revertedWith("StegoChainV2: caller is not the receiver");
  });

  it("13. requestDecryption reverts for invalid Merkle proof", async function () {
    const tx = await registerRecord();
    await tx.wait();

    const badLeaf = ethers.keccak256(ethers.toUtf8Bytes("tampered-fragment"));
    const challengeHash = ethers.keccak256(ethers.toUtf8Bytes("challenge"));
    const sig = await receiver.signMessage(ethers.getBytes(challengeHash));

    await expect(
      contract
        .connect(receiver)
        .requestDecryption(1n, MERKLE_PROOF, badLeaf, sig, challengeHash)
    ).to.be.revertedWith("StegoChainV2: invalid Merkle proof");
  });

  it("14. requestDecryption reverts for invalid signature", async function () {
    const tx = await registerRecord();
    await tx.wait();

    // sign with wrong key (sender instead of receiver)
    const challengeHash = ethers.keccak256(ethers.toUtf8Bytes("challenge"));
    const wrongSig = await sender.signMessage(ethers.getBytes(challengeHash));

    await expect(
      contract
        .connect(receiver)
        .requestDecryption(1n, MERKLE_PROOF, LEAF_HASH, wrongSig, challengeHash)
    ).to.be.revertedWith("StegoChainV2: signature does not match receiver");
  });

  it("15. requestDecryption reverts on non-existent record", async function () {
    await expect(
      contract
        .connect(receiver)
        .requestDecryption(999n, [], LEAF_HASH, "0x", ethers.ZeroHash)
    ).to.be.revertedWith("StegoChainV2: record does not exist");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. verifyMerkleProof
  // ────────────────────────────────────────────────────────────────────────────
  it("16. verifyMerkleProof returns true for valid proof", async function () {
    const result = await contract.verifyMerkleProof(MERKLE_PROOF, MERKLE_ROOT, LEAF_HASH);
    expect(result).to.equal(true);
  });

  it("17. verifyMerkleProof returns false for tampered proof", async function () {
    const badLeaf  = ethers.keccak256(ethers.toUtf8Bytes("bad-leaf"));
    const result   = await contract.verifyMerkleProof(MERKLE_PROOF, MERKLE_ROOT, badLeaf);
    expect(result).to.equal(false);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. verifyMediaIntegrity
  // ────────────────────────────────────────────────────────────────────────────
  it("18. verifyMediaIntegrity returns true for matching hash", async function () {
    await registerRecord();
    expect(await contract.verifyMediaIntegrity(1n, MEDIA_HASH)).to.equal(true);
  });

  it("19. verifyMediaIntegrity returns false for wrong hash", async function () {
    await registerRecord();
    const badHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-media"));
    expect(await contract.verifyMediaIntegrity(1n, badHash)).to.equal(false);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 7. revokeRecord
  // ────────────────────────────────────────────────────────────────────────────
  it("20. revokeRecord sets isActive to false", async function () {
    await registerRecord();
    await contract.connect(sender).revokeRecord(1n);
    const rec = await contract.getRecord(1n);
    expect(rec.isActive).to.equal(false);
  });

  it("21. revokeRecord emits RecordRevoked event", async function () {
    await registerRecord();
    await expect(contract.connect(sender).revokeRecord(1n))
      .to.emit(contract, "RecordRevoked")
      .withArgs(1n, sender.address, anyValue);
  });

  it("22. revokeRecord prevents decryption after revocation", async function () {
    await registerRecord();
    await contract.connect(sender).revokeRecord(1n);

    const challengeHash = ethers.keccak256(ethers.toUtf8Bytes("challenge"));
    const sig = await receiver.signMessage(ethers.getBytes(challengeHash));

    await expect(
      contract
        .connect(receiver)
        .requestDecryption(1n, MERKLE_PROOF, LEAF_HASH, sig, challengeHash)
    ).to.be.revertedWith("StegoChainV2: record is revoked");
  });

  it("23. revokeRecord reverts for unauthorised caller", async function () {
    await registerRecord();
    await contract.connect(stranger).registerUser(PK_X, PK_Y);
    await expect(
      contract.connect(stranger).revokeRecord(1n)
    ).to.be.revertedWith("StegoChainV2: not authorised to revoke");
  });

  it("24. revokeRecord can be called by contract owner", async function () {
    await registerRecord();
    await contract.connect(owner).revokeRecord(1n);
    const rec = await contract.getRecord(1n);
    expect(rec.isActive).to.equal(false);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 8. getContractStats
  // ────────────────────────────────────────────────────────────────────────────
  it("25. getContractStats returns correct counts", async function () {
    let [totalRecords, totalUsers, contractOwner] = await contract.getContractStats();
    expect(totalRecords).to.equal(0n);
    expect(totalUsers).to.equal(0n);
    expect(contractOwner).to.equal(owner.address);

    await registerRecord(); // registers sender + receiver, adds 1 record
    [totalRecords, totalUsers, contractOwner] = await contract.getContractStats();
    expect(totalRecords).to.equal(1n);
    expect(totalUsers).to.equal(2n);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 9. Sender / Receiver record lists
  // ────────────────────────────────────────────────────────────────────────────
  it("26. getSenderRecords and getReceiverRecords return correct IDs", async function () {
    await registerRecord("session-x");
    await registerRecord("session-y"); // same sender/receiver pair

    const senderList   = await contract.getSenderRecords(sender.address);
    const receiverList = await contract.getReceiverRecords(receiver.address);

    expect(senderList.length).to.equal(2);
    expect(receiverList.length).to.equal(2);
    expect(senderList[0]).to.equal(1n);
    expect(senderList[1]).to.equal(2n);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 10. getRecordBySession
  // ────────────────────────────────────────────────────────────────────────────
  it("27. getRecordBySession returns the correct record", async function () {
    await registerRecord();
    const rec = await contract.getRecordBySession(SESSION_ID);
    expect(rec.recordId).to.equal(1n);
    expect(rec.sessionId).to.equal(SESSION_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility: get block timestamp at next mine (approximate; good enough for .withArgs)
// ─────────────────────────────────────────────────────────────────────────────
async function getTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block.timestamp);
}
