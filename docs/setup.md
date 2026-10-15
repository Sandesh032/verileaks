# VeriLeaks Development Setup

## Prerequisites
- **Foundry**: Solidity testing and deployment framework. Install via `curl -L https://foundry.paradigm.xyz | bash`.
- **Node.js**: Required for dependency management (npm/yarn/pnpm).

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd verileaks
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Install Foundry dependencies** (if not already managed by node_modules):
   ```bash
   forge install
   ```

## Compilation

Because Phase 2 relies heavily on complex data structures for Chainlink VRF and Semaphore, standard EVM compilation triggers `Stack too deep` errors. To fix this, we rely on the IR (Intermediate Representation) compilation pipeline.

Run the build with:
```bash
forge build
```
*(Note: `via_ir = true` is already configured in `foundry.toml`.)*

## Testing

Run the full test suite using:
```bash
forge test -vv
```

To run only the Phase 2 integration tests:
```bash
forge test --match-path test/Phase2Integration.t.sol -vv
```

## Coverage

To generate an LCOV coverage report:
```bash
forge coverage --report lcov
```
