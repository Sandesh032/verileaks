// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISchellingVoting
/// @notice Dispute state machine + commit/reveal voting + incentive accounting.
interface ISchellingVoting {
    /// @dev Stored lifecycle. COMMIT/REVEAL are time-derived phases of ACTIVE (see `phaseOf`).
    enum Status {
        NONE,
        CREATED, //   dispute opened, randomness requested, no jurors yet
        ACTIVE, //    jurors selected + stake locked; commit then reveal windows run
        FINALIZED, // outcome fixed, stakes settled
        CANCELLED //  randomness never arrived / selection impossible; nothing locked
    }

    enum Phase {
        NONE,
        CREATED,
        COMMIT,
        REVEAL,
        AWAITING_FINALIZATION,
        FINALIZED,
        CANCELLED
    }

    enum Vote {
        NONE,
        REAL,
        FAKE
    }

    enum Outcome {
        NONE,
        REAL,
        FAKE,
        INCONCLUSIVE
    }

    // ── Callbacks from JurorSelection ───────────────────────────────────────
    function onJurorsSelected(uint256 disputeId, address[] calldata jurors) external;

    function onSelectionFailed(uint256 disputeId) external;

    // ── Dispute creation (authorised creators only, e.g. ArbitratedBounty) ──
    function createDispute(bytes32 submissionId, uint256 externalRef, address excludedA, address excludedB)
        external
        returns (uint256 disputeId);

    // ── Views used by settlement adapters ───────────────────────────────────
    function resultOf(uint256 disputeId)
        external
        view
        returns (Status status, Outcome outcome, address creator, uint256 externalRef, bytes32 submissionId);
}
