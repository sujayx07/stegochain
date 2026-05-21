# Graph Report - .  (2026-05-19)

## Corpus Check
- 82 files · ~87,453 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 809 nodes · 1384 edges · 55 communities (44 shown, 11 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 160 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Blockchain Test|Blockchain Test]]
- [[_COMMUNITY_Rationale Audio|Rationale Audio]]
- [[_COMMUNITY_Anomaly Graph|Anomaly Graph]]
- [[_COMMUNITY_Ipfs Test|Ipfs Test]]
- [[_COMMUNITY_Info Cddba|Info Cddba]]
- [[_COMMUNITY_Test Aes|Test Aes]]
- [[_COMMUNITY_Shamir Test|Shamir Test]]
- [[_COMMUNITY_Test Routes|Test Routes]]
- [[_COMMUNITY_Info Cddba|Info Cddba]]
- [[_COMMUNITY_Test Integration|Test Integration]]
- [[_COMMUNITY_Files Cache|Files Cache]]
- [[_COMMUNITY_Transaction User|Transaction User]]
- [[_COMMUNITY_Package Devdependencies|Package Devdependencies]]
- [[_COMMUNITY_Keyshare Routes|Keyshare Routes]]
- [[_COMMUNITY_Test Stegochainv|Test Stegochainv]]
- [[_COMMUNITY_Api Anomaly|Api Anomaly]]
- [[_COMMUNITY_Test Stegochain|Test Stegochain]]
- [[_COMMUNITY_Info Efc|Info Efc]]
- [[_COMMUNITY_Frontend Test|Frontend Test]]
- [[_COMMUNITY_Package Scripts|Package Scripts]]
- [[_COMMUNITY_Info Efc|Info Efc]]
- [[_COMMUNITY_Deploy Contract|Deploy Contract]]
- [[_COMMUNITY_Messageform Send|Messageform Send]]
- [[_COMMUNITY_Routes Graph|Routes Graph]]
- [[_COMMUNITY_Stegochain Sol|Stegochain Sol]]
- [[_COMMUNITY_Stegochainv Sol|Stegochainv Sol]]
- [[_COMMUNITY_Info Efc|Info Efc]]
- [[_COMMUNITY_Navbar Receive|Navbar Receive]]
- [[_COMMUNITY_Info Efc|Info Efc]]
- [[_COMMUNITY_Info Efc|Info Efc]]
- [[_COMMUNITY_Info Efc|Info Efc]]
- [[_COMMUNITY_Info Efc|Info Efc]]
- [[_COMMUNITY_Deploy Scripts|Deploy Scripts]]
- [[_COMMUNITY_Deployv Scripts|Deployv Scripts]]
- [[_COMMUNITY_Uploadmedia Guesstype|Uploadmedia Guesstype]]
- [[_COMMUNITY_Index Pages|Index Pages]]
- [[_COMMUNITY_Config Rationale|Config Rationale]]
- [[_COMMUNITY_Verifycontract Scripts|Verifycontract Scripts]]
- [[_COMMUNITY_Stegochainv Sol|Stegochainv Sol]]
- [[_COMMUNITY_Stegochain Sol|Stegochain Sol]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_Lookup Session|Lookup Session]]
- [[_COMMUNITY_Config Rationale|Config Rationale]]
- [[_COMMUNITY_Keyshare Rationale|Keyshare Rationale]]
- [[_COMMUNITY_Transaction Rationale|Transaction Rationale]]
- [[_COMMUNITY_User Rationale|User Rationale]]

## God Nodes (most connected - your core abstractions)
1. `methodIdentifiers` - 21 edges
2. `send()` - 18 edges
3. `main()` - 17 edges
4. `reconstruct_secret()` - 16 edges
5. `_sep()` - 16 edges
6. `_pass()` - 16 edges
7. `_fail()` - 16 edges
8. `split_secret()` - 15 edges
9. `test_7_full_pipeline()` - 15 edges
10. `methodIdentifiers` - 15 edges

## Surprising Connections (you probably didn't know these)
- `t15()` --calls--> `next`  [INFERRED]
  backend/tests/test_routes.py → frontend/package.json
- `t11()` --calls--> `create_app()`  [INFERRED]
  backend/tests/test_graph.py → backend/app.py
- `_FakeCollection` --uses--> `KeyShare`  [INFERRED]
  backend/tests/test_routes.py → backend/models/keyshare.py
- `_FakeDB` --uses--> `KeyShare`  [INFERRED]
  backend/tests/test_routes.py → backend/models/keyshare.py
- `_FakeClient` --uses--> `KeyShare`  [INFERRED]
  backend/tests/test_routes.py → backend/models/keyshare.py

## Communities (55 total, 11 thin omitted)

### Community 0 - "Blockchain Test"
Cohesion: 0.06
Nodes (67): build_merkle_tree(), _extract_record_id_from_receipt(), get_contract_stats(), get_merkle_proof(), get_record(), get_record_by_cid(), get_web3_connection(), _hash_pair() (+59 more)

### Community 1 - "Rationale Audio"
Cohesion: 0.06
Nodes (59): _load_abi(), load_contract(), Load ABI from blockchain/artifacts/deployment.json if it exists,     otherwise f, Return a Web3 contract instance.      Parameters     ----------     w3, capacity(), _cleanup(), embed(), _err() (+51 more)

### Community 2 - "Anomaly Graph"
Cohesion: 0.08
Nodes (43): create_app(), app.py — StegoChain Flask Application ======================================= Co, build_graph_from_transactions(), GCNEncoder, get_graph_summary(), get_node_stats(), graph_dict_to_pyg_data(), GraphAnomalyDetector (+35 more)

### Community 3 - "Ipfs Test"
Cohesion: 0.09
Nodes (47): _auth_headers(), build_ipfs_metadata(), get_pin_list(), _parse_upload_response(), pin_exists(), _raise_for_error(), IPFS / Pinata Integration Module ================================== Provides fil, Retrieve a file from IPFS via the Pinata gateway.      Parameters     ---------- (+39 more)

### Community 4 - "Info Cddba"
Cohesion: 0.05
Nodes (36): functionDebugData, generatedSources, linkReferences, object, opcodes, sourceMap, StegoChainV2, functionDebugData (+28 more)

### Community 5 - "Test Aes"
Cohesion: 0.11
Nodes (35): decrypt_file(), decrypt_message(), encrypt_file(), encrypt_message(), generate_aes_key(), AES-256 Encryption Module (GCM Mode) ====================================== Prov, Decrypt a file produced by encrypt_file and write plaintext back to disk.      P, Generate a cryptographically secure random 256-bit (32-byte) AES key.      Retur (+27 more)

### Community 6 - "Shamir Test"
Cohesion: 0.14
Nodes (35): _bytes_to_int(), _evaluate_polynomial(), get_share_info(), _int_to_bytes(), _lagrange_interpolation(), Shamir's Secret Sharing Module ================================ Pure-Python impl, Validate the structure of a single share dict.      Returns True if all required, Return human-readable metadata about a share.      Parameters     ---------- (+27 more)

### Community 7 - "Test Routes"
Cohesion: 0.17
Nodes (25): _fail(), _FakeClient, _FakeCollection, _FakeDB, _make_png(), _mock_bc(), _pass(), Flask Routes Integration Test Suite -- 15 tests Run from stegochain/backend/: py (+17 more)

### Community 8 - "Info Cddba"
Cohesion: 0.07
Nodes (30): *, absolutePath, exportedSymbols, id, license, nodes, nodeType, src (+22 more)

### Community 9 - "Test Integration"
Cohesion: 0.24
Nodes (27): check_backend(), check_ganache(), check_mongodb(), check_pinata(), _fail(), _load_dotenv_manual(), main(), _make_png() (+19 more)

### Community 10 - "Files Cache"
Cohesion: 0.08
Nodes (26): *, artifacts, contentHash, imports, lastModificationDate, solcConfig, sourceName, versionPragmas (+18 more)

### Community 11 - "Transaction User"
Cohesion: 0.08
Nodes (11): KeyShare Model ============== Data model for one Shamir share belonging to one p, Transaction Model ================== MongoDB collection: transactions One Transa, Return the API-safe summary subset.         Excludes nonce, tag, and other sensi, MongoDB-ready Transaction document model., Return a MongoDB-ready dictionary with all fields., Transaction, User Model =========== MongoDB collection: users Represents a platform participa, MongoDB-ready User document model. (+3 more)

### Community 12 - "Package Devdependencies"
Cohesion: 0.09
Nodes (22): dependencies, next, react, react-dom, devDependencies, autoprefixer, @babel/core, babel-jest (+14 more)

### Community 13 - "Keyshare Routes"
Cohesion: 0.18
Nodes (14): KeyShare, Represents one Shamir share belonging to one participant.      Attributes     --, Return a MongoDB-ready dict representing this KeyShare document.          The di, Return exactly the share dict that reconstruct_secret() expects:             { s, _db(), decrypt(), derive_key(), encrypt() (+6 more)

### Community 14 - "Test Stegochainv"
Cohesion: 0.11
Nodes (15): { anyValue }, badHash, badLeaf, challengeHash, { ethers }, { expect }, FRAGMENT_CIDS, leaves (+7 more)

### Community 15 - "Api Anomaly"
Cohesion: 0.22
Nodes (11): deriveSharedKey(), flagNode(), generateKeypair(), getAnomalyScores(), getBlockchainRecord(), getBlockchainSenderRecords(), getGraphSummary(), getNodeStats() (+3 more)

### Community 16 - "Test Stegochain"
Cohesion: 0.12
Nodes (14): { anyValue }, badProof, badSibling, cids, { ethers }, { expect }, leaves, n01 (+6 more)

### Community 17 - "Info Efc"
Cohesion: 0.13
Nodes (12): methodIdentifiers, cidToRecordId(string), getRecord(uint256), getRecordByCID(string), getSenderRecords(address), records(uint256), registerRecord(string,address,string,bytes32), revokeRecord(uint256) (+4 more)

### Community 18 - "Frontend Test"
Cohesion: 0.13
Nodes (12): api, errEl, heading, [kInput, nInput], numInputs, onSubmit, records, required (+4 more)

### Community 19 - "Package Scripts"
Cohesion: 0.14
Nodes (13): description, devDependencies, dotenv, hardhat, @nomicfoundation/hardhat-toolbox, name, scripts, compile (+5 more)

### Community 20 - "Info Efc"
Cohesion: 0.17
Nodes (12): content, id, _format, id, input, language, sources, output (+4 more)

### Community 21 - "Deploy Contract"
Cohesion: 0.25
Nodes (10): deploy_contract(), load_abi_and_bytecode(), main(), deploy_contract.py ================== Deploys StegoChain.sol to a running Ganach, Deploy the StegoChain contract.      Supports two modes:     - private_key provi, Persist deployment.json and print the export command.      File format     -----, Poll the Ethereum node (Hardhat or Ganache) until it responds.     Works with:, Load compiled ABI and bytecode from a Hardhat artifact JSON.      Parameters (+2 more)

### Community 22 - "Messageform Send"
Cohesion: 0.20
Nodes (5): inputStyle, labelStyle, PIPELINE_STEPS, STEPS, sendMessage()

### Community 23 - "Routes Graph"
Cohesion: 0.44
Nodes (9): anomaly_scores(), _err(), _fetch_transactions(), flag_node(), node_stats(), _ok(), Graph AI Routes ================ Blueprint: graph_bp    prefix: /api/graph  Endp, Fetch complete transactions from MongoDB, strip ObjectId. (+1 more)

### Community 24 - "Stegochain Sol"
Cohesion: 0.22
Nodes (8): abi, bytecode, contractName, deployedBytecode, deployedLinkReferences, _format, linkReferences, sourceName

### Community 25 - "Stegochainv Sol"
Cohesion: 0.22
Nodes (8): abi, bytecode, contractName, deployedBytecode, deployedLinkReferences, _format, linkReferences, sourceName

### Community 26 - "Info Efc"
Cohesion: 0.22
Nodes (9): absolutePath, exportedSymbols, id, license, nodes, nodeType, src, ast (+1 more)

### Community 27 - "Navbar Receive"
Cohesion: 0.22
Nodes (5): NAV_LINKS, INPUT_STYLE, LABEL_STYLE, checkHealth(), receiveMessage()

### Community 28 - "Info Efc"
Cohesion: 0.25
Nodes (8): functionDebugData, generatedSources, immutableReferences, linkReferences, object, opcodes, sourceMap, deployedBytecode

### Community 29 - "Info Efc"
Cohesion: 0.29
Nodes (7): *, settings, enabled, runs, *, optimizer, outputSelection

### Community 30 - "Info Efc"
Cohesion: 0.29
Nodes (7): functionDebugData, generatedSources, linkReferences, object, opcodes, sourceMap, bytecode

### Community 31 - "Info Efc"
Cohesion: 0.33
Nodes (6): contracts/StegoChain.sol, StegoChain, contracts, abi, evm, metadata

### Community 32 - "Deploy Scripts"
Cohesion: 0.40
Nodes (3): { ethers }, fs, path

### Community 33 - "Deployv Scripts"
Cohesion: 0.40
Nodes (3): { ethers }, fs, path

### Community 34 - "Uploadmedia Guesstype"
Cohesion: 0.60
Nodes (4): guessType(), humanSize(), ICONS, UploadMedia()

## Knowledge Gaps
- **214 isolated node(s):** `Config`, `name`, `version`, `description`, `compile` (+209 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `send()` connect `Rationale Audio` to `Blockchain Test`, `Ipfs Test`, `Test Aes`, `Shamir Test`, `Transaction User`, `Keyshare Routes`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `KeyShare` connect `Keyshare Routes` to `Rationale Audio`, `Transaction User`, `Shamir Test`, `Test Routes`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `_FakeClient` connect `Test Routes` to `Anomaly Graph`, `Keyshare Routes`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `send()` (e.g. with `Transaction` and `generate_aes_key()`) actually correct?**
  _`send()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `reconstruct_secret()` (e.g. with `reconstruct_key()` and `receive()`) actually correct?**
  _`reconstruct_secret()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `app.py — StegoChain Flask Application ======================================= Co`, `Config`, `config.py — StegoChain Application Configuration ===============================` to the rest of the system?**
  _354 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Blockchain Test` be split into smaller, more focused modules?**
  _Cohesion score 0.06455399061032864 - nodes in this community are weakly interconnected._