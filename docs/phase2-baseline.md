# Phase 2 Baseline (recorded before any Phase 2 change)

Recorded: 2026-10-09, before any Phase 2 code was written.

## Repository state

| Item | Value |
|---|---|
| Location | `/home/sandesh/Desktop/blockchain/verileaks` |
| Git branch | `main` |
| Git history | one commit: `5945448 week 1` |
| Working tree | clean at start of Phase 2 |
| Framework | **Foundry** (forge 1.8.3), `foundry.toml` |
| Solidity | `solc 0.8.24`, optimizer 200 runs, `via_ir=false` |
| Sources dir | `contracts/` (not `src/`); `src/` holds the JS tooling |
| Off-chain | Node v22, ESM, Jest 29 (Merkle tree + storage providers) |
| Docker / Tor | **not installed** on this machine (affects Tor verification, see `phase2-setup.md`) |
| Existing deployments | None recorded anywhere. Only a throw-away local Anvil run (chain 31337) was done in Phase 1; no testnet/mainnet addresses exist in README, `.env.example`, or `broadcast/`. |

## Phase 1 contracts (actual interfaces)

| Contract | Relevant surface | Phase 2 integration implication |
|---|---|---|
| `SubmissionRegistry` | `registerSubmission(cid, root)`, `submissionExists(id)`, `getSubmission(id)`; `submitter = msg.sender` | Disputes reference an existing `submissionId` through `submissionExists`. The registry itself is not modified. |
| `TokenStaking` | `stake()`, `unstake(amount)`, `balanceOf`, `totalStaked`. **ETH only. No lock, no slash, no per-user "locked" bookkeeping, no operator role.** | `unstake` would let a juror withdraw stake mid-dispute. Needs a minimal, backwards-compatible extension (see below). |
| `HTLC` | `fundBounty(submissionId, beneficiary, hashlock, timelock)`, `claim(lockId, preimage)` (beneficiary only), `refund(lockId)` (funder only, after timelock). | Only hashlock + timeout. It has **no arbitration-based settlement path**. A funder can refund after the timelock regardless of any verdict, and the beneficiary can claim only with the preimage. |

## Baseline results (before changes)

| Suite | Command | Result |
|---|---|---|
| Solidity build | `forge build` | OK (lint notes only: `block.timestamp` usage, `vm.roll` in tests) |
| Solidity tests | `forge test` | **62 passed, 0 failed** (4 suites: HTLC 26, SubmissionRegistry, TokenStaking, Phase1Integration) |
| JS tests | `npm test` | **39 passed, 0 failed** (3 suites) |

No pre-existing test failures.

## Concerns found in Phase 1 (security / dependency)

1. **HTLC lockId can be overwritten.** `lockId = keccak256(submissionId, hashlock, msg.sender, block.number)` and `fundBounty` does not check that the id is unused. The same funder funding the same `(submissionId, hashlock)` twice in one block overwrites the first lock and the first deposit becomes unrecoverable. *Phase 2 impact:* an arbitration-bound lock must never be overwritten. *Decision:* the smallest justified fix is a `LockAlreadyExists` revert plus a regression test (documented under "Phase 1 changes" in `phase2-architecture.md`).
2. **Staking has no lock primitive.** A juror could `unstake()` during voting, so slashing/rewards would be unenforceable. A minimal additive extension is required.
3. **`SubmissionRegistry.submitter` is a public wallet** (`msg.sender`). Phase 1 documents this. Phase 2 does not retroactively anonymise registered submissions; this is a documented limitation.
4. **Phase 1 `package-lock.json` is git-ignored.** Dependency versions are therefore pinned with exact versions in `package.json` for Phase 2 additions.
5. **`forge-std` is vendored in `lib/`** (no `.gitmodules`); that is left as is.
6. HTLC and staking tests reference only `^0.8.24`. New Phase 2 dependencies (Semaphore 4.x uses `^0.8.23`, Chainlink 1.5 uses `^0.8.19`/`0.8.x`) are compatible with `solc 0.8.24`.

## Dependencies selected for Phase 2 (verified 2026-10-09 on npm / official docs)

| Package | Pin | Purpose |
|---|---|---|
| `@semaphore-protocol/contracts` | 4.14.3 | on-chain `Semaphore`, `SemaphoreVerifier`, group management |
| `@semaphore-protocol/{identity,group,proof}` | 4.14.3 | off-chain identity, group, proof generation |
| `@zk-kit/lean-imt.sol`, `poseidon-solidity` | 2.0.1 / 0.0.5 | Semaphore contract deps |
| `@chainlink/contracts` | 1.5.0 | VRF v2.5 consumer base + mock coordinator |
| `@openzeppelin/contracts` | 5.6.1 | `ReentrancyGuard`, `Ownable2Step` |

**VRF version decision:** Chainlink VRF v2 is deprecated and the subscription manager only creates v2.5 subscriptions. Therefore Phase 2 targets **VRF v2.5** (`VRFConsumerBaseV2Plus`, `uint256 subId`, `VRFV2PlusClient`). This is *not* interface-compatible with v2.
