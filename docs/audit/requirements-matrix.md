# Requirements Traceability Matrix

## Phase 1 — Core Protocol and Storage

| ID | Phase | Requirement | Method | Actual Result | Status |
|---|---|---|---|---|---|
| 1.1 | 1 | Development environment and Solidity compilation. | Run `forge build` | `forge build` completes without errors | PASS |
| 1.2 | 1 | SubmissionRegistry. | Run `SubmissionRegistry.t.sol` | All 14 tests pass | PASS |
| 1.3 | 1 | TokenStaking. | Run `TokenStaking.t.sol` | All 17 tests pass | PASS |
| 1.4 | 1 | IPFS storage integration. | Inspect `src/storage` and `npm run test:storage` | Pinata logic works; no real decentralization beyond HTTP API. | PARTIAL |
| 1.5 | 1 | Deterministic Merkle Tree generation. | `npm run test:merkle` | 25 tests pass. Root logic is consistent | PASS |
| 1.6 | 1 | Merkle proof generation and verification. | `npm run test:merkle` | Proof generation and verification succeed | PASS |
| 1.7 | 1 | On-chain Merkle root anchoring. | `SubmissionRegistry` tests | Merkle roots correctly saved to chain | PASS |
| 1.8 | 1 | HTLC bounty escrow. | Run `HTLC.t.sol` | 26 tests pass | PASS |
| 1.9 | 1 | HTLC hashlock and timelock. | `test_revert_fund_timelockInPast` & refund tests | Timelock edges enforce correctly | PASS |
| 1.10 | 1 | Funding, claim, and refund lifecycle. | `Phase1Integration.t.sol` | End-to-End workflow verifies lifecycle | PASS |
| 1.11 | 1 | Deployment scripts. | Inspect `script/Deploy.s.sol` | Only Phase 1 contracts exist. Phase 2 missing | PARTIAL |
| 1.12 | 1 | Unit and integration tests. | `forge test` | 63 tests pass successfully | PASS |
| 1.13 | 1 | Environment configuration and documentation. | Check repo root files | `foundry.toml` and `.env` formats exist | PASS |

## Phase 2 — Anonymity and Arbitration

| ID | Phase | Requirement | Method | Actual Result | Status |
|---|---|---|---|---|---|
| 2.1 | 2 | Semaphore identity integration. | `Phase2Integration.t.sol` | Mocked locally, but verified via logic. Real testnet needed. | PARTIAL |
| 2.2 | 2 | Group membership management. | `CredentialRegistry` review | Handled by `createGroup` and `addMember` (offchain) | PASS |
| 2.3 | 2 | Nullifier and replay protections. | `CredentialRegistry` logic | Consumes nullifiers correctly | PASS |
| 2.4 | 2 | Tor Hidden Service configuration. | Configured `torrc` and Express Server proxy | Local proxy architecture created; Live integration `BLOCKED` | PARTIAL |
| 2.5 | 2 | Sensitive-data and IP leakage risks. | `server.test.js` | IPFS proxy completely masks client IPs | PASS |
| 2.6 | 2 | Arbitrum testnet configuration. | Check `foundry.toml` | No Arbitrum RPC or deployment scripts | FAIL |
| 2.7 | 2 | Chainlink VRF integration. | `JurorSelection.sol` review | Logic written, mocked in tests, no live execution | PARTIAL |
| 2.8 | 2 | Randomized juror selection. | `Phase2Integration.t.sol` | Works correctly with mocked VRF fulfillments | PASS |
| 2.9 | 2 | Commit-reveal voting. | `SchellingVoting.sol` | Two-phase state transitions operate correctly | PASS |
| 2.10 | 2 | Vote tallying and dispute finalization. | `test_phase2_arbitratedBounty_happyPath` | Outcome propagates accurately | PASS |
| 2.11 | 2 | Staking integration with dispute eligibility. | `JurorSelection.sol` | Enforces `stakePerJuror` threshold | PASS |
| 2.12 | 2 | Reward and slashing accounting. | `SchellingVoting.sol` | Re-allocates slashed stakes correctly | PASS |
| 2.13 | 2 | Integration between arbitration outcomes and bounty. | `ArbitratedBounty.sol` | `settle()` safely unlocks HTLC based on outcome | PASS |
| 2.14 | 2 | Security, regression, and end-to-end tests. | `Phase2Integration.t.sol` | Passed complete workflow end-to-end | PASS |
