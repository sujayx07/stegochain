// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * @title StegoChainV2
 * @author StegoChain
 * @notice On-chain Merkle proof based AES key fragment verification.
 *         No Shamir shares, no MongoDB, no approval flows.
 *         Decryption is authorised by the blockchain via ECDSA signature
 *         and Merkle proof submitted by the receiver.
 */
contract StegoChainV2 {

    // ─────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────

    struct UserProfile {
        address ethAddress;
        bytes   publicKeyX;     // ECC P-256 public key X coordinate (32 bytes)
        bytes   publicKeyY;     // ECC P-256 public key Y coordinate (32 bytes)
        bool    isRegistered;
        uint256 registeredAt;
    }

    struct StegoRecord {
        uint256  recordId;
        string   ipfsCID;           // CID of encrypted stego media file
        string[] fragmentCIDs;      // CIDs of n encrypted AES key fragments on IPFS
        address  sender;
        address  receiver;
        string   sessionId;
        bytes32  merkleRoot;        // Merkle root of hashed key fragments
        bytes32  mediaHash;         // keccak256 of original stego file bytes
        uint256  timestamp;
        bool     isActive;
        uint8    totalFragments;    // n
    }

    // ─────────────────────────────────────────────
    //  State Variables
    // ─────────────────────────────────────────────

    mapping(address => UserProfile)  public users;
    mapping(uint256 => StegoRecord)  public records;
    mapping(string  => uint256)      public sessionToRecordId;
    mapping(address => uint256[])    public senderRecords;
    mapping(address => uint256[])    public receiverRecords;

    uint256 public recordCount;
    uint256 public userCount;
    address public owner;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event UserRegistered(
        address indexed user,
        uint256         timestamp
    );

    event RecordRegistered(
        uint256 indexed recordId,
        address indexed sender,
        address indexed receiver,
        string          sessionId,
        bytes32         merkleRoot,
        uint256         timestamp
    );

    event DecryptionAuthorised(
        uint256 indexed recordId,
        address indexed receiver,
        uint256         timestamp
    );

    event RecordRevoked(
        uint256 indexed recordId,
        address indexed revokedBy,
        uint256         timestamp
    );

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "StegoChainV2: not owner");
        _;
    }

    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "StegoChainV2: caller not registered");
        _;
    }

    // ─────────────────────────────────────────────
    //  User Registration
    // ─────────────────────────────────────────────

    /**
     * @notice Register caller's ECC P-256 public key on-chain.
     * @param publicKeyX  X coordinate of the P-256 public key (32 bytes).
     * @param publicKeyY  Y coordinate of the P-256 public key (32 bytes).
     */
    function registerUser(
        bytes memory publicKeyX,
        bytes memory publicKeyY
    ) external {
        require(!users[msg.sender].isRegistered, "StegoChainV2: already registered");
        require(publicKeyX.length > 0,           "StegoChainV2: publicKeyX empty");
        require(publicKeyY.length > 0,           "StegoChainV2: publicKeyY empty");

        users[msg.sender] = UserProfile({
            ethAddress:   msg.sender,
            publicKeyX:   publicKeyX,
            publicKeyY:   publicKeyY,
            isRegistered: true,
            registeredAt: block.timestamp
        });

        userCount++;
        emit UserRegistered(msg.sender, block.timestamp);
    }

    /**
     * @notice Fetch a user profile.
     * @param userAddress  Address to look up.
     */
    function getUser(address userAddress) external view returns (UserProfile memory) {
        return users[userAddress];
    }

    // ─────────────────────────────────────────────
    //  Record Registration
    // ─────────────────────────────────────────────

    /**
     * @notice Register a new stego record. Both sender and receiver must be
     *         registered users.
     * @param ipfsCID        CID of the encrypted stego media file on IPFS.
     * @param fragmentCIDs   Array of CIDs for each encrypted AES key fragment.
     * @param receiver       Address of the intended receiver.
     * @param sessionId      Unique session identifier string.
     * @param merkleRoot     Merkle root built from hashed AES key fragments.
     * @param mediaHash      keccak256 of the original stego file bytes.
     * @param totalFragments Number of key fragments (n).
     * @return recordId      The newly assigned record ID.
     */
    function registerRecord(
        string   memory ipfsCID,
        string[] memory fragmentCIDs,
        address         receiver,
        string   memory sessionId,
        bytes32         merkleRoot,
        bytes32         mediaHash,
        uint8           totalFragments
    ) external onlyRegistered returns (uint256) {
        require(users[receiver].isRegistered,  "StegoChainV2: receiver not registered");
        require(bytes(ipfsCID).length > 0,     "StegoChainV2: ipfsCID empty");
        require(fragmentCIDs.length > 0,       "StegoChainV2: no fragment CIDs");
        require(bytes(sessionId).length > 0,   "StegoChainV2: sessionId empty");
        require(merkleRoot != bytes32(0),      "StegoChainV2: merkleRoot empty");
        require(mediaHash  != bytes32(0),      "StegoChainV2: mediaHash empty");
        require(totalFragments > 0,            "StegoChainV2: totalFragments must be > 0");
        require(
            sessionToRecordId[sessionId] == 0,
            "StegoChainV2: sessionId already used"
        );

        recordCount++;
        uint256 recordId = recordCount;

        records[recordId] = StegoRecord({
            recordId:       recordId,
            ipfsCID:        ipfsCID,
            fragmentCIDs:   fragmentCIDs,
            sender:         msg.sender,
            receiver:       receiver,
            sessionId:      sessionId,
            merkleRoot:     merkleRoot,
            mediaHash:      mediaHash,
            timestamp:      block.timestamp,
            isActive:       true,
            totalFragments: totalFragments
        });

        sessionToRecordId[sessionId] = recordId;
        senderRecords[msg.sender].push(recordId);
        receiverRecords[receiver].push(recordId);

        emit RecordRegistered(
            recordId,
            msg.sender,
            receiver,
            sessionId,
            merkleRoot,
            block.timestamp
        );

        return recordId;
    }

    // ─────────────────────────────────────────────
    //  Decryption Authorisation (Core)
    // ─────────────────────────────────────────────

    /**
     * @notice Request decryption authorisation.  The caller must:
     *         1. Be the designated receiver of the record.
     *         2. Supply a valid Merkle proof that `leafHash` is in the tree.
     *         3. Supply a valid ECDSA signature of `challengeHash` that
     *            recovers to msg.sender.
     *
     * @param recordId      ID of the StegoRecord.
     * @param merkleProof   Sibling hashes forming the Merkle proof path.
     * @param leafHash      One of the leaf hashes in the Merkle tree.
     * @param signature     65-byte ECDSA signature (r, s, v) over challengeHash.
     * @param challengeHash The hash that was signed (e.g. keccak256(nonce)).
     */
    function requestDecryption(
        uint256   recordId,
        bytes32[] memory merkleProof,
        bytes32          leafHash,
        bytes     memory signature,
        bytes32          challengeHash
    ) external {
        StegoRecord storage record = records[recordId];

        require(record.recordId != 0,          "StegoChainV2: record does not exist");
        require(record.isActive,               "StegoChainV2: record is revoked");
        require(record.receiver == msg.sender, "StegoChainV2: caller is not the receiver");
        require(users[msg.sender].isRegistered,"StegoChainV2: caller not registered");

        // ── Merkle proof verification ──────────────────────────────────────
        require(
            verifyMerkleProof(merkleProof, record.merkleRoot, leafHash),
            "StegoChainV2: invalid Merkle proof"
        );

        // ── ECDSA signature verification ───────────────────────────────────
        require(signature.length == 65, "StegoChainV2: invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8   v;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        // Ethereum signed message prefix
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", challengeHash)
        );

        address recovered = ecrecover(ethSignedHash, v, r, s);
        require(recovered != address(0),      "StegoChainV2: ecrecover failed");
        require(recovered == msg.sender,      "StegoChainV2: signature does not match receiver");

        emit DecryptionAuthorised(recordId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  Merkle Proof Verification
    // ─────────────────────────────────────────────

    /**
     * @notice Standard sorted-pair Merkle tree verification.
     * @param proof  Array of sibling hashes.
     * @param root   Expected Merkle root.
     * @param leaf   Leaf hash to verify membership for.
     * @return bool  True if the proof is valid.
     */
    function verifyMerkleProof(
        bytes32[] memory proof,
        bytes32          root,
        bytes32          leaf
    ) public pure returns (bool) {
        bytes32 computed = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            if (computed <= sibling) {
                computed = keccak256(abi.encodePacked(computed, sibling));
            } else {
                computed = keccak256(abi.encodePacked(sibling, computed));
            }
        }

        return computed == root;
    }

    // ─────────────────────────────────────────────
    //  Record Queries
    // ─────────────────────────────────────────────

    /**
     * @notice Fetch a record by its numeric ID.
     */
    function getRecord(uint256 recordId) external view returns (StegoRecord memory) {
        require(records[recordId].recordId != 0, "StegoChainV2: record does not exist");
        return records[recordId];
    }

    /**
     * @notice Fetch a record by session ID string.
     */
    function getRecordBySession(string memory sessionId)
        external
        view
        returns (StegoRecord memory)
    {
        uint256 id = sessionToRecordId[sessionId];
        require(id != 0, "StegoChainV2: session not found");
        return records[id];
    }

    /**
     * @notice Return all record IDs where `receiver` is the designated receiver.
     */
    function getReceiverRecords(address receiver) external view returns (uint256[] memory) {
        return receiverRecords[receiver];
    }

    /**
     * @notice Return all record IDs where `sender` is the sender.
     */
    function getSenderRecords(address sender) external view returns (uint256[] memory) {
        return senderRecords[sender];
    }

    // ─────────────────────────────────────────────
    //  Record Management
    // ─────────────────────────────────────────────

    /**
     * @notice Revoke a record so it can no longer be decrypted.
     *         Only the original sender or the contract owner can revoke.
     */
    function revokeRecord(uint256 recordId) external {
        StegoRecord storage record = records[recordId];
        require(record.recordId != 0, "StegoChainV2: record does not exist");
        require(record.isActive,      "StegoChainV2: already revoked");
        require(
            msg.sender == record.sender || msg.sender == owner,
            "StegoChainV2: not authorised to revoke"
        );

        record.isActive = false;
        emit RecordRevoked(recordId, msg.sender, block.timestamp);
    }

    /**
     * @notice Verify that a stego file has not been tampered with.
     * @param recordId  Record to check.
     * @param mediaHash keccak256 hash of the file to verify.
     * @return bool     True if the hash matches the stored value.
     */
    function verifyMediaIntegrity(uint256 recordId, bytes32 mediaHash)
        external
        view
        returns (bool)
    {
        require(records[recordId].recordId != 0, "StegoChainV2: record does not exist");
        return records[recordId].mediaHash == mediaHash;
    }

    // ─────────────────────────────────────────────
    //  Stats
    // ─────────────────────────────────────────────

    /**
     * @notice Return high-level contract statistics.
     */
    function getContractStats()
        external
        view
        returns (
            uint256 totalRecords,
            uint256 totalUsers,
            address contractOwner
        )
    {
        return (recordCount, userCount, owner);
    }
}
