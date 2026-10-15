# Phase 1 & 2 Baseline

## Git Status
- **Branch:** main
- **Commit:** 5945448552b0942ffb9740c91fc42f7f23112402

## Environment
- **Solidity Version:** 0.8.24
- **EVM Version:** shanghai
- **Optimizer:** true (200 runs)
- **Via IR:** true

## Dependencies
- `@chainlink/contracts`: 1.5.0
- `@openzeppelin/contracts`: 5.6.1
- `@semaphore-protocol/contracts`: 4.14.3
- `@semaphore-protocol/group`: 4.14.3
- `@semaphore-protocol/identity`: 4.14.3
- `@semaphore-protocol/proof`: 4.14.3
- `@zk-kit/lean-imt.sol`: 2.0.1
- `poseidon-solidity`: 0.0.5

## Uncommitted Changes
- `contracts/TokenStaking.sol`
- `foundry.toml`
- `package.json`

## Untracked Files
- Phase 2 contract files (`ArbitratedBounty.sol`, `CredentialRegistry.sol`, `JurorSelection.sol`, `SchellingVoting.sol`, interfaces, libraries)
- `docs/`
- `scripts/`
- `test/Phase2Integration.t.sol`

## Pre-existing Tests
- `forge test` runs 63 tests successfully. All tests pass natively.
