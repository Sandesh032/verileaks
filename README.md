# VeriLeaks

> **Decentralized Whistleblower Evidence Bounty Protocol**  
> Cryptographic evidence integrity, zero-knowledge identity, randomized 3-of-5 VRF jury arbitration, gated evidence verification, strict role-based access control, and automated watchtower settlement.

[![Solidity Tests](https://img.shields.io/badge/Foundry%20Tests-64%20passed-brightgreen)](#running-tests)
[![Jest Tests](https://img.shields.io/badge/Jest%20Tests-67%20passed-brightgreen)](#running-tests)
[![Solidity Version](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![Network](https://img.shields.io/badge/Target%20EVM-Arbitrum%20(Shanghai)-orange)](https://arbitrum.io/)
[![Audit Status](https://img.shields.io/badge/Audit-Phase%203%20Verified%20%26%20Audited-success)](docs/audit/phase3-security-audit.md)

---

## Table of Contents

- [Overview](#overview)
- [Quick Start (Single-Command Full Stack)](#quick-start-single-command-full-stack)
- [Core Architecture](#core-architecture)
  - [Phase 1: Foundations, Storage & Escrow](#phase-1-foundations-storage--escrow)
  - [Phase 2: ZK Identity, VRF & Schelling Arbitration](#phase-2-zk-identity-vrf--schelling-arbitration)
  - [Phase 3: Automated Watchtowers, RBAC React DApp & Simulation](#phase-3-automated-watchtowers-rbac-react-dapp--simulation)
  - [Privacy & Network Anonymity (Tor & Proxy)](#privacy--network-anonymity-tor--proxy)
- [End-to-End Protocol Workflow](#end-to-end-protocol-workflow)
- [Role-Based Access Control (RBAC) & Phase-Gate Matrix](#role-based-access-control-rbac--phase-gate-matrix)
- [Juror Slashing & Incentive Parameters](#juror-slashing--incentive-parameters)
- [Repository Structure](#repository-structure)
- [Smart Contracts](#smart-contracts)
- [Off-Chain Services & Tooling](#off-chain-services--tooling)
- [Watchtower Network](#watchtower-network)
- [React Decentralized Application](#react-decentralized-application)
- [Prerequisites & Installation](#prerequisites--installation)
- [Running Tests](#running-tests)
- [Local Deployment & Verification](#local-deployment--verification)
- [Security Model & Threat Mitigations](#security-model--threat-mitigations)
- [Audit & Compliance Status](#audit--compliance-status)
- [Roadmap & Limitations](#roadmap--limitations)
- [License](#license)

---

## Overview

**VeriLeaks** is an open-source decentralized protocol engineered to protect whistleblowers while ensuring evidence authenticity and fair economic compensation. Organizations or investigative funders can post open case bounties locked in trustless escrow, and whistleblowers can submit confidential evidence, prove cryptographic integrity, and claim bounties after decentralized jury verification—without exposing their real-world identities or IP metadata.

### Key Innovations:
1. **Open Case Bounty Escrow & HTLC Adapter:** Funders lock ETH in a Hash Time-Locked Contract (`HTLC.sol`) governed by an arbitration escrow adapter (`ArbitratedBounty.sol`), giving whistleblowers cryptographic proof that reward funds are locked before they take the risk of submitting evidence.
2. **Deterministic Merkle Integrity:** Evidence is chunked into 1 MiB segments with RFC-compliant leaf-level domain separation (`0x00`) and branch node separation (`0x01`), anchoring 32-byte SHA-256 roots on-chain.
3. **Zero-Knowledge Whistleblower & Juror Identity:** Integrates Semaphore v4 zero-knowledge proofs (`CredentialRegistry.sol`) to verify group membership and bind nullifiers without revealing public keys or wallet histories.
4. **Provably Fair 3-of-5 VRF Juror Sampling & Gated Evidence Access:** Powered by Chainlink VRF v2.5 (`JurorSelection.sol`) to randomly draw **3 active jurors out of a 5-juror staked pool** per dispute. Only the 3 VRF-selected jurors are authorized to download the confidential evidence file, verify its Merkle root, and vote; the remaining 2 unselected jurors have zero authorization for that case.
5. **Two-Phase Schelling Point Consensus & Slashing:** Dispute resolution (`SchellingVoting.sol`) with strict Commit and Reveal phase gates, slashing untrue/minority voters (`25%`) and non-revealing jurors (`50%`) and redistributing 100% of the penalty pool to the honest majority jurors.
6. **Zero-Click Automated Watchtower Settlement:** A 3-node watchtower cluster (`WatchtowerWorker.js`) continuously monitors on-chain events and automatically executes `finalize()`, `settle()`, and `refund()` transactions as soon as voting or timelock conditions are met.
7. **Network Privacy:** Local memory-buffered reverse proxy (`src/server.js`) and Tor Hidden Service (`src/tor/torrc`) routing that decouples clients from third-party IPFS storage providers (e.g., Pinata).

---

## Quick Start (Single-Command Full Stack)

You can launch the entire interactive stack—including the **Stateful Local EVM RPC (`127.0.0.1:8545`)**, **Privacy Upload Proxy (`127.0.0.1:3000`)**, **3-Node Automated Watchtower Cluster (`127.0.0.1:9101–9103`)**, and **React Web3 DApp (`http://127.0.0.1:5173`)**—with a single command:

```powershell
# 1. Install root and frontend dependencies (.npmrc enables allow-git=all for npm v12+)
npm install
npm --prefix frontend install

# 2. Launch all 4 services together
npm start
# (or: node start-all.js)
```

Then open **http://127.0.0.1:5173** in your browser. Use the built-in **Active Role Switcher** and **`🔄 Reset Demo Data`** button in the top navigation bar to test the full multi-wallet lifecycle without requiring external browser extensions.

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
           Pins to IPFS         │            │ Chunking & Merkle Root (1 MiB SHA-256)
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
            Funds Bounty     │                     │ Challenges / Verifies Evidence
                             ▼                     ▼
                     ┌───────────────┐     ┌─────────────────────────────────────┐
                     │   HTLC.sol    │     │        SchellingVoting.sol          │
                     └───────────────┘     │  (Commit-Reveal Consensus Machine)  │
                                           └───────▲─────────────────────▲───────┘
                                                   │ 3-of-5 Random Jury  │ Staking / Slashing
                                                   │                     │
                                     ┌─────────────┴──────┐       ┌──────┴──────────────┐
                                     │ JurorSelection.sol │       │  TokenStaking.sol   │
                                     │  (Chainlink VRF)   │       │(ITokenStakingLocks) │
                                     └────────────────────┘       └─────────────────────┘
                                                   ▲
                                                   │ Automated finalize() & settle()
                                     ┌─────────────┴──────────────────────┐
                                     │ 3-Node Watchtower Cluster (:9101+) │
                                     └────────────────────────────────────┘
```

### Phase 1: Foundations, Storage & Escrow
- **`SubmissionRegistry`**: Immutable registry linking IPFS CIDs and 32-byte Merkle roots to unique submission IDs.
- **`TokenStaking`**: ETH staking contract providing balance tracking (`balanceOf`, `lockedOf`, `freeBalanceOf`), dispute stake locking, and reentrancy-guarded deposits/withdrawals.
- **`HTLC`**: Classic Hash Time-Locked Contract ensuring that bounty claimants provide the correct cryptographic preimage before the timelock expiration.
- **Merkle Tree Engine (`src/merkle/`)**: Node.js and browser WebCrypto implementation that calculates deterministic 1 MiB SHA-256 Merkle trees with proof generation and verification.

### Phase 2: ZK Identity, VRF & Schelling Arbitration
- **`CredentialRegistry`**: Manages anonymous group identities using Semaphore v4 zero-knowledge proofs and scoped nullifiers to prevent duplicate registrations or Sybil attacks.
- **`JurorSelection`**: Requests verifiable randomness from Chainlink VRF v2.5 to randomly sample 3 staked jurors from the 5-juror pool while excluding conflict-of-interest addresses (submitter and disputer).
- **`SchellingVoting`**: Coordinates 24-hour Commit and 24-hour Reveal phases, aggregates juror votes (`REAL`, `FAKE`, or `INCONCLUSIVE`), slashes non-revealing and minority jurors, and rewards the consensus majority.
- **`ArbitratedBounty`**: Bridges HTLC bounty escrow with `SchellingVoting`. Automatically releases or refunds bounties based on finalized arbitration verdicts using pull-payments (`pendingPayout`).

### Phase 3: Automated Watchtowers, RBAC React DApp & Simulation
- **Watchtower Network (`src/watchtower/`)**: Distributed off-chain monitoring daemon and rules engine (`WatchtowerRules.js`). Detects elapsed deadlines and completed reveal phases (`FINALIZE_DISPUTE`, `CANCEL_TIMEOUT_DISPUTE`, `SETTLE_BOUNTY`, `REFUND_BOUNTY`), performs on-chain preflight checks to prevent race conditions, and persists checkpoints atomically.
- **Multi-Node Cluster (`MultiNodeCoordinator.js`)**: Coordinates 3 independent watchtower instances on isolated HTTP ports (`9101`, `9102`, `9103`) with `Watchtower Node 1` configured as an active automated transaction executor.
- **React Decentralized Application (`frontend/`)**: Modern Web3 application with strict Role-Based Access Control (RBAC), built-in 7-account role switcher (`Bounty Funder`, `Whistleblower`, `Juror 1–5`), VRF-gated confidential file download & client-side Merkle verification, and live slashing tables.

### Privacy & Network Anonymity (Tor & Proxy)
- **Privacy Upload Proxy (`src/server.js`)**: An Express-based upload intermediary running strictly on `127.0.0.1:3000`. Holds files in RAM buffer (`multer.memoryStorage()`), enforces a 50 MB size cap, and relays payloads to Pinata IPFS (or `MockStorageProvider` in local mode) without leaking whistleblower IP addresses or API secrets.
- **Tor Hidden Service (`src/tor/torrc`)**: Binds an `.onion` address directly to the local proxy port with `SafeLogging 1` enabled.

---

## End-to-End Protocol Workflow

### 1. Open Case Bounty Funding (`1. Bounties & Escrow`)
1. The **`🏦 Bounty Funder`** posts an investigation case description and deposits ETH (e.g., `1.5 ETH`) into `ArbitratedBounty.fundBounty()` with an HTLC timelock window.
2. Funds are locked on-chain. The Funder is strictly prevented from unilaterally refunding an active bounty while it is open.

### 2. Confidential Evidence Submission (`2. Submit Evidence`)
1. The **`🕵️ Whistleblower`** inspects the open funded bounties, verifies that the ETH reward is locked in escrow, and selects the target bounty case.
2. The client chunks the evidence file into 1 MiB segments, computes the domain-separated SHA-256 Merkle root, uploads the file via the **Privacy Upload Proxy (`127.0.0.1:3000`)** to obtain an IPFS `CID`, and calls `SubmissionRegistry.registerSubmission(cid, merkleRoot)` to anchor the evidence and link it to the bounty.

### 3. Dispute Initiation & 3-of-5 Chainlink VRF Jury Selection
1. Once evidence is attached, the **`🏦 Bounty Funder`** triggers `openDispute()` to initiate decentralized verification.
2. **Chainlink VRF v2.5** randomly selects **3 jurors out of the 5 staked jurors (`Juror 1`–`Juror 5`)** and locks `1.000 ETH` of stake (`stakePerJuror`) from each of the 3 selected jurors in `TokenStaking.sol`.
3. The remaining **2 unselected jurors** have `0 ETH` locked and are granted **zero authorization** to access the evidence or vote on that dispute.

### 4. VRF-Gated Evidence Download & Cryptographic Verification (`4. Arbitration & Voting`)
1. Selected VRF jurors **cannot vote blindly**—Phase 1 Commit is locked until the juror downloads and verifies the evidence file.
2. Each of the 3 VRF-selected jurors clicks **"⬇️ Step 1: Download Confidential Evidence & Verify Merkle Root"**.
3. The DApp verifies that the caller is an authorized VRF juror for that dispute, downloads the confidential document, recomputes its 1 MiB SHA-256 Merkle tree client-side, and verifies that the computed Merkle root matches the on-chain `SubmissionRegistry` root (`0 Bytes Tampered`).

### 5. Two-Phase Commit-Reveal Voting & Slashing
1. **Phase 1 — Commit Window (24 Hours):** Each of the 3 selected jurors submits a salted vote commitment hash:
   $$\text{commitment} = \text{keccak256}(\text{VOTE\_TAG} \parallel \text{chainId} \parallel \text{contract} \parallel \text{disputeId} \parallel \text{juror} \parallel \text{vote} \parallel \text{salt})$$
   Phase 2 (Reveal) remains locked until all 3 selected jurors have completed Phase 1 (`3/3 Committed`).
2. **Phase 2 — Reveal Window (24 Hours):** Because `keccak256` is one-way, automatic revealing is cryptographically impossible. Each selected juror manually reveals their cleartext `(vote, salt)` on-chain.

### 6. Automated Watchtower Finalization & Settlement (`5. Watchtower Cluster`)
1. Within ~1–2 seconds of the 3rd juror revealing (or after the 24-hour `revealDeadline` expires), **Watchtower Node 1 (`127.0.0.1:9101`)** automatically executes:
   - `SchellingVoting.finalize(disputeId)`: Tallies the revealed votes, **slashes untrue/minority jurors by `25%` (`-0.250 ETH`)** (or non-revealing jurors by **`50%` (`-0.500 ETH`)**), and redistributes 100% of the slashed pool equally to the honest majority jurors (`+0.125 ETH` each).
   - `ArbitratedBounty.settle(bountyId)`: Credits the `1.5 ETH` bounty to the **`🕵️ Whistleblower`'s** pull-payment balance (if ruled `REAL`) or refunds the **`🏦 Bounty Funder`** (if ruled `FAKE`).
2. The **`🕵️ Whistleblower`** switches to **`1. Bounties & Escrow`** and clicks **"Withdraw ETH to Wallet"** to transfer the `1.5 ETH` payout into their wallet.

---

## Role-Based Access Control (RBAC) & Phase-Gate Matrix

| Action / Control | Authorized Role(s) | Required Protocol State | Security / Conflict-of-Interest Rationale |
| :--- | :--- | :--- | :--- |
| **Post & Fund Open Bounty** | `🏦 Bounty Funder` **ONLY** | Any time | Only sponsoring organizations deposit bounty escrow. |
| **Submit Confidential Evidence** | `🕵️ Whistleblower` **ONLY** | Open funded bounty (or standalone) | Funders and Jurors are blocked from submitting leaks. |
| **Trigger VRF Jury Arbitration** | `🏦 Bounty Funder` **ONLY** | Bounty = `FUNDED` & `Evidence Submitted` | Cannot open a dispute before evidence is submitted; Jurors cannot open disputes on cases they may judge. |
| **Unilateral Refund While Active** | **NOBODY (Locked by HTLC)** | Blocked while `FUNDED` or `DISPUTED` | Prevents Funder from rug-pulling escrowed funds after a whistleblower submits evidence. |
| **Stake / Unstake in Juror Pool** | `⚖️ Juror 1–5` **ONLY** | Free Stake `> 0` for unstake | Excludes Whistleblower and Funder from entering the VRF jury pool. |
| **Download Confidential Evidence** | **3 VRF-Selected Jurors ONLY** | Dispute = `ACTIVE` & Caller in `jurorsOf(id)` | **Unselected jurors (2 of 5)** and non-jurors receive `Access Denied` when attempting to download the file. |
| **Phase 1: Commit Salted Vote** | **3 VRF-Selected Jurors ONLY** | Evidence downloaded & verified by that juror | Prevents random/blind voting and blocks the 2 unselected jurors from voting. |
| **Phase 2: Reveal Vote & Salt** | **3 VRF-Selected Jurors ONLY** | **All 3 Selected JurorsCommitted (`3/3`)** | Prevents early vote leakage while other jurors are still committing. |
| **Finalize Dispute & Settle Bounty** | **🤖 Watchtower Daemon (Automated)** | All 3 jurors revealed (`3/3`) or `revealDeadline` elapsed | Executed automatically in the background by Watchtower Node 1 (`:9101`). |
| **Withdraw Escrow Payout** | `🕵️ Whistleblower` *(or winner)* | `pendingPayout[account] > 0` | Reentrancy-safe pull-payment withdrawal. |

---

## Juror Slashing & Incentive Parameters

Each of the 5 jurors in the pool starts with **`2.000 ETH`** staked in `TokenStaking.sol`. When selected by Chainlink VRF for a dispute, **`1.000 ETH` (`stakePerJuror`)** is locked:

| Juror Outcome | Parameter (`BPS`) | % of Locked Stake (`1.0 ETH`) | ETH Delta | Resulting Total Stake |
| :--- | :--- | :--- | :--- | :--- |
| **Honest Majority Voter (2 of 3 winners)** | Consensus Reward | `+12.5%` reward (`50%` of slashed pool each) | **`+0.125 ETH`** | **`2.125 ETH`** |
| **Untrue / Minority Voter (1 of 3 dissenting)** | `minorityPenaltyBps = 2500` | **`25%` of locked stake slashed** | **`-0.250 ETH`** | **`1.750 ETH`** |
| **Non-Revealing Juror (Failed to reveal in 24h)** | `nonRevealPenaltyBps = 5000` | **`50%` of locked stake slashed** *(Protocol Cap)* | **`-0.500 ETH`** | **`1.500 ETH`** |
| **Unselected Pool Jurors (2 of 5 not drawn)** | Not Selected by VRF | `0 ETH` locked / `0%` risk | **`0.000 ETH`** | **`2.000 ETH`** |

---

## Repository Structure

```
verileaks/
├── contracts/                   # Solidity Smart Contracts (0.8.24, Shanghai EVM)
│   ├── ArbitratedBounty.sol     # Bounty escrow & dispute orchestration adapter
│   ├── CredentialRegistry.sol   # Semaphore v4 ZK identity & nullifier tracking
│   ├── HTLC.sol                 # Hash Time-Locked Contract vault
│   ├── JurorSelection.sol       # Chainlink VRF v2.5 randomized jury sampling
│   ├── SchellingVoting.sol      # Commit-reveal Schelling consensus & slashing engine
│   ├── SubmissionRegistry.sol   # On-chain CID and Merkle root anchoring
│   ├── TokenStaking.sol         # Juror staking, locking, and slashing ledger
│   └── interfaces/              # Protocol interfaces (IHTLC, ISchellingVoting, etc.)
├── frontend/                    # React 19 + Vite Web3 Decentralized Application
│   ├── src/
│   │   ├── App.jsx              # Multi-role wallet switcher, RBAC banner & navigation
│   │   ├── components/
│   │   │   ├── LandingTab.jsx   # Protocol architecture & privacy disclosures
│   │   │   ├── BountyTab.jsx    # Step 1: Open bounty funding, lookup & dispute trigger
│   │   │   ├── SubmitTab.jsx    # Step 2: 1 MiB Merkle generator & privacy proxy upload
│   │   │   ├── StakingTab.jsx   # 5-Juror VRF pool ledger & stake/unstake controls
│   │   │   ├── ArbitrationTab.jsx # VRF-gated evidence download, commit-reveal & slashing table
│   │   │   └── WatchtowerTab.jsx  # Live 3-node watchtower cluster dashboard (:9101–9103)
│   │   ├── contracts/           # Contract ABIs and aligned deployment addresses
│   │   └── utils/               # Browser WebCrypto 1 MiB Merkle tree calculator
│   └── vite.config.js           # Vite dev server (:5173) with /api proxy to :3000
├── src/                         # Off-Chain Infrastructure & Libraries (67 Jest tests)
│   ├── merkle/                  # Deterministic 1 MiB SHA-256 Merkle Tree & proof verifier
│   ├── storage/                 # Storage abstractions (Pinata & Mock providers)
│   ├── tor/                     # Tor Hidden Service configuration (torrc)
│   ├── watchtower/              # Automated 3-node watchtower worker, store & rules engine
│   ├── server.js                # Privacy-preserving memory-only upload proxy (:3000)
│   ├── workflow.js              # Command-line Phase 1 cryptographic workflow demo
│   └── e2e.test.js              # End-to-end full protocol lifecycle simulation
├── script/                      # Foundry Deployment Scripts (Deploy.s.sol, DeployAll.s.sol)
├── test/                        # Solidity Test Suites (64 Foundry unit, fuzz & integration tests)
├── docs/                        # Architecture specifications & Phase 1–3 security audit reports
├── start-all.js                 # Unified launcher for RPC (:8545), Proxy (:3000), Watchtowers (:9101+) & DApp (:5173)
├── mock-rpc.js                  # Stateful local EVM RPC engine with 5-juror VRF & gated evidence store
├── deployments.json             # Local Chain ID 31337 contract address manifest
├── foundry.toml                 # Foundry build configuration (Shanghai EVM target)
├── .npmrc                       # npm v12+ git dependency configuration (allow-git=all)
└── package.json                 # Node.js dependencies & scripts
```

---

## Smart Contracts

| Contract | Purpose | Key Functions |
|---|---|---|
| [`SubmissionRegistry.sol`](contracts/SubmissionRegistry.sol) | Immutable evidence anchor | `registerSubmission()`, `getSubmission()`, `submissionExists()` |
| [`TokenStaking.sol`](contracts/TokenStaking.sol) | ETH staking & lock management | `stake()`, `unstake()`, `lockStake()`, `slashStake()`, `unlockStake()`, `lockedOf()` |
| [`HTLC.sol`](contracts/HTLC.sol) | Time-locked escrow vault | `fundBounty()`, `claim()`, `refund()` |
| [`CredentialRegistry.sol`](contracts/CredentialRegistry.sol) | Semaphore v4 ZK identity | `registerGroup()`, `registerCredentials()`, `useCredential()` |
| [`JurorSelection.sol`](contracts/JurorSelection.sol) | VRF v2.5 3-of-N juror selection | `registerJuror()`, `requestSelection()`, `rawFulfillRandomWords()` |
| [`SchellingVoting.sol`](contracts/SchellingVoting.sol) | Dispute consensus & slashing engine | `commitVote()`, `revealVote()`, `finalize()`, `commitmentFor()`, `resultOf()` |
| [`ArbitratedBounty.sol`](contracts/ArbitratedBounty.sol) | Escrow arbitration adapter | `fundBounty()`, `openDispute()`, `settle()`, `refund()`, `withdraw()` |

---

## Off-Chain Services & Tooling

### 1. Merkle Tree Engine (`src/merkle/MerkleTree.js`)
- Splits files into `1 MiB` (`1,048,576` byte) chunks and implements RFC-compliant domain-separated hashing:
  - Leaf node: `SHA256(0x00 || chunk_bytes)`
  - Branch node: `SHA256(0x01 || left_child || right_child)`
- Prevents second-preimage attacks and guarantees strict determinism across Node.js and browser WebCrypto.

### 2. Privacy-Preserving Upload Proxy (`src/server.js`)
- Exposes `POST /api/upload` and `GET /api/health` on `127.0.0.1:3000`.
- Holds uploaded file streams exclusively in RAM buffers using Multer (`memoryStorage`), capping payload size at 50 MB.
- Relays data to Pinata IPFS (or falls back to `MockStorageProvider` in local dev) without logging client IP addresses, headers, or internal credentials.

### 3. Tor Hidden Service (`src/tor/torrc`)
- Forwards hidden service port 80 to `127.0.0.1:3000` with `ExitRelay 0`, `RelayBandwidthRate 0`, and `SafeLogging 1`.

---

## Watchtower Network

The VeriLeaks watchtower network ensures protocol liveness by monitoring dispute states and executing permissionless state transitions (`finalize`, `cancelDispute`, `settle`, `refund`).

```powershell
# Run single watchtower node
npm run watchtower

# Run 3-node cluster (Node 1 active executor on :9101, Standby/Audit nodes on :9102 & :9103)
npm run watchtower:cluster
```

### Health & Monitoring Endpoints
Each watchtower node exposes HTTP inspection endpoints:
- `GET http://127.0.0.1:9101/health` — Node uptime, sync status, and block checkpoint
- `GET http://127.0.0.1:9101/status` — Tracked disputes, bounties, and chain ID
- `GET http://127.0.0.1:9101/alerts` — Operational and `[ACTION]` transaction stream log

---

## React Decentralized Application

The frontend is a responsive Web3 application built with Vite and React 19.

```powershell
# Launch full stack (RPC + Privacy Proxy + 3-Node Watchtower Cluster + Frontend)
npm start

# Or start only the Vite frontend dev server (http://127.0.0.1:5173)
npm run frontend:dev

# Build production bundle
npm run frontend:build
```

---

## Prerequisites & Installation

- **Node.js:** v20+ (tested on Node.js v24)
- **Foundry (`forge`, `anvil`, `cast`):** Required only for compiling/running Solidity `.t.sol` tests

```powershell
# Clone repository and install dependencies
npm install
npm --prefix frontend install
```

---

## Running Tests

### 1. Smart Contract Test Suite (Foundry)
```bash
# Run all 64 Solidity unit, fuzz, and integration tests
forge test -vv

# Run tests with EVM gas consumption table
forge test --gas-report

# Run specific integration suites
forge test --match-path test/Phase2Integration.t.sol -vv
forge test --match-path test/DeployAll.t.sol -vv
forge test --match-path test/HTLC.t.sol -vv
```
**Result:** `64 passed, 0 failed` across 6 suites.

### 2. Off-Chain & Integration Test Suite (Jest)
```powershell
# Run individual JavaScript test modules
npm run test:merkle       # Merkle tree & cryptographic proof tests
npm run test:storage      # Storage provider & mock upload tests
npm run test:watchtower   # Watchtower persistence, rules engine & cluster recovery tests
npm run workflow:demo     # Command-line Phase 1 cryptographic pipeline demo
```
**Result:** `67 passed, 0 failed` across 7 suites.

---

## Local Deployment & Verification

### Option A: Instant Stateful Interactive Stack (No Foundry Required)
```powershell
node start-all.js
```
Starts the stateful EVM RPC engine (`mock-rpc.js` on `:8545`), Privacy Proxy (`:3000`), 3-Node Watchtower Cluster (`:9101–9103`), and React DApp (`:5173`).

### Option B: Foundry Anvil + `DeployAll.s.sol`
```bash
# 1. Start local Anvil instance
anvil --port 8545 --chain-id 31337

# 2. Deploy complete protocol and generate deployments.json
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --tc DeployAll
```

---

## Security Model & Threat Mitigations

| Threat | Severity | Architecture Mitigation |
|---|---|---|
| **Whistleblower IP Tracing** | Critical | Evidence uploaded via Tor Hidden Service to local memory-only proxy (`127.0.0.1:3000`); no direct IPFS client connection. |
| **Unauthorized Evidence Leakage to Public/Unselected Jurors** | Critical | Confidential evidence download is gated by Chainlink VRF selection (`jurorsOf(disputeId)`); unselected pool jurors and non-jurors are denied access. |
| **Blind / Random Juror Voting** | High | Selected VRF jurors cannot commit a vote until they download the evidence file and verify its 1 MiB SHA-256 Merkle root against the on-chain registry. |
| **Unilateral Funder Escrow Rug-Pull** | High | Funder cannot trigger `refund()` while a bounty is active; funds are locked in `HTLC.sol` and only refund if arbitration rules evidence `FAKE`. |
| **Bounty Double-Claiming** | High | HTLC state checks (`claimed` flag) and Semaphore ZK nullifiers prevent replay attacks. |
| **Juror Collusion / Vote Copying** | High | Chainlink VRF v2.5 randomly samples 3-of-5 jurors; Phase 2 (Reveal) is locked until all 3 selected jurors complete Phase 1 (Commit) using salted hashes (`keccak256(VOTE_TAG \|\| chainId \|\| contract \|\| disputeId \|\| juror \|\| vote \|\| salt)`). |
| **Reentrancy Attacks** | High | OpenZeppelin `ReentrancyGuard` on all state-mutating functions; pull-payments (`pendingPayout`) isolate ETH transfers during settlement. |
| **Watchtower Replay / Race Conditions** | Medium | On-chain preflight checks verify contract state before transaction submission; duplicate actions are safely skipped. |
| **L2 EVM Incompatibilities** | Medium | `foundry.toml` explicitly sets `evm_version = "shanghai"` to avoid unsupported Cancun opcodes (`MCOPY`, `TLOAD`) on Arbitrum. |

---

## Audit & Compliance Status

The codebase includes full Phase 1–3 architecture and security review documentation:
- **Phase 3 Security & Privacy Audit:** [`docs/audit/phase3-security-audit.md`](docs/audit/phase3-security-audit.md)
- **Requirements Traceability Matrix:** [`docs/audit/requirements-matrix.md`](docs/audit/requirements-matrix.md)
- **Phase 3 Architecture Specification:** [`docs/phase3-architecture.md`](docs/phase3-architecture.md)
- **Watchtower Network Specification:** [`docs/watchtower.md`](docs/watchtower.md)

---

## Roadmap & Limitations

### Completed Deliverables (Phases 1–3)
- [x] On-chain Evidence Registry, Staking, and HTLC Escrow (Phase 1)
- [x] Semaphore ZK Credentials, Tor Privacy Proxy, Chainlink VRF, Schelling Voting, and Arbitrated Bounty (Phase 2)
- [x] Automated 3-Node Watchtower Network, Strict RBAC React DApp, 5-Juror VRF Pool with Gated Evidence Verification, and E2E Simulation (Phase 3)

### Known Limitations & Operational Requirements
1. **Public IPFS vs. Encryption:** While the privacy upload proxy shields client IP addresses and the DApp gates file downloads to VRF-selected jurors, data pinned to public IPFS gateways is retrievable if the raw CID is shared publicly. In production deployments, evidence files should be encrypted with threshold/juror public keys prior to IPFS pinning.
2. **Local Multi-Node Simulation:** Running 3 watchtower nodes on localhost demonstrates software independence, checkpoint recovery, and concurrency safety, but does not provide geographic decentralization.
3. **Live Testnet Randomness:** In production or live Arbitrum Sepolia testing, Chainlink VRF v2.5 requires an active LINK token subscription and coordinator fulfillment.

---

## License

This project is licensed under the [MIT License](LICENSE).
