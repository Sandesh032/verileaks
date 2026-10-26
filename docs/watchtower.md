# VeriLeaks Watchtower Network Specification & Operations Guide

## 1. Overview

The **VeriLeaks Watchtower Network** is a distributed, resilient off-chain monitoring and automated settlement service. In decentralized dispute arbitration and timelocked bounties, participant inaction or network delays can leave protocols in stalled states. The watchtower network ensures:
1. Deadlines for VRF randomness, commit phases, and reveal phases are actively tracked.
2. Finalization and settlement transactions are executed automatically as soon as eligibility criteria are met.
3. Multiple independent nodes can observe the network concurrently without causing duplicate transactions or financial race conditions.

---

## 2. Component Architecture

### A. `WatchtowerStore`
- **Location:** `src/watchtower/WatchtowerStore.js`
- **Responsibilities:**
  - Durable, atomic local state storage using write-to-temporary-file and atomic rename (`fs.renameSync`).
  - Tracks block checkpoints (`lastProcessedBlock`, `updatedAt`).
  - Records deduplicated events by unique key (`${chainId}:${txHash}:${logIndex}`).
  - Records executed actions (`${actionType}:${targetId}`) to prevent replay attempts across restarts.
  - Maintains in-memory indexes of tracked bounties, disputes, and submissions.
  - Stores a circular operational alert log with severity levels (`INFO`, `WARN`, `ACTION`, `ERROR`).

### B. `WatchtowerRules`
- **Location:** `src/watchtower/WatchtowerRules.js`
- **Responsibilities:**
  - Pure, deterministic evaluation of protocol state against configured deadlines.
  - Defines four core protocol rules:
    - `FINALIZE_DISPUTE`: Evaluated when reveal deadline has elapsed or all jurors have revealed.
    - `CANCEL_TIMEOUT_DISPUTE`: Evaluated when a dispute remains in `CREATED` state past the VRF selection timeout.
    - `SETTLE_BOUNTY`: Evaluated when a bounty is `DISPUTED` and its linked dispute is resolved (`FINALIZED` or `CANCELLED`).
    - `REFUND_BOUNTY`: Evaluated when a bounty is `FUNDED` or `REJECTED` and its timelock has expired.

### C. `WatchtowerWorker`
- **Location:** `src/watchtower/WatchtowerWorker.js`
- **Responsibilities:**
  - Connects to the EVM JSON-RPC provider.
  - Polls contract events in bounded block ranges (`maxBlockBatch = 2000`).
  - Decodes events from `SubmissionRegistry`, `ArbitratedBounty`, `SchellingVoting`, `JurorSelection`, and `HTLC`.
  - Performs **canonical on-chain preflight checks** before submitting transactions to verify the contract state has not already transitioned.
  - Exposes local HTTP endpoints for health monitoring and cluster metrics.

### D. `MultiNodeCoordinator`
- **Location:** `src/watchtower/MultiNodeCoordinator.js`
- **Responsibilities:**
  - Spawns and manages a cluster of 3 independent watchtower nodes.
  - Assigns isolated data directories and distinct HTTP ports (`9101`, `9102`, `9103`).
  - Demonstrates concurrent observation, checkpoint recovery, and overlapping rule evaluation without duplicate financial actions.

---

## 3. Configuration & CLI Usage

### Environment Variables
Configure `.env` or set environment variables:
```bash
RPC_URL=http://127.0.0.1:8545           # EVM JSON-RPC endpoint
PRIVATE_KEY=0x...                       # Optional: Signer key for automated action execution
WATCHTOWER_PORT=9100                    # HTTP monitoring port
START_BLOCK=0                           # Starting block for fresh nodes
POLL_INTERVAL_MS=3000                   # Polling interval in milliseconds
```

### Running a Single Watchtower
```bash
# Starts node 1 with default settings (or read-only mode if no PRIVATE_KEY)
node src/watchtower/cli.js
```

### Running a 3-Node Simulated Cluster
```bash
# Launches 3 independent instances on ports 9101, 9102, 9103
npm run watchtower:cluster
# or: node src/watchtower/cli.js --cluster
```

---

## 4. HTTP Health & Status API

Each watchtower node serves an embedded lightweight HTTP server:

| Endpoint | Method | Response Description |
|---|---|---|
| `/health` | `GET` | Node health status, uptime, checkpoint block, and sync state. |
| `/status` | `GET` | Detailed operational metrics: chain ID, tracked disputes, tracked bounties, and last sync timestamp. |
| `/alerts` | `GET` | Array of recent structured operational and security alerts (up to 50 items). |

### Example Response (`GET http://127.0.0.1:9101/status`)
```json
{
  "nodeId": "watchtower-node-1",
  "chainId": 31337,
  "checkpoint": 22,
  "disputes": 1,
  "bounties": 1,
  "lastSyncTime": "2026-10-26T04:04:04.482Z"
}
```

---

## 5. Security & Fault Tolerance Guarantees

1. **Reorg & Missed-Event Resilience:**
   - Watchtowers checkpoint block numbers only after successfully parsing and recording all logs in a batch.
   - Upon restart, the node loads its last persisted checkpoint from disk and resumes scanning from `checkpoint + 1`.
2. **Replay & Concurrency Safety:**
   - Actions are keyed by `${actionType}:${targetId}` in the local store.
   - Even if multiple nodes run concurrently with signing capabilities, the on-chain preflight check verifies that `resultOf(disputeId)` or `getBounty(bountyId)` is still in an actionable status before a transaction is broadcast.
   - If an action was already executed by another node or party in the current block, the preflight detects the transition and safely marks the action as skipped without reverting on-chain.
3. **No Whistleblower Data Leakage:**
   - Watchtower logs record only public protocol identifiers (`bountyId`, `disputeId`, transaction hashes, and block numbers).
   - Watchtowers do not inspect or retain off-chain evidence content or whistleblower IP addresses.
