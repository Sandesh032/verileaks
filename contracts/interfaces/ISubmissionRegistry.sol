// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISubmissionRegistry
/// @notice Interface for the VeriLeaks submission registry.
///         Phase 2 can replace the submitter identity field with a Semaphore commitment
///         without changing the rest of the contract surface.
interface ISubmissionRegistry {
    // ────────────────────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Metadata stored for every registered submission.
    /// @param submissionId  Unique identifier (keccak256 of CID + merkleRoot + block.number).
    /// @param submitter     Phase-1 identity: tx.origin address.
    ///                      Phase-2 will replace this with a Semaphore/ZK nullifier hash.
    /// @param ipfsCid       IPFS Content Identifier of the evidence file (UTF-8 string).
    /// @param merkleRoot    Merkle root of the evidence file chunks.
    /// @param timestamp     Block timestamp at registration.
    /// @param exists        True if this submission has been registered.
    struct Submission {
        bytes32 submissionId;
        address submitter;
        string ipfsCid;
        bytes32 merkleRoot;
        uint256 timestamp;
        bool exists;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new submission is registered.
    event SubmissionRegistered(
        bytes32 indexed submissionId,
        address indexed submitter,
        string ipfsCid,
        bytes32 indexed merkleRoot,
        uint256 timestamp
    );

    // ────────────────────────────────────────────────────────────────────────
    // Mutating functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Register a new evidence submission.
    /// @param ipfsCid    IPFS CID of the evidence (must not be empty).
    /// @param merkleRoot Merkle root of the evidence chunks (must not be zero).
    /// @return submissionId Unique ID assigned to this submission.
    function registerSubmission(string calldata ipfsCid, bytes32 merkleRoot) external returns (bytes32 submissionId);

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Retrieve full metadata for a submission.
    function getSubmission(bytes32 submissionId) external view returns (Submission memory);

    /// @notice Check whether a submission ID has been registered.
    function submissionExists(bytes32 submissionId) external view returns (bool);

    /// @notice Total number of submissions registered.
    function submissionCount() external view returns (uint256);
}
