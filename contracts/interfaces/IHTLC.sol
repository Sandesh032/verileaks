// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHTLC
/// @notice Interface for the VeriLeaks Hash Time-Locked Contract bounty escrow.
interface IHTLC {
    // ────────────────────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────────────────────

    enum Status {
        FUNDED,
        CLAIMED,
        REFUNDED
    }

    // ────────────────────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────────────────────

    struct Lock {
        bytes32 submissionId; // linked VeriLeaks submission
        address payable funder;
        address payable beneficiary;
        uint256 amount;
        bytes32 hashlock; // keccak256(preimage)
        uint256 timelock; // Unix timestamp after which refund is allowed
        Status status;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event BountyFunded(
        bytes32 indexed lockId,
        bytes32 indexed submissionId,
        address indexed funder,
        address beneficiary,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );

    event BountyClaimed(bytes32 indexed lockId, address indexed beneficiary, bytes32 preimage);

    event BountyRefunded(bytes32 indexed lockId, address indexed funder);

    // ────────────────────────────────────────────────────────────────────────
    // Mutating functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Fund a bounty for a given submission.
    /// @param submissionId Linked SubmissionRegistry ID.
    /// @param beneficiary  Address entitled to claim after providing preimage.
    /// @param hashlock     keccak256(preimage) — computed off-chain by funder.
    /// @param timelock     Unix timestamp after which refund is available.
    /// @return lockId      Unique ID for this lock.
    function fundBounty(bytes32 submissionId, address payable beneficiary, bytes32 hashlock, uint256 timelock)
        external
        payable
        returns (bytes32 lockId);

    /// @notice Beneficiary claims the bounty by revealing the preimage.
    function claim(bytes32 lockId, bytes32 preimage) external;

    /// @notice Funder reclaims funds after timelock expiry.
    function refund(bytes32 lockId) external;

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

    function getLock(bytes32 lockId) external view returns (Lock memory);

    function lockExists(bytes32 lockId) external view returns (bool);
}
