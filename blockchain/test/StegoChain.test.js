const { expect }   = require("chai");
const { ethers }   = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("StegoChain", function () {

    let stegoChain;
    let owner, alice, bob, carol;

    const TEST_CID         = "QmTestCID123456789abcdefghijklmnopqrstuvwxyz";
    const TEST_CID_2       = "QmSecondCID987654321zyxwvutsrqponmlkjihgfedcba";
    const TEST_CID_3       = "QmThirdCIDabcdef1234567890";
    const TEST_SESSION     = "session_test_001";
    const TEST_MERKLE_ROOT = ethers.keccak256(ethers.toUtf8Bytes("test_merkle_root"));
    const ZERO_ROOT        = ethers.ZeroHash;

    beforeEach(async function () {
        [owner, alice, bob, carol] = await ethers.getSigners();
        const StegoChain = await ethers.getContractFactory("StegoChain");
        stegoChain = await StegoChain.deploy();
        await stegoChain.waitForDeployment();
    });

    // ── Test 1: Deployment ────────────────────────────────────────────────
    describe("Deployment", function () {
        it("should set the correct owner", async function () {
            expect(await stegoChain.owner()).to.equal(owner.address);
        });

        it("should start with recordCount = 0", async function () {
            expect(await stegoChain.recordCount()).to.equal(0n);
        });
    });

    // ── Test 2: registerRecord ────────────────────────────────────────────
    describe("registerRecord", function () {
        it("should register a record and emit RecordRegistered", async function () {
            const tx = await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            const receipt = await tx.wait();

            // Check event
            await expect(tx)
                .to.emit(stegoChain, "RecordRegistered")
                .withArgs(0n, TEST_CID, alice.address, bob.address, TEST_SESSION, TEST_MERKLE_ROOT, anyValue);

            // recordCount incremented
            expect(await stegoChain.recordCount()).to.equal(1n);
        });

        it("should revert if CID is empty", async function () {
            await expect(
                stegoChain.connect(alice).registerRecord("", bob.address, TEST_SESSION, ZERO_ROOT)
            ).to.be.revertedWith("StegoChain: CID cannot be empty");
        });

        it("should revert if receiver is zero address", async function () {
            await expect(
                stegoChain.connect(alice).registerRecord(TEST_CID, ethers.ZeroAddress, TEST_SESSION, ZERO_ROOT)
            ).to.be.revertedWith("StegoChain: receiver is zero address");
        });

        it("should revert if sessionId is empty", async function () {
            await expect(
                stegoChain.connect(alice).registerRecord(TEST_CID, bob.address, "", ZERO_ROOT)
            ).to.be.revertedWith("StegoChain: sessionId cannot be empty");
        });
    });

    // ── Test 3: getRecord ─────────────────────────────────────────────────
    describe("getRecord", function () {
        it("should return correct record fields after registration", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );

            const rec = await stegoChain.getRecord(0n);
            expect(rec.recordId).to.equal(0n);
            expect(rec.cid).to.equal(TEST_CID);
            expect(rec.sender).to.equal(alice.address);
            expect(rec.receiver).to.equal(bob.address);
            expect(rec.sessionId).to.equal(TEST_SESSION);
            expect(rec.merkleRoot).to.equal(TEST_MERKLE_ROOT);
            expect(rec.isActive).to.equal(true);
        });

        it("should revert for non-existent recordId", async function () {
            await expect(stegoChain.getRecord(99n))
                .to.be.revertedWith("StegoChain: record does not exist");
        });
    });

    // ── Test 4: getRecordByCID ────────────────────────────────────────────
    describe("getRecordByCID", function () {
        it("should return correct record when looked up by CID", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );

            const rec = await stegoChain.getRecordByCID(TEST_CID);
            expect(rec.cid).to.equal(TEST_CID);
            expect(rec.sender).to.equal(alice.address);
        });

        it("should revert for unknown CID", async function () {
            await expect(stegoChain.getRecordByCID("QmUnknownCID"))
                .to.be.revertedWith("StegoChain: CID not found");
        });
    });

    // ── Test 5: getSenderRecords ──────────────────────────────────────────
    describe("getSenderRecords", function () {
        it("should return all recordIds registered by a sender", async function () {
            await stegoChain.connect(alice).registerRecord(TEST_CID,   bob.address, "sess1", ZERO_ROOT);
            await stegoChain.connect(alice).registerRecord(TEST_CID_2, bob.address, "sess2", ZERO_ROOT);
            await stegoChain.connect(alice).registerRecord(TEST_CID_3, bob.address, "sess3", ZERO_ROOT);

            const ids = await stegoChain.getSenderRecords(alice.address);
            expect(ids.length).to.equal(3);
            expect(ids[0]).to.equal(0n);
            expect(ids[1]).to.equal(1n);
            expect(ids[2]).to.equal(2n);
        });

        it("should return empty array for address with no records", async function () {
            const ids = await stegoChain.getSenderRecords(carol.address);
            expect(ids.length).to.equal(0);
        });
    });

    // ── Test 6: verifyRecord ──────────────────────────────────────────────
    describe("verifyRecord", function () {
        it("should return true for correct CID and merkleRoot", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            expect(await stegoChain.verifyRecord(0n, TEST_CID, TEST_MERKLE_ROOT)).to.equal(true);
        });

        it("should return false for wrong CID", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            expect(await stegoChain.verifyRecord(0n, "QmWrong", TEST_MERKLE_ROOT)).to.equal(false);
        });

        it("should return false for wrong merkleRoot", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            const wrongRoot = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
            expect(await stegoChain.verifyRecord(0n, TEST_CID, wrongRoot)).to.equal(false);
        });

        it("should return false for non-existent record", async function () {
            expect(await stegoChain.verifyRecord(99n, TEST_CID, TEST_MERKLE_ROOT)).to.equal(false);
        });
    });

    // ── Test 7: updateMerkleRoot ──────────────────────────────────────────
    describe("updateMerkleRoot", function () {
        it("should allow sender to update merkle root and emit event", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes("updated_root"));

            const tx = await stegoChain.connect(alice).updateMerkleRoot(0n, newRoot);
            await expect(tx).to.emit(stegoChain, "MerkleRootUpdated").withArgs(0n, newRoot, anyValue);

            const rec = await stegoChain.getRecord(0n);
            expect(rec.merkleRoot).to.equal(newRoot);
        });

        it("should allow owner to update any record's merkle root", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes("owner_updated_root"));
            await expect(stegoChain.connect(owner).updateMerkleRoot(0n, newRoot)).to.not.be.reverted;
        });

        it("should revert if unauthorised caller tries to update", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes("hack_root"));
            await expect(
                stegoChain.connect(bob).updateMerkleRoot(0n, newRoot)
            ).to.be.revertedWith("StegoChain: not authorised to update this record");
        });
    });

    // ── Test 8: revokeRecord ──────────────────────────────────────────────
    describe("revokeRecord", function () {
        it("should allow sender to revoke and emit RecordRevoked", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            const tx = await stegoChain.connect(alice).revokeRecord(0n);
            await expect(tx).to.emit(stegoChain, "RecordRevoked").withArgs(0n, alice.address, anyValue);

            const rec = await stegoChain.getRecord(0n);
            expect(rec.isActive).to.equal(false);
        });

        it("should make verifyRecord return false after revocation", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            await stegoChain.connect(alice).revokeRecord(0n);
            expect(await stegoChain.verifyRecord(0n, TEST_CID, TEST_MERKLE_ROOT)).to.equal(false);
        });

        it("should revert if unauthorised caller tries to revoke", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            await expect(
                stegoChain.connect(bob).revokeRecord(0n)
            ).to.be.revertedWith("StegoChain: not authorised to revoke this record");
        });

        it("should revert if already revoked", async function () {
            await stegoChain.connect(alice).registerRecord(
                TEST_CID, bob.address, TEST_SESSION, TEST_MERKLE_ROOT
            );
            await stegoChain.connect(alice).revokeRecord(0n);
            await expect(
                stegoChain.connect(alice).revokeRecord(0n)
            ).to.be.revertedWith("StegoChain: record has been revoked");
        });
    });

    // ── Test 9: verifyMerkleProof ─────────────────────────────────────────
    describe("verifyMerkleProof", function () {
        it("should verify a valid 4-leaf Merkle proof", async function () {
            // Build 4-leaf tree: leaves = keccak256 of each CID
            const cids = ["QmCID1", "QmCID2", "QmCID3", "QmCID4"];
            const leaves = cids.map(c => ethers.keccak256(ethers.toUtf8Bytes(c)));

            // Level 1 (sorted pairs)
            const n01 = _hashPair(leaves[0], leaves[1]);
            const n23 = _hashPair(leaves[2], leaves[3]);
            // Root
            const root = _hashPair(n01, n23);

            // Proof for leaves[0]: [leaves[1], n23]
            const proof = [leaves[1], n23];

            expect(await stegoChain.verifyMerkleProof(proof, root, leaves[0])).to.equal(true);
        });

        it("should return false with tampered proof", async function () {
            const cids   = ["QmCID1", "QmCID2", "QmCID3", "QmCID4"];
            const leaves = cids.map(c => ethers.keccak256(ethers.toUtf8Bytes(c)));
            const n01    = _hashPair(leaves[0], leaves[1]);
            const n23    = _hashPair(leaves[2], leaves[3]);
            const root   = _hashPair(n01, n23);

            // Tampered proof: replace sibling with wrong value
            const badSibling = ethers.keccak256(ethers.toUtf8Bytes("tampered"));
            const badProof   = [badSibling, n23];

            expect(await stegoChain.verifyMerkleProof(badProof, root, leaves[0])).to.equal(false);
        });
    });

    // ── Test 10: getContractStats ─────────────────────────────────────────
    describe("getContractStats", function () {
        it("should return correct totalRecords and contractOwner", async function () {
            await stegoChain.connect(alice).registerRecord(TEST_CID,   bob.address, "s1", ZERO_ROOT);
            await stegoChain.connect(alice).registerRecord(TEST_CID_2, bob.address, "s2", ZERO_ROOT);

            const [total, contractOwner] = await stegoChain.getContractStats();
            expect(total).to.equal(2n);
            expect(contractOwner).to.equal(owner.address);
        });
    });

    // ── Helpers ───────────────────────────────────────────────────────────

    // Helpers (keep _hashPair and _getBlockTs, remove broken anyUint)
    function _hashPair(a, b) {
        if (a <= b) {
            return ethers.keccak256(ethers.concat([a, b]));
        } else {
            return ethers.keccak256(ethers.concat([b, a]));
        }
    }

    async function _getBlockTs(receipt) {
        const block = await ethers.provider.getBlock(receipt.blockNumber);
        return BigInt(block.timestamp);
    }
});
