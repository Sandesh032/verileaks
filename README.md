# VeriLeaks

> **Decentralized Whistleblower Evidence Bounty Protocol**  
> Cryptographic evidence integrity, zero-knowledge identity, randomized arbitration, and trustless bounty escrow.

[![Solidity Tests](https://img.shields.io/badge/Foundry%20Tests-64%20passed-brightgreen)](#running-tests)
[![Jest Tests](https://img.shields.io/badge/Jest%20Tests-67%20passed-brightgreen)](#running-tests)
[![Solidity Version](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![Network](https://img.shields.io/badge/Target%20EVM-Arbitrum%20(Shanghai)-orange)](https://arbitrum.io/)
[![Audit Status](https://img.shields.io/badge/Audit-Phase%203%20Verified%20%26%20Audited-success)](docs/audit/phase3-security-audit.md)

---

## Table of Contents

- [Overview](#overview)
- [Core Architecture](#core-architecture)
  - [Phase 1: Foundations, Storage & Escrow](#phase-1-foundations-storage--escrow)
  - [Phase 2: ZK Identity, VRF & Schelling Arbitration](#phase-2-zk-identity-vrf--schelling-arbitration)
  - [Phase 3: Watchtowers, React DApp & Simulation](#phase-3-watchtowers-react-dapp--simulation)
  - [Privacy & Network Anonymity (Tor & Proxy)](#privacy--network-anonymity-tor--proxy)
- [Protocol Workflow](#protocol-workflow)
- [Repository Structure](#repository-structure)
- [Smart Contracts](#smart-contracts)
- [Watchtower Network](#watchtower-network)
- [React Decentralized Application](#react-decentralized-application)
- [Prerequisites & Installation](#prerequisites--installation)
- [Environment Configuration](#environment-configuration)
- [Running Tests](#running-tests)
- [Local Deployment & Verification](#local-deployment--verification)
- [Security Model & Threat Mitigations](#security-model--threat-mitigations)
- [Audit & Compliance Status](#audit--compliance-status)
- [Roadmap & Limitations](#roadmap--limitations)
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

### Phase 3: Watchtowers, React DApp & Simulation
- **Watchtower Network (`src/watchtower/`)**: Distributed off-chain monitoring daemon and rules engine. Detects elapsed deadlines (`FINALIZE_DISPUTE`, `CANCEL_TIMEOUT_DISPUTE`, `SETTLE_BOUNTY`, `REFUND_BOUNTY`), performs on-chain preflight checks to prevent race conditions, and persists checkpoints atomically.
- **Multi-Node Cluster (`MultiNodeCoordinator.js`)**: Coordinates 3 independent watchtower instances on isolated HTTP ports (`9101`, `9102`, `9103`) with separate data directories, proving concurrent monitoring, restart recovery, and double-action prevention.
- **React Decentralized Application (`frontend/`)**: Modern Web3 application with dedicated tabs for Evidence Submission, Merkle Verification, Bounty Escrow, Juror Staking, Commit-Reveal Arbitration, and Cluster Health Monitoring.
- **End-to-End Simulation (`src/e2e.test.js`)**: Automated full protocol lifecycle test demonstrating synthetic evidence submission, ZK credential binding, bounty funding, dispute arbitration, automated watchtower resolution, and fault recovery.

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

## Pr### 1. Smart Contract Test Suite (Foundry)
```bash
# Run all 64 Solidity tests
forge test -vv

# Run tests with gas report
forge test --gas-report

# Run specific integration suites
forge test --match-path test/Phase2Integration.t.sol -vv
forge test --match-path test/DeployAll.t.sol -vv
forge test --match-path test/HTLC.t.sol -vv
```

**Result:** `64 passed, 0 failed` across 6 suites.

### 2. Off-Chain & Integration Test Suite (Jest)
```bash
# Run all 67 JavaScript tests (unit, integration, watchtower, frontend, and e2e)
npm test

# Run individual modules
npm run test:merkle       # Merkle tree & proof tests
npm run test:storage      # Storage provider tests
npm run test:watchtower   # Watchtower persistence & rules tests
npm run test:e2e          # Full protocol lifecycle end-to-end simulation
```

**Result:** `67 passed, 0 failed` across 7 suites.

---

## Watchtower Network

The VeriLeaks watchtower network ensures protocol liveness by monitoring dispute deadlines and executing permissionless state transitions (`finalize`, `cancelDispute`, `settle`, `refund`).

```bash
# Run single watchtower node (read-only monitoring by default)
npm run watchtower

# Run 3-node simulated cluster (isolated local stores, ports 9101, 9102, 9103)
npm run watchtower:cluster
```

### Health & Monitoring Endpoints
Each watchtower node exposes HTTP inspection endpoints:
- `GET http://127.0.0.1:9101/health` — Node uptime and sync state
- `GET http://127.0.0.1:9101/status` — Tracked disputes, bounties, and checkpoint
- `GET http://127.0.0.1:9101/alerts` — Operational and security alerts log

---

## React Decentralized Application

The frontend is a modern, responsive Web3 application built with Vite and React.

```bash
# Start local development server (http://localhost:5173)
npm run frontend:dev

# Build production bundle
npm run frontend:build

# Preview production build
npm run frontend:preview
```

### Key DApp Features:
1. **Overview & Protocol Lifecycle:** Comprehensive disclosure of protocol guarantees, prototype status, and privacy limits.
2. **Whistleblower Submission:** Client-side 1 MiB chunking with domain-separated SHA-256 Merkle root computation, privacy proxy upload, and on-chain registration.
3. **Bounties Escrow:** Funding arbitrated bounties, inspecting timelocks, and executing pull-payment payouts.
4. **Juror Staking:** Staking/unstaking ETH on `TokenStaking`.
5. **Arbitration Interface:** Inspecting active cases, generating salted vote commitments, and submitting cleartext reveals.
6. **Watchtower Dashboard:** Live cluster health polling (nodes 9101, 9102, 9103) with alert stream display.

---

## Local Deployment & Verification

### Unified Protocol Deployment (`DeployAll.s.sol`)

Deploy all Phase 1 + Phase 2 contracts and wire roles in a single atomic transaction sequence:

```bash
# 1. Start local Anvil instance
anvil --port 8545 --chain-id 31337

# 2. Deploy complete protocol and generate deployments.json
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --tc DeployAll
```

This writes `deployments.json`, which is automatically loaded by both the watchtower CLI and the React DApp.

### Deploying to Arbitrum Sepolia
```bash
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url arbitrum_sepolia \
  --broadcast \
  --tc DeployAll \
  --verify
```

---

## Security Model & Threat Mitigations

| Threat | Severity | Architecture Mitigation |
|---|---|---|
| **Whistleblower IP Tracing** | Critical | Evidence uploaded via Tor Hidden Service to local memory-only proxy; no direct IPFS client connection. |
| **Bounty Double-Claiming** | High | HTLC state checks (`claimed` flag) and Semaphore ZK nullifiers prevent replay attacks. |
| **Juror Collusion / Bribery** | High | Chainlink VRF v2.5 provides unpredictable juror selection; commit-reveal hides votes until reveal deadline. |
| **Reentrancy Attacks** | High | OpenZeppelin `ReentrancyGuard` on all state-mutating functions; pull-payments (`pendingPayout`) prevent reentrancy during settlement. |
| **Watchtower Replay / Race Conditions** | Medium | On-chain preflight checks verify contract state before transaction submission; duplicate actions safely skipped. |
| **Front-Running Vote Reveals** | Medium | Salted hash commitments (`keccak256(disputeId \|\| juror \|\| vote \|\| salt)`) ensure votes cannot be copied in the mempool. |
| **L2 EVM Incompatibilities** | Medium | `foundry.toml` explicitly sets `evm_version = "shanghai"` to avoid unsupported Cancun opcodes (`MCOPY`, `TLOAD`) on Arbitrum. |

---

## Audit & Compliance Status

The codebase has undergone a full Phase 3 security review:
- **Phase 3 Security & Privacy Audit:** [`docs/audit/phase3-security-audit.md`](docs/audit/phase3-security-audit.md)
- **Requirements Traceability Matrix:** [`docs/audit/requirements-matrix.md`](docs/audit/requirements-matrix.md)
- **Phase 3 Architecture Specification:** [`docs/phase3-architecture.md`](docs/phase3-architecture.md)
- **Watchtower Network Specification:** [`docs/watchtower.md`](docs/watchtower.md)

---

## Roadmap & Limitations

### Completed Deliverables (Phases 1–3)
- [x] On-chain Evidence Registry, Staking, and HTLC Escrow (Phase 1)
- [x] Semaphore ZK Credentials, Tor Privacy Proxy, Chainlink VRF, Schelling Voting, and Arbitrated Bounty (Phase 2)
- [x] Multi-Node Watchtower Network, React DApp, and E2E Simulation (Phase 3)

### Known Limitations & Operational Requirements
1. **Public IPFS vs. Encryption:** While the privacy upload proxy shields client IP addresses, data pinned to IPFS gateways is publicly retrievable if the CID is known. Sensitive documents must be encrypted client-side prior to submission.
2. **Local Multi-Node Simulation:** Multi-node simulation running on localhost demonstrates software independence and concurrency safety, but does not provide geographic or administrative decentralization.
3. **Live Testnet Randomness:** In production or live Arbitrum Sepolia testing, Chainlink VRF requires an active LINK token subscription and coordinator fulfillment.

---

## License

This project is licensed under the [MIT License](LICENSE).

