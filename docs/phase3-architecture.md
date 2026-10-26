# VeriLeaks Phase 3 — Architecture Specification

## 1. Executive Summary

VeriLeaks is a decentralized whistleblower bounty and evidence verification protocol. 
- **Phase 1** implemented core protocol foundations: on-chain evidence registry, token staking, deterministic Merkle tree generation, and HTLC escrow.
- **Phase 2** added privacy and arbitration: zero-knowledge credentials using Semaphore v4, a privacy proxy for evidence ingestion, Chainlink VRF randomized juror selection, Schelling commit-reveal consensus, and economic slashing/reward mechanics.
- **Phase 3** delivers the operational and user-facing layer:
  1. **Watchtower Network:** An independent, multi-node monitoring and automated action service that ensures dispute deadlines, finalizations, and bounty settlements occur reliably without requiring manual user intervention.
  2. **React Decentralized Application (DApp):** A high-performance Web3 application providing responsive interfaces for whistleblower submissions, evidence Merkle verification, bounty escrow management, juror staking, and commit-reveal arbitration.
  3. **End-to-End Simulation & Verification:** An automated end-to-end simulation proving multi-node fault tolerance, restart recovery, reorg resilience, and complete protocol integration on local EVM and testnet environments.

---

## 2. System Architecture

The overall Phase 3 architecture connects five primary tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React DApp (Vite + React)                       │
│  [Landing/Overview]  [Whistleblower Submit]  [Bounties]  [Staking]     │
│             [Commit-Reveal Arbitration]  [Watchtower Health]           │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   │ Web3 / EIP-1193                 │ Upload API (Multipart)
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        EVM Blockchain Network        │  │     Privacy Upload Proxy     │
│   (Arbitrum Sepolia / Anvil Local)   │  │   (Express + Multer + Tor)   │
│                                      │  └──────────────┬───────────────┘
│  • SubmissionRegistry                │                 │ IPFS API
│  • TokenStaking                      │                 ▼
│  • HTLC                              │  ┌──────────────────────────────┐
│  • CredentialRegistry (Semaphore v4) │  │    Decentralized Storage     │
│  • JurorSelection (Chainlink VRF)    │  │       (IPFS / Pinata)        │
│  • SchellingVoting                   │  └──────────────────────────────┘
│  • ArbitratedBounty                  │
└──────────────────▲───────────────────┘
                   │
                   │ JSON-RPC Polling & Preflight Transactions
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Independent Watchtower Cluster                       │
│  [Node 1: Automated Executor]  [Node 2: Auditor]  [Node 3: Auditor]    │
│  • Event identity: chainId:txHash:logIndex                             │
│  • Atomic checkpointing (.json / SQLite store)                         │
│  • On-chain canonical preflight verification                           │
│  • Idempotent action deduplication                                     │
│  • Health & status HTTP endpoints (:9101, :9102, :9103)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authoritative Source of Truth vs. Off-Chain Roles

1. **Smart Contracts (Authoritative):**
   - The Ethereum/Arbitrum smart contracts are the **sole authoritative source of truth** for all financial balances, escrow states, juror stakes, dispute outcomes, and payouts.
   - Off-chain state must **never** create a secondary balance sheet or dispute outcome database.

2. **Watchtowers (Observers and Facilitators):**
   - Watchtowers observe on-chain logs and local block timestamp progressions.
   - Watchtower decisions are strictly deterministic rules that trigger **permissionless** contract methods (`finalize`, `cancelDispute`, `settle`, `refund`).
   - Every watchtower executes an on-chain preflight check before submitting a transaction to ensure idempotency and prevent transaction revert loops.

3. **React DApp (Client Interface):**
   - Reads authoritative state directly from RPC contract queries.
   - Computes deterministic client-side Merkle roots using the browser Web Crypto API (1 MiB chunks with domain separation).
   - Generates client-side juror commitment salts to prevent secret leakage to servers or logs.
   - Interacts with the privacy proxy for evidence uploads to mask whistleblower IP addresses.

---

## 4. Watchtower Rules Engine Mapping

| Contract Event or State Condition | Watchtower Rule | Expected Action | Verification Method |
|---|---|---|---|
| All selected jurors revealed before deadline (`revealed == jurySize`) OR `block.timestamp >= revealDeadline` | `FINALIZE_DISPUTE` | Call `SchellingVoting.finalize(disputeId)` | Verify on-chain dispute status moves to `FINALIZED` (3) and outcome matches majority. |
| VRF selection not fulfilled and `block.timestamp >= createdAt + selectionTimeout` | `CANCEL_TIMEOUT_DISPUTE` | Call `SchellingVoting.cancelDispute(disputeId)` | Verify dispute status moves to `CANCELLED` (4) and stakes remain unlocked. |
| Bounty is `DISPUTED` and its linked dispute is `FINALIZED` or `CANCELLED` | `SETTLE_BOUNTY` | Call `ArbitratedBounty.settle(bountyId)` | Verify bounty moves to `RELEASED` (3) or `REJECTED` (5), and HTLC claim/refund executes. |
| Bounty is `FUNDED` or `REJECTED` and `block.timestamp > timelock` with no active dispute | `REFUND_BOUNTY` | Call `ArbitratedBounty.refund(bountyId)` | Verify bounty moves to `REFUNDED` (4) and funder is credited `pendingPayout`. |
| Process restart or downtime | `CHECKPOINT_RECOVERY` | Scan from `lastProcessedBlock + 1` to head | Verify no duplicate actions are executed and checkpoint updates atomically. |

---

## 5. Security and Privacy Boundaries

1. **Whistleblower Anonymity:**
   - Real whistleblower identities are never collected or stored.
   - Synthetic data is strictly enforced for all testing.
   - Evidence payloads sent through `/api/upload` are forwarded by the proxy without logging client IP headers (`x-forwarded-for`, `remote-address`).
   - Submission registration stores only the IPFS CID and domain-separated Merkle root on-chain.

2. **Juror Vote Secrecy:**
   - Votes in `SchellingVoting` use a salted Pedersen-like commitment: `keccak256(abi.encode(disputeId, juror, vote, salt))`.
   - Salts are generated client-side and never broadcast during the commit phase.
   - Watchtowers only observe cleartext votes after jurors submit `revealVote`.

3. **Watchtower Key Isolation:**
   - Monitoring nodes do not require private keys; read-only nodes log informational alerts and health metrics.
   - Automated executors utilize dedicated, strictly isolated test keys with separate funds, ensuring zero access to protocol admin or user funds.
