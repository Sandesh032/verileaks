# VeriLeaks — Phase 1

> **Decentralized whistleblower evidence bounty protocol**  
> Phase 1: Smart Contract Foundations + IPFS Storage + HTLC Bounty Escrow

---

## Project Overview

VeriLeaks is a decentralized protocol that allows whistleblowers to submit cryptographic evidence of wrongdoing and receive bounties from crowdfunded escrow, without revealing their identity on-chain.

Phase 1 establishes the foundational layer:
- Evidence integrity via Merkle Tree hashing
- Decentralized storage via IPFS (Pinata)
- On-chain metadata anchoring via `SubmissionRegistry`
- ETH staking via `TokenStaking`
- Bounty escrow via Hash Time-Locked Contracts (HTLC)

---

## Phase 1 Scope

| Feature | Status |
|---|---|
| Foundry development environment | ✅ Implemented |
| `SubmissionRegistry` (Solidity 0.8.x) | ✅ Implemented |
| `TokenStaking` (ETH-based) | ✅ Implemented |
| Merkle Tree library (Node.js) | ✅ Implemented |
| IPFS storage abstraction | ✅ Implemented |
| `MockStorageProvider` (dev/test) | ✅ Implemented |
| `PinataStorageProvider` (real IPFS) | ✅ Implemented |
| HTLC bounty escrow | ✅ Implemented |
| Unit tests (Solidity) | ✅ 62 tests, all passing |
| Unit tests (JavaScript) | ✅ 39 tests, all passing |
| Integration tests | ✅ Implemented |
| Local deployment (Anvil) | ✅ Verified |
| `.env.example` | ✅ Created |

---

## Architecture

```
Off-chain (Node.js)                    On-chain (Solidity/EVM)
────────────────────────────────────   ──────────────────────────────────
Evidence file
  │
  ▼
chunkData() [1 MiB chunks]
  │
  ▼
SHA-256 leaf hashes                    SubmissionRegistry
  │                                      └─ stores: ipfsCid, merkleRoot
  ▼                                             submitter, timestamp
Merkle tree
  │
  ├─ Merkle root ──────────────────────► registerSubmission(cid, root)
  │
  ▼
IPFS upload (Pinata or Mock)
  │
  ├─ CID ──────────────────────────────► registerSubmission(cid, root)
  │
  ▼
Off-chain: generate preimage/hashlock
  │
  ▼
                                       HTLC.fundBounty(submissionId,
                                            beneficiary, hashlock, timelock)
                                            {value: bountyAmount}
                                         │
                                         ▼
                                       Beneficiary reveals preimage
                                       HTLC.claim(lockId, preimage)
                                         OR
                                       Funder reclaims after timeout
                                       HTLC.refund(lockId)
```

---

## Project Structure

```
blockchain/
├── contracts/
│   ├── SubmissionRegistry.sol   # Evidence metadata on-chain anchor
│   ├── TokenStaking.sol         # ETH staking module
│   ├── HTLC.sol                 # Hash Time-Locked bounty escrow
│   └── interfaces/
│       ├── ISubmissionRegistry.sol
│       ├── ITokenStaking.sol
│       └── IHTLC.sol
├── script/
│   └── Deploy.s.sol             # Deployment script (Anvil + Sepolia)
├── test/
│   ├── SubmissionRegistry.t.sol
│   ├── TokenStaking.t.sol
│   ├── HTLC.t.sol
│   └── Phase1Integration.t.sol  # End-to-end Solidity integration test
├── src/
│   ├── merkle/
│   │   ├── MerkleTree.js        # Deterministic Merkle tree implementation
│   │   └── MerkleTree.test.js   # Jest tests
│   ├── storage/
│   │   ├── IStorageProvider.js  # Abstract interface
│   │   ├── MockStorageProvider.js  # Dev/test mock
│   │   ├── PinataStorageProvider.js # Real IPFS via Pinata
│   │   └── StorageProvider.test.js
│   ├── integration.test.js      # Off-chain pipeline integration test
│   └── workflow.js              # CLI demonstration script
├── docs/
├── lib/                         # forge-std (git submodule)
├── foundry.toml
├── package.json
├── .env.example
└── .gitignore
```

---

## Prerequisites

- **Node.js** ≥ 18 (v22.x recommended)
- **Foundry** v1.8.x — installed via `foundryup`
- **Git**
- Optional: Pinata account (for real IPFS; not needed for local dev)

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
export PATH="$PATH:$HOME/.foundry/bin"
foundryup
```

---

## Installation

```bash
# 1. Clone the repository
git clone <repository-url>

cd verileaks

# 2. Install Foundry dependencies
forge install

# 3. Install Node.js dependencies
npm install

# 4. Set up environment variables
cp .env.example .env
# Edit .env — at minimum set PRIVATE_KEY for local Anvil
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `PRIVATE_KEY` | Yes (deploy) | Hex private key (no 0x prefix) |
| `RPC_URL` | Yes (deploy) | EVM RPC endpoint |
| `ETHERSCAN_API_KEY` | No | Contract verification on Sepolia |
| `PINATA_API_URL` | No (real IPFS only) | `https://api.pinata.cloud` |
| `PINATA_API_KEY` | No (real IPFS only) | Pinata API key |
| `PINATA_API_SECRET` | No (real IPFS only) | Pinata API secret |

**Local development example `.env`:**
```env
PRIVATE_KEY=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545
```

> ⚠️ **Never commit real private keys or API secrets.** `.env` is in `.gitignore`.

---

## Required External Accounts and API Keys

### 1. IPFS Provider — Pinata

**Purpose:** Pin evidence files to IPFS so they are publicly retrievable by CID.

**Mandatory for:** Real IPFS uploads. NOT required for local development (use `MockStorageProvider`).

**Account:** https://app.pinata.cloud (free tier available; no payment required for < 1 GB)

**Credentials needed:**
- Go to **Account → API Keys → New Key**
- Grant: Admin permissions
- Copy: API Key and API Secret

**Environment variables:**

```env
PINATA_API_URL=https://api.pinata.cloud
PINATA_API_KEY=your_api_key_here
PINATA_API_SECRET=your_api_secret_here
```

**File:** `.env`

**Test that it works:**
```bash
node src/workflow.js --real-ipfs
```

### 2. Ethereum RPC (for Sepolia testnet)

**Purpose:** Submit transactions and deploy contracts to Sepolia.

**Mandatory for:** Sepolia deployment. NOT required for local development (use Anvil).

**Free options:**
- https://infura.io — 100k requests/day free tier
- https://alchemy.com — generous free tier

**Environment variable:**
```env
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

**Test that it works:**
```bash
curl -X POST $RPC_URL -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 3. Sepolia ETH (faucet)

**Purpose:** Pay gas on Sepolia testnet. NOT required for local development.

**Free faucets:**
- https://sepoliafaucet.com
- https://faucet.quicknode.com/ethereum/sepolia

---

## Running Local Blockchain

```bash
export PATH="$PATH:$HOME/.foundry/bin"

# Start local Anvil node
anvil --port 8545 --chain-id 31337
```

Anvil provides 10 pre-funded accounts with 10,000 ETH each. The default private key for account[0] is:
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

## Running Tests

### Solidity tests (Foundry)

```bash
export PATH="$PATH:$HOME/.foundry/bin"

# Run all tests
forge test -vv

# Run with gas reporting
forge test --gas-report

# Run a specific test file
forge test --match-path test/HTLC.t.sol -vv

# Run a specific test function
forge test --match-test test_claim_correctPreimage -vv
```

**Expected result:** `62 tests passed, 0 failed`

### JavaScript tests (Jest)

```bash
# Run all tests
npm test

# Run Merkle tree tests only
npm run test:merkle

# Run storage tests only
npm run test:storage

# Run integration pipeline tests
npm run test:integration
```

**Expected result:** `39 tests passed, 0 failed`

### Run the workflow demo

```bash
# Mock IPFS (no credentials needed)
node src/workflow.js

# Real IPFS (requires PINATA_* in .env)
node src/workflow.js --real-ipfs
```

---

## Deploying Contracts

### Local (Anvil)

```bash
export PATH="$PATH:$HOME/.foundry/bin"

# Terminal 1: Start Anvil
anvil

# Terminal 2: Deploy
PRIVATE_KEY=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --legacy
```

### Sepolia testnet

```bash
# Ensure .env has PRIVATE_KEY, RPC_URL, ETHERSCAN_API_KEY
source .env

forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

---

## IPFS Setup

### Local development (no credentials needed)

The `MockStorageProvider` simulates IPFS locally:
- Generates a deterministic pseudo-CID (SHA-256 based)
- Stores files in memory
- Returns consistent CIDs for identical file content
- Used automatically by all tests

### Real IPFS with Pinata

1. Create a Pinata account at https://app.pinata.cloud
2. Generate an API key (Admin permissions)
3. Add to `.env`:
   ```env
   PINATA_API_URL=https://api.pinata.cloud
   PINATA_API_KEY=your_key
   PINATA_API_SECRET=your_secret
   ```
4. Use `--real-ipfs` flag in workflow:
   ```bash
   node src/workflow.js --real-ipfs
   ```

---

## Merkle Tree Design

### Hashing Convention

| Parameter | Value |
|---|---|
| Algorithm | SHA-256 (Node.js `crypto` module) |
| Chunk size | 1 MiB (1,048,576 bytes) |
| Leaf hash rule | `SHA256(0x00 \|\| chunk_bytes)` |
| Node hash rule | `SHA256(0x01 \|\| left_hash \|\| right_hash)` |
| Odd node rule | Last leaf is promoted: `hash(0x01 \|\| last \|\| last)` |
| Byte encoding | Raw bytes (no Base64, no hex inside hash) |
| Output encoding | Hex string for all public APIs |

**Domain separation tags** (0x00 for leaves, 0x01 for internal nodes) prevent second-preimage attacks where an internal node could be mistaken for a leaf hash.

### Determinism Guarantee

```
Same file bytes + same CHUNK_SIZE
  → same chunks
  → same leaf hashes
  → same tree structure
  → same Merkle root
```

Tests in `src/merkle/MerkleTree.test.js` prove this property.

### Changing one byte changes the root

Changing any single byte in the evidence file changes the chunk hash, which propagates through all ancestor nodes up to the root. Tested in `test_sensitivity_*` cases.

### API

```javascript
import { generateMerkleTree, generateMerkleProof, verifyMerkleProof } from './src/merkle/MerkleTree.js';

const fileData = Buffer.from(fs.readFileSync('evidence.pdf'));

// Generate tree
const { root, leaves, chunkCount } = generateMerkleTree(fileData);

// Generate proof for chunk 0
const { leaf, proof, root } = generateMerkleProof(fileData, 0);

// Verify proof
const valid = verifyMerkleProof(leaf, proof, root); // true
```

---

## HTLC Lifecycle

```
fundBounty(submissionId, beneficiary, hashlock, timelock)
  │
  ▼
Status: FUNDED
  │
  ├─ [before timelock] claim(lockId, preimage)
  │     hash(preimage) == hashlock ?
  │       YES → Status: CLAIMED → ETH sent to beneficiary
  │       NO  → revert InvalidPreimage
  │
  └─ [after timelock] refund(lockId)
        Status: REFUNDED → ETH returned to funder
```

**Security properties:**
- Cannot claim twice (status guard)
- Cannot refund before timelock expires (block.timestamp > timelock required)
- Cannot claim after refund
- Cannot refund after claim
- Wrong preimage always rejected
- Only beneficiary can claim
- Only funder can refund
- Zero-value bounties rejected
- Zero-address beneficiary rejected
- Reentrancy prevented by checks-effects-interactions

---

## Example Phase 1 Workflow

### Quick local demo (no external services)

```bash
# Terminal 1
anvil

# Terminal 2
export PATH="$PATH:$HOME/.foundry/bin"

# Deploy
PRIVATE_KEY=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast --legacy

# Register a submission
REGISTRY=<address from deployment output>
cast send $REGISTRY \
  "registerSubmission(string,bytes32)(bytes32)" \
  "QmYourIPFSCID" \
  "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
  --rpc-url http://127.0.0.1:8545 \
  --private-key ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Check count
cast call $REGISTRY "submissionCount()(uint256)" --rpc-url http://127.0.0.1:8545

# Run off-chain pipeline demo
node src/workflow.js
```

---

## Security Considerations

| Threat | Mitigation |
|---|---|
| Reentrancy | Checks-Effects-Interactions in all external calls |
| Double-claim | Status enum + status guard before any state change |
| Claim after refund | Status guard rejects REFUNDED state |
| Wrong preimage | `keccak256(abi.encodePacked(preimage)) == hashlock` verified |
| Zero-value bounty | `msg.value == 0` rejected with `ZeroAmount` |
| Zero-address beneficiary | Rejected with `ZeroBeneficiary` |
| Premature refund | `block.timestamp > timelock` strictly required |
| Integer overflow | Solidity 0.8.x built-in checks eliminate SafeMath need |
| Permanently locked funds | State transitions enforced; `receive()` reverts on plain ETH |
| Unauthorized unstake | `balances[msg.sender]` is checked before withdrawal |
| Empty CID | `bytes(ipfsCid).length == 0` rejected |
| Empty Merkle root | `merkleRoot == bytes32(0)` rejected |
| Custom error gas | All reverts use custom errors (cheaper than strings) |

### Known Phase 1 Limitations

- `block.timestamp` can be manipulated ±15 seconds by validators. For long timelocks (days), this is not a practical threat. Phase 2 may add a minimum timelock enforcement (e.g., ≥1 hour).
- Submission IDs incorporate `block.number` for uniqueness. This is not a randomness source — it's a nonce mechanism.
- The `submitter` field is `msg.sender` in Phase 1. Phase 2 will replace this with a Semaphore/ZK nullifier for anonymity.
- IPFS CIDs are stored as strings. Phase 2 may encode them as bytes32 (CIDv0 multihash) for gas savings.

---

## Phase 2 — Not Implemented Yet

The following features are explicitly **NOT** implemented in Phase 1:

- ❌ **Tor anonymity integration** — submitter identity is `msg.sender`
- ❌ **Semaphore/ZK identity** — no zero-knowledge proofs
- ❌ **Chainlink VRF** — no verifiable random function for jury selection
- ❌ **Arbitrum L2** — all contracts are Ethereum L1
- ❌ **Schelling Point arbitration** — no dispute resolution
- ❌ **Commit-reveal jury voting** — no juror mechanism
- ❌ **Watchtowers** — no automated claim monitoring
- ❌ **React frontend DApp** — no UI
- ❌ **Filecoin persistence** — IPFS only (Pinata pinning)
- ❌ **Token slashing for arbitration** — no governance token
- ❌ **Cross-chain HTLC** — single-chain only
- ❌ **ERC-20 staking token** — ETH only

---

## Known Limitations

1. **IPFS availability:** If Pinata unpins a file, the CID becomes unresolvable. Phase 3 (Filecoin) addresses this.
2. **Submitter identity:** Phase 1 uses `msg.sender`. Whistleblowers should use a fresh wallet with no on-chain history.
3. **Mock CIDs:** `MockStorageProvider` generates pseudo-CIDs that are not real IPFS CIDs. They work for testing but cannot be resolved on the IPFS network.
4. **Single Merkle root per submission:** Phase 1 stores one root. Phase 2 may support incremental evidence updates.
