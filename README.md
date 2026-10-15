# VeriLeaks

> **Decentralized Whistleblower Evidence Bounty Protocol**  
> Cryptographic evidence integrity, zero-knowledge identity, randomized arbitration, and trustless bounty escrow.

[![Solidity Tests](https://img.shields.io/badge/Foundry%20Tests-63%20passed-brightgreen)](#running-tests)
[![Jest Tests](https://img.shields.io/badge/Jest%20Tests-42%20passed-brightgreen)](#running-tests)
[![Solidity Version](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![Network](https://img.shields.io/badge/Target%20EVM-Arbitrum%20(Shanghai)-orange)](https://arbitrum.io/)
[![Audit Status](https://img.shields.io/badge/Audit-Phase%201%20%26%202%20Remediated-success)](docs/audit/final-audit-report.md)

---

## Table of Contents

- [Overview](#overview)
- [Core Architecture](#core-architecture)
  - [Phase 1: Foundations, Storage & Escrow](#phase-1-foundations-storage--escrow)
  - [Phase 2: ZK Identity, VRF & Schelling Arbitration](#phase-2-zk-identity-vrf--schelling-arbitration)
  - [Privacy & Network Anonymity (Tor & Proxy)](#privacy--network-anonymity-tor--proxy)
- [Protocol Workflow](#protocol-workflow)
- [Repository Structure](#repository-structure)
- [Smart Contracts](#smart-contracts)
- [Off-Chain Services & Tooling](#off-chain-services--tooling)
- [Prerequisites & Installation](#prerequisites--installation)
- [Environment Configuration](#environment-configuration)
- [Running Tests](#running-tests)
- [Local Deployment & Verification](#local-deployment--verification)
- [Security Model & Threat Mitigations](#security-model--threat-mitigations)
- [Audit & Compliance Status](#audit--compliance-status)
- [Phase 3 Roadmap](#phase-3-roadmap)
- [License](#license)

---

## Overview

**VeriLeaks** is an open-source decentralized protocol engineered to protect whistleblowers while ensuring evidence authenticity and fair economic compensation. Whistleblowers can register confidential documents, prove cryptographic integrity, claim bounties, and resolve disputes without ever exposing their real-world identities or on-chain transaction trails.

### Key Innovations:
1. **Deterministic Merkle Integrity:** Evidence is chunked into 1 MiB segments with leaf-level domain separation (`0x00`) and node separation (`0x01`), anchoring cryptographic roots on-chain.
2. **Zero-Knowledge Whistleblower Identity:** Integrates Semaphore v4 zero-knowledge proofs to verify membership within authorized groups without revealing public keys or wallet histories.
3. **Provably Fair Juror Selection:** Powered by Chainlink VRF v2.5 to select unbiased, staked jurors with excluded conflict-of-interest parties.
4. **Schelling Point Consensus:** Dispute resolution mechanism with a two-phase commit-reveal voting window, slashing minority or non-revealing jurors and redistributing funds to the honest consensus majority.
5. **Trustless Bounty Settlement:** Hash Time-Locked Contracts (HTLC) integrated with an arbitration escrow adapter (`ArbitratedBounty`), guaranteeing trustless payout or refund based on arbitration verdicts.
6. **Network Privacy:** Local reverse proxy and Tor Hidden Service routing that decouples clients from third-party storage providers (e.g. Pinata/IPFS), eliminating IP and metadata leaks.

---

## Core Architecture

```
                          ┌────────────────────────┐
                          │   Whistleblower / Tor  │
                          └───────────┬────────────┘
                                      │ Upload via Onion Hidden Service
                                      ▼
                          ┌────────────────────────┐
                          │  Local Privacy Proxy   │ (Express + Multer in-memory)
                          └─────┬────────────┬─────┘
           Pins to IPFS         │            │ Chunking & Merkle Root (Node.js)
         (Zero IP Leak)         ▼            ▼
                     ┌───────────────┐  ┌─────────────────────┐
                     │ Pinata / IPFS │  │ Merkle Tree Root    │
                     └───────┬───────┘  └──────────┬──────────┘
                             │ CID                 │ Root
                             └──────────┬──────────┘
                                        ▼
                     ┌─────────────────────────────────────┐
                     │       SubmissionRegistry.sol        │
                     │  (On-Chain Evidence Anchoring)      │
                     └──────────────────┬──────────────────┘
                                        │ Submission ID
                                        ▼
                     ┌─────────────────────────────────────┐
                     │        ArbitratedBounty.sol         │
                     │  (HTLC Escrow + Dispute Adapter)    │
                     └───────┬─────────────────────┬───────┘
            Funds Bounty     │                     │ Disputes Evidence
                             ▼                     ▼
                     ┌───────────────┐     ┌─────────────────────────────────────┐
                     │   HTLC.sol    │     │        SchellingVoting.sol          │
                     └───────────────┘     │  (Commit-Reveal Consensus Machine)  │
                                           └───────▲─────────────────────▲───────┘
                                                   │ Random Jurors       │ Staking / Slashing
                                                   │                     │
                                     ┌─────────────┴──────┐       ┌──────┴──────────────┐
                                     │ JurorSelection.sol │       │  TokenStaking.sol   │
                                     │  (Chainlink VRF)   │       │(ITokenStakingLocks) │
                                     └────────────────────┘       └─────────────────────┘
```

### Phase 1: Foundations, Storage & Escrow
- **`SubmissionRegistry`**: Immutable registry linking IPFS CIDs and 32-byte Merkle roots to unique submission IDs.
- **`TokenStaking`**: ETH staking contract providing fundamental balance tracking and reentrancy-guarded deposits/withdrawals.
- **`HTLC`**: Classic Hash Time-Locked Contract ensuring that bounty claimants provide the correct cryptographic preimage before the timelock expiration.
- **Merkle Tree Engine (`src/merkle/`)**: High-performance Node.js implementation that calculates deterministic SHA-256 Merkle trees with proof generation and verification.

### Phase 2: ZK Identity, VRF & Schelling Arbitration
- **`CredentialRegistry`**: Manages anonymous group identities using Semaphore v4 zero-knowledge proofs and nullifiers to prevent duplicate bounty claims or double registration.
- **`JurorSelection`**: Requests verifiable randomness from Chainlink VRF v2.5 to randomly sample staked jurors while excluding both the submitter and disputer.
- **`SchellingVoting`**: Coordinates commit-reveal phases, aggregates juror votes (REAL, FAKE, or INCONCLUSIVE), slashes non-revealing and minority jurors, and rewards the consensus cohort.
- **`ArbitratedBounty`**: Bridges HTLC bounty escrow with `SchellingVoting`. Automatically claims or refunds bounties based on dispute outcomes.

### Privacy & Network Anonymity (Tor & Proxy)
- **Privacy Upload Proxy (`src/server.js`)**: An Express-based upload intermediary running strictly on `127.0.0.1`. Holds files in memory buffer, enforces file size caps (50 MB), and relays payloads to Pinata IPFS without leaking whistleblower IP addresses, browser fingerprints, or API secrets.
- **Tor Hidden Service (`src/tor/torrc`)**: Binds an `.onion` address directly to the local proxy port with `SafeLogging 1` enabled, ensuring no connection records or client metadata are logged.

---

## Protocol Workflow

### 1. Evidence Preparation & Submission
1. Whistleblower generates evidence and calculates the Merkle Root using the 1 MiB chunking standard.
2. The payload is sent over the **Tor Onion Service** to the local privacy proxy server.
3. The proxy pins the evidence to IPFS and returns the Content Identifier (CID).
4. Whistleblower calls `SubmissionRegistry.registerSubmission(cid, merkleRoot)`.

### 2. Bounty Funding & Arbitration Safeguards
1. Funder deposits ETH into `ArbitratedBounty.fundBounty()` specifying submission ID, beneficiary address/credential, and timelock window.
2. Funds are held in escrow. If unchallenged, the whistleblower claims the bounty by revealing the preimage.

### 3. Dispute Resolution Lifecycle
1. Any participant can dispute a submission by staking ETH and triggering `createDispute()`.
2. `JurorSelection` requests verifiable randomness from **Chainlink VRF v2.5**.
3. Random staked jurors are drawn from `TokenStaking` and locked for the dispute duration.
4. **Commit Phase (24 hours):** Jurors submit salted vote hashes: `keccak256(disputeId || juror || vote || salt)`.
5. **Reveal Phase (24 hours):** Jurors reveal their actual vote and salt.
6. **Finalization:**
   - Consensus outcome is established (REAL vs. FAKE).
   - Dissenting and unrevealed jurors are slashed; honest consensus jurors receive reward shares.
   - `ArbitratedBounty` unlocks funds to the whistleblower (if verified REAL) or refunds the funder (if ruled FAKE).

---

## Repository Structure

```
verileaks/
├── contracts/                   # Solidity Smart Contracts (0.8.24)
│   ├── ArbitratedBounty.sol     # Bounty escrow & dispute orchestration
│   ├── CredentialRegistry.sol   # Semaphore ZK identity & nullifier tracking
│   ├── HTLC.sol                 # Hash Time-Locked Contract
│   ├── JurorSelection.sol       # Chainlink VRF v2.5 randomized jury sampling
│   ├── SchellingVoting.sol      # Commit-reveal Schelling consensus engine
│   ├── SubmissionRegistry.sol   # On-chain CID and Merkle root anchoring
│   ├── TokenStaking.sol         # Juror staking, locking, and slashing
│   └── interfaces/              # Protocol interfaces (IHTLC, ISchellingVoting, etc.)
├── script/                      # Foundry Deployment & Migration Scripts
│   ├── Deploy.s.sol             # Phase 1 Deployment Script
│   └── Phase2Deploy.s.sol       # Phase 2 Complete Protocol Deployment (Arbitrum)
├── test/                        # Solidity Test Suites (63 tests)
│   ├── HTLC.t.sol               # HTLC unit and fuzz tests
│   ├── SubmissionRegistry.t.sol # Submission registry unit and fuzz tests
│   ├── TokenStaking.t.sol       # Staking and slashing security tests
│   ├── Phase1Integration.t.sol  # End-to-end Phase 1 integration tests
│   └── Phase2Integration.t.sol  # End-to-end Phase 2 arbitration integration tests
├── src/                         # Off-Chain Infrastructure & Libraries (42 tests)
│   ├── merkle/                  # Merkle Tree generator and proof verifier
│   ├── storage/                 # Storage abstractions (Pinata & Mock providers)
│   ├── tor/                     # Tor configuration (torrc)
│   ├── server.js                # Privacy-preserving upload proxy
│   ├── server.test.js           # Proxy security and health-check tests
│   ├── workflow.js              # Command-line workflow demo
│   └── integration.test.js      # Off-chain pipeline integration tests
├── docs/                        # Specifications & Audit Artifacts
│   └── audit/                   # Comprehensive Phase 1 & 2 audit reports
├── foundry.toml                 # Foundry build configuration (Shanghai EVM target)
├── package.json                 # Node.js dependencies & test scripts
└── .env.example                 # Environment configuration template
```

---

## Smart Contracts

| Contract | Purpose | Key Functions |
|---|---|---|
| [`SubmissionRegistry.sol`](contracts/SubmissionRegistry.sol) | Immutable evidence anchor | `registerSubmission()`, `getSubmission()` |
| [`TokenStaking.sol`](contracts/TokenStaking.sol) | ETH staking & lock management | `stake()`, `unstake()`, `lockStake()`, `slashStake()`, `unlockStake()` |
| [`HTLC.sol`](contracts/HTLC.sol) | Time-locked escrow | `fundBounty()`, `claim()`, `refund()` |
| [`CredentialRegistry.sol`](contracts/CredentialRegistry.sol) | Semaphore ZK identity | `createGroup()`, `addMember()`, `verifyProofAndNullify()` |
| [`JurorSelection.sol`](contracts/JurorSelection.sol) | VRF v2.5 juror selection | `requestJurors()`, `fulfillRandomWords()` |
| [`SchellingVoting.sol`](contracts/SchellingVoting.sol) | Dispute consensus engine | `commitVote()`, `revealVote()`, `finalize()` |
| [`ArbitratedBounty.sol`](contracts/ArbitratedBounty.sol) | Escrow arbitration adapter | `fundBounty()`, `dispute()`, `settle()` |

---

## Off-Chain Services & Tooling

### 1. Merkle Tree Engine (`src/merkle/`)
- Implements RFC-compliant domain-separated hashing:
  - Leaf node: `SHA256(0x00 || chunk_bytes)`
  - Branch node: `SHA256(0x01 || left_child || right_child)`
- Guarantees strict determinism across different platforms and file sizes.

### 2. Privacy-Preserving Upload Proxy (`src/server.js`)
- Exposes `POST /api/upload` and `GET /api/health`.
- Binds strictly to `127.0.0.1:3000`.
- Holds uploaded file streams exclusively in RAM buffers using Multer (`memoryStorage`), capping payload size at 50 MB.
- Relays data directly to Pinata IPFS without logging client IP addresses, headers, or internal credentials.

### 3. Tor Hidden Service (`src/tor/torrc`)
- Forwards hidden service port 80 to `127.0.0.1:3000`.
- Configured with `ExitRelay 0`, `RelayBandwidthRate 0`, and `SafeLogging 1`.

---

## Prerequisites & Installation

### Prerequisites
- **Node.js**: v18.x or v20.x+
- **Foundry Toolchain**: `forge`, `cast`, `anvil` ([Installation Guide](https://getfoundry.sh/))
- **Git**
- Optional: **Tor daemon** (`tor`) for live `.onion` routing.

### Installation

```bash
# 1. Clone repository
git clone https://github.com/Sandesh032/verileaks.git
cd verileaks

# 2. Install Foundry dependencies
forge install

# 3. Install Node.js dependencies
npm install

# 4. Set up environment configuration
cp .env.example .env
```

---

## Environment Configuration

Edit `.env` with your deployment parameters:

```env
# ── Ethereum / Foundry ──────────────────────────────────────────────────────
PRIVATE_KEY=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545

# ── IPFS / Pinata (Optional for local testing; Mock provider used by default) ──
PINATA_API_URL=https://api.pinata.cloud
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret

# ── Phase 2: Arbitrum Sepolia Setup ─────────────────────────────────────────
SEMAPHORE_ADDRESS=0x3889927F0B5Eb1a02C6E2C20b38a1Bb9E68DCE46
VRF_COORDINATOR=0x5CE8D5A2BC84beb22a398CCA51996F7930313D61
VRF_KEY_HASH=0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c9ed2cb5a8553610deefb0c
VRF_SUB_ID=your_chainlink_vrf_subscription_id
```

---

## Running Tests

The test suite validates contract correctness, edge cases, gas consumption, fuzzing, and off-chain tooling.

### 1. Smart Contract Test Suite (Foundry)
```bash
# Run all 63 Solidity tests
forge test -vv

# Run tests with gas report
forge test --gas-report

# Run specific test suites
forge test --match-path test/Phase2Integration.t.sol -vv
forge test --match-path test/HTLC.t.sol -vv
```

**Result:** `63 passed, 0 failed` across 5 suites.

### 2. Off-Chain & Integration Test Suite (Jest)
```bash
# Run all 42 JavaScript tests
npm test

# Run individual modules
npm run test:merkle       # Merkle tree & proof tests
npm run test:storage      # Storage provider tests
npx jest src/server.test.js # Privacy proxy & health tests
```

**Result:** `42 passed, 0 failed` across 4 suites.

### 3. Interactive Workflow Demonstration
```bash
# Run end-to-end evidence workflow with simulated IPFS
node src/workflow.js

# Run with live Pinata IPFS (requires PINATA credentials in .env)
node src/workflow.js --real-ipfs
```

---

## Local Deployment & Verification

### Deploying to Local Anvil Node

1. **Start Anvil:**
   ```bash
   anvil --port 8545 --chain-id 31337
   ```

2. **Deploy Phase 1 Contracts:**
   ```bash
   forge script script/Deploy.s.sol \
     --rpc-url http://127.0.0.1:8545 \
     --broadcast \
     --legacy
   ```

3. **Deploy Phase 2 Contracts:**
   ```bash
   forge script script/Phase2Deploy.s.sol \
     --rpc-url http://127.0.0.1:8545 \
     --broadcast \
     --legacy
   ```

### Deploying to Arbitrum Sepolia
```bash
forge script script/Phase2Deploy.s.sol \
  --rpc-url arbitrum_sepolia \
  --broadcast \
  --verify
```

---

## Security Model & Threat Mitigations

| Threat | Severity | Architecture Mitigation |
|---|---|---|
| **Whistleblower IP Tracing** | Critical | Evidence uploaded via Tor Hidden Service to local memory-only proxy; no direct IPFS client connection. |
| **Bounty Double-Claiming** | High | HTLC state checks (`claimed` flag) and Semaphore ZK nullifiers prevent replay attacks. |
| **Juror Collusion / Bribery** | High | Chainlink VRF v2.5 provides unpredictable juror selection; commit-reveal hides votes until reveal deadline. |
| **Reentrancy Attacks** | High | Checks-Effects-Interactions strictly maintained; external token and staking interactions emit events prior to state modification. |
| **Denial of Service (DoS)** | Medium | Jury size strictly capped (`MAX_JURY = 15`); loops are bounded; gas limits verified. |
| **Front-Running Vote Reveals** | Medium | Salted hash commitments (`keccak256(disputeId \|\| juror \|\| vote \|\| salt)`) ensure votes cannot be copied in the mempool. |
| **L2 EVM Incompatibilities** | Medium | `foundry.toml` explicitly sets `evm_version = "shanghai"` to avoid unsupported Cancun opcodes (`MCOPY`, `TLOAD`) on Arbitrum. |

---

## Audit & Compliance Status

The codebase underwent a targeted audit and remediation pass:
- **Baseline Audit:** Documented in [`docs/audit/phase1-phase2-baseline.md`](docs/audit/phase1-phase2-baseline.md).
- **Remediated Findings:**
  - **F-001 (Missing Tor Infrastructure):** Remediated via `src/tor/torrc` configuration and server-side isolation.
  - **F-002 (Pinata IP Exposure):** Remediated via `src/server.js` reverse proxy and automated tests.
  - **F-003 (Phase 2 Deployment Scripts):** Completed via `script/Phase2Deploy.s.sol`.
  - **F-004 (Arbitrum RPC Config):** Configured in `foundry.toml`.
  - **Compiler Warnings:** Resolved uninitialized variables and reentrancy event orderings.
- **Detailed Findings & Traceability Matrix:**
  - [`docs/audit/findings.md`](docs/audit/findings.md)
  - [`docs/audit/requirements-matrix.md`](docs/audit/requirements-matrix.md)
  - [`docs/audit/final-audit-report.md`](docs/audit/final-audit-report.md)

---

## Phase 3 Roadmap

The upcoming Phase 3 milestone will introduce:
- [ ] **React / Web3 User Interface**: Whistleblower submission portal, juror dashboard, and bounty crowdfunding UI.
- [ ] **Automated Watchtowers**: Off-chain daemons monitoring mempool activity and automated HTLC claims.
- [ ] **Filecoin Storage Persistence**: Decentralized, long-term archival storage deals.
- [ ] **Testnet & Mainnet Verification**: Live multi-party dispute drills on Arbitrum One.

---

## License

This project is licensed under the [MIT License](LICENSE).
