# Build and Dependencies

## Framework & Compilation
- **Toolchain:** Foundry (forge)
- **Compilation:** `forge build` successfully compiles all contracts. `via_ir` is enabled in `foundry.toml` to bypass "Stack too deep" limits due to complex variables in `SchellingVoting.sol` and Chainlink interfaces.
- **Warnings:**
  - `block.timestamp` manipulation warnings in `SchellingVoting.sol` (tolerable for >1 day durations, reviewed and verified).
  - `calls-loop` warnings due to staking interactions inside jury loops (strictly bounded to `MAX_JURY=15`, reviewed and verified as safe).
  - All other warnings (`uninitialized-local`, `reentrancy-events`, test warnings) have been completely remediated.

## Dependencies
The `package.json` specifies correct dependencies for Chainlink VRF (`1.5.0` which corresponds to v2.5), OpenZeppelin (`5.6.1`), and Semaphore (`4.14.3`).

## Environment Variables
- `foundry.toml` specifies standard structure.
- Local `.env` is uncommitted.
- Remappings correctly set for all dependencies.

## Network Settings
- Arbitrum EVM rules strictly followed: `evm_version = "shanghai"` disables `MCOPY`/`TLOAD` opcodes, ensuring compatibility with Arbitrum.
