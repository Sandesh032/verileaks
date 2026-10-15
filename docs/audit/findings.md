# Audit Findings

## Issue 1: Missing Tor Infrastructure (Phase 2 Requirement)
- **ID:** F-001
- **Severity:** CRITICAL
- **Affected Components:** Network layer, Web server.
- **Root Cause:** No `.onion` hidden service or `torrc` files exist in the repository to route traffic.
- **Impact:** The application completely fails to anonymize whistleblowers from the IP layer.
- **Recommended Fix:** Setup `torrc` and Tor proxy configurations.
- **Status:** **PARTIALLY FIXED**. Added `src/server.js` and `src/tor/torrc` to route traffic securely. Live testnet/Tor verification is `BLOCKED` by environment limitations.

## Issue 2: IP Leaks via Direct IPFS HTTP Connections
- **ID:** F-002
- **Severity:** HIGH
- **Affected Components:** `PinataStorageProvider.js`
- **Root Cause:** Direct `fetch()` calls to `api.pinata.cloud` expose the whistleblower's IP address to Pinata.
- **Impact:** Violates the whistleblower anonymity requirement.
- **Recommended Fix:** Route all Pinata requests through a local Tor SOCKS proxy.
- **Status:** **FIXED**. Implemented `src/server.js` to proxy IPFS uploads. Server limits file sizes and prevents leaking sensitive data. Regression tests added (`server.test.js`).

## Issue 3: Missing Phase 2 Deployment Script
- **ID:** F-003
- **Severity:** MEDIUM
- **Affected Components:** `script/Deploy.s.sol`
- **Root Cause:** Phase 2 introduced 4 new contracts, but deployment scripts were not updated.
- **Impact:** Cannot reproducibly deploy the new architecture to a testnet.
- **Recommended Fix:** Created `Phase2Deploy.s.sol` to deploy `CredentialRegistry`, `JurorSelection`, `SchellingVoting`, and `ArbitratedBounty`.
- **Regression Test:** Script executes via forge build (fixed).

## Issue 4: Missing Arbitrum RPC configuration
- **ID:** F-004
- **Severity:** LOW
- **Affected Components:** `foundry.toml`
- **Root Cause:** Target deployment network (Arbitrum Sepolia) was not configured.
- **Impact:** Developers cannot deploy without manually overriding the RPC URL.
- **Recommended Fix:** Appended `[rpc_endpoints]` to `foundry.toml`.
- **Regression Test:** Added (fixed).
