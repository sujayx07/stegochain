// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title StegoChain
 * @notice Immutable ledger for encrypted steganographic message records.
 *         Stores IPFS CIDs, sender/receiver addresses, session IDs, and
 *         Merkle roots that link a session's messages to an off-chain
 *         Shamir key-share set in MongoDB.
 * @dev    Pure vanilla Solidity — no external imports required.
 */
contract StegoChain {

    // ── Data Structures ────────────────────────────────────────────────────

    struct StegoRecord {
        uint256 recordId;
        string  cid;            // IPFS CID of the encrypted stego object
        address sender;         // Ethereum address of the sender
        address receiver;       // Ethereum address of the receiver
        string  sessionId;      // Links to Shamir shares stored in MongoDB
        bytes32 merkleRoot;     // Merkle root of all CIDs in this session
        uint256 timestamp;      // block.timestamp at registration
        bool    isActive;       // false once the record is revoked
    }

    // ── State Variables ────────────────────────────────────────────────────

    mapping(uint256 => StegoRecord)   public records;
    mapping(string  => uint256)        public cidToRecordId;
    mapping(address => uint256[])      public senderRecords;

    uint256 public recordCount;
    address public owner;

    // ── Events ─────────────────────────────────────────────────────────────

    event RecordRegistered(
        uint256 indexed recordId,
        string          cid,
        address indexed sender,
        address indexed receiver,
        string          sessionId,
        bytes32         merkleRoot,
        uint256         timestamp
    );

    event RecordRevoked(
        uint256 indexed recordId,
        address indexed revokedBy,
        uint256         timestamp
    );

    event MerkleRootUpdated(
        uint256 indexed recordId,
        bytes32         newMerkleRoot,
        uint256         timestamp
    );

    // ── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "StegoChain: caller is not the owner");
        _;
    }

    modifier recordExists(uint256 recordId) {
        require(recordId < recordCount, "StegoChain: record does not exist");
        _;
    }

    modifier recordActive(uint256 recordId) {
        require(records[recordId].isActive, "StegoChain: record has been revoked");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────

    constructor() {
        owner       = msg.sender;
        recordCount = 0;
    }

    // ── Write Functions ────────────────────────────────────────────────────

    /**
     * @notice Register a new steganographic record on-chain.
     * @param cid         IPFS CID of the encrypted stego object
     * @param receiver    Ethereum address of the intended receiver
     * @param sessionId   Session identifier linking to Shamir shares
     * @param merkleRoot  Merkle root of all CIDs in this session
     * @return newId      The recordId assigned to this record
     */
    function registerRecord(
        string  memory cid,
        address        receiver,
        string  memory sessionId,
        bytes32        merkleRoot
    ) external returns (uint256 newId) {
        require(bytes(cid).length       > 0,             "StegoChain: CID cannot be empty");
        require(receiver                != address(0),   "StegoChain: receiver is zero address");
        require(bytes(sessionId).length > 0,             "StegoChain: sessionId cannot be empty");

        newId = recordCount;

        records[newId] = StegoRecord({
            recordId:   newId,
            cid:        cid,
            sender:     msg.sender,
            receiver:   receiver,
            sessionId:  sessionId,
            merkleRoot: merkleRoot,
            timestamp:  block.timestamp,
            isActive:   true
        });

        cidToRecordId[cid] = newId;
        senderRecords[msg.sender].push(newId);
        recordCount++;

        emit RecordRegistered(
            newId,
            cid,
            msg.sender,
            receiver,
            sessionId,
            merkleRoot,
            block.timestamp
        );
    }

    /**
     * @notice Update the Merkle root for an existing record.
     * @dev    Only the original sender or contract owner may update.
     */
    function updateMerkleRoot(
        uint256 recordId,
        bytes32 newMerkleRoot
    ) external recordExists(recordId) recordActive(recordId) {
        StegoRecord storage rec = records[recordId];
        require(
            msg.sender == rec.sender || msg.sender == owner,
            "StegoChain: not authorised to update this record"
        );

        rec.merkleRoot = newMerkleRoot;

        emit MerkleRootUpdated(recordId, newMerkleRoot, block.timestamp);
    }

    /**
     * @notice Revoke a record so it is no longer considered active.
     * @dev    Only the original sender or contract owner may revoke.
     */
    function revokeRecord(
        uint256 recordId
    ) external recordExists(recordId) recordActive(recordId) {
        StegoRecord storage rec = records[recordId];
        require(
            msg.sender == rec.sender || msg.sender == owner,
            "StegoChain: not authorised to revoke this record"
        );

        rec.isActive = false;

        emit RecordRevoked(recordId, msg.sender, block.timestamp);
    }

    // ── View / Pure Functions ──────────────────────────────────────────────

    /**
     * @notice Retrieve a full StegoRecord by its recordId.
     */
    function getRecord(
        uint256 recordId
    ) external view recordExists(recordId) returns (StegoRecord memory) {
        return records[recordId];
    }

    /**
     * @notice Retrieve a full StegoRecord by IPFS CID.
     */
    function getRecordByCID(
        string memory cid
    ) external view returns (StegoRecord memory) {
        uint256 rid = cidToRecordId[cid];
        // cidToRecordId defaults to 0 for unknown CIDs; verify the CID matches
        require(
            keccak256(bytes(records[rid].cid)) == keccak256(bytes(cid)),
            "StegoChain: CID not found"
        );
        return records[rid];
    }

    /**
     * @notice Return all recordIds registered by a given sender.
     */
    function getSenderRecords(
        address sender
    ) external view returns (uint256[] memory) {
        return senderRecords[sender];
    }

    /**
     * @notice Verify that a record's stored CID and Merkle root match the
     *         provided values, and that the record is still active.
     */
    function verifyRecord(
        uint256       recordId,
        string memory cid,
        bytes32       merkleRoot
    ) external view returns (bool) {
        if (recordId >= recordCount) return false;
        StegoRecord storage rec = records[recordId];
        return (
            rec.isActive &&
            keccak256(bytes(rec.cid)) == keccak256(bytes(cid)) &&
            rec.merkleRoot == merkleRoot
        );
    }

    /**
     * @notice Return high-level contract statistics.
     */
    function getContractStats()
        external
        view
        returns (uint256 totalRecords, address contractOwner)
    {
        return (recordCount, owner);
    }

    /**
     * @notice Standard Merkle inclusion proof verification.
     * @dev    Proof is a list of sibling hashes from leaf to root level.
     *         Each pair is sorted (smaller first) before hashing to match the
     *         Python build_merkle_tree implementation.
     * @param proof  Array of sibling hashes
     * @param root   Expected Merkle root
     * @param leaf   Hash of the target leaf
     */
    function verifyMerkleProof(
        bytes32[] memory proof,
        bytes32          root,
        bytes32          leaf
    ) external pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            // Sort pair so that the smaller value comes first (matches Python impl)
            if (computed <= sibling) {
                computed = keccak256(abi.encodePacked(computed, sibling));
            } else {
                computed = keccak256(abi.encodePacked(sibling, computed));
            }
        }
        return computed == root;
    }
}
