# VeriLeaks Phase 2 Architecture

## Overview
Phase 2 builds upon the Phase 1 HTLC and registry to introduce anonymity and decentralized dispute resolution through Schelling point mechanisms.

## Core Components

### 1. `CredentialRegistry.sol`
Wraps Semaphore v4 to allow privacy-preserving identity claims. Attesters (e.g. journalists or onboarding entities) can register user identities into a Semaphore Merkle tree. During critical operations (e.g., joining the juror pool, opening a dispute), users prove group membership anonymously, and the registry consumes a unique nullifier to prevent double-spending or replay attacks.

### 2. `JurorSelection.sol`
Responsible for maintaining a pool of eligible jurors and selecting subsets for disputes using Chainlink VRF v2.5. 
- **Pool Management**: Users must stake tokens and provide a valid ZK proof of identity to join the pool.
- **Random Selection**: Upon dispute creation, a VRF request is initiated. When the callback is fulfilled, the contract pseudo-randomly selects `jurySize` jurors from the active pool.
- **Integration**: The selection is then pushed to the `SchellingVoting` contract.

### 3. `SchellingVoting.sol`
Implements a 2-phase commit-reveal voting process for resolving disputes.
- **Commit Phase**: Selected jurors hash their vote (REAL/FAKE) with a random salt and submit the commitment.
- **Reveal Phase**: Jurors submit their cleartext vote and salt. The contract verifies it matches the commitment.
- **Finalization**: After the reveal phase, the contract tallies the votes. The majority decision dictates the outcome of the dispute. Jurors who voted with the majority receive rewards, while minority voters and non-revealers are penalized (slashed).

### 4. `ArbitratedBounty.sol`
Acts as an abstraction layer over the Phase 1 `HTLC.sol`.
- **Funding**: Funders deposit bounties here, which natively wraps the funds in an HTLC lock.
- **Disputes**: Disputers can open a case against a bounty (e.g., claiming the evidence is fake) if they have a valid ZK identity proof.
- **Arbitration**: If a dispute is raised, `SchellingVoting` handles the resolution. If the evidence is deemed fake, the bounty lock can be safely bypassed or returned to the funder, enforcing economic security against malicious whistleblowers.

## Tooling & Optimizations
- Chainlink VRF v2.5 integration mandates intermediate representation (`via_ir = true`) to prevent `Stack too deep` limitations during compilation.
- Extensively uses Foundry for unit and integration testing (`Phase2Integration.t.sol`).
