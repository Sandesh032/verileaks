// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISubmissionRegistry } from "./interfaces/ISubmissionRegistry.sol";

/// @title SubmissionRegistry
/// @notice Phase 1 VeriLeaks contract that anchors evidence metadata on-chain.
///
/// Design notes
/// ─────────────
/// • Only cryptographic metadata is stored; NO evidence files are on-chain.
/// • The `submitter` field uses tx.origin for Phase 1 MVP simplicity.
///   Phase 2 will replace/augment this with a Semaphore nullifier hash so
///   that the rest of the contract surface does not need to change.
/// • Submission IDs are deterministically derived from (ipfsCid, merkleRoot,
///   block.number) to ensure uniqueness even for the same evidence re-registered
///   in a different block.
///
/// @custom:security-contact security@verileaks.example
contract SubmissionRegistry is ISubmissionRegistry {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error EmptyIpfsCid();
    error EmptyMerkleRoot();
    error SubmissionAlreadyExists(bytes32 submissionId);

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @dev Mapping from submissionId → Submission metadata.
    mapping(bytes32 => Submission) private _submissions;

    /// @dev Monotonically increasing counter.
    uint256 private _submissionCount;

    // ────────────────────────────────────────────────────────────────────────
    // External mutating functions
    // ────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISubmissionRegistry
    /// @dev Checks-Effects-Interactions:
    ///      1. Validate inputs (checks).
    ///      2. Derive ID and write state (effects).
    ///      3. Emit event (no external calls → no interaction risk).
    function registerSubmission(string calldata ipfsCid, bytes32 merkleRoot)
        external
        override
        returns (bytes32 submissionId)
    {
        // ── Checks ────────────────────────────────────────────────────────
        if (bytes(ipfsCid).length == 0) revert EmptyIpfsCid();
        if (merkleRoot == bytes32(0)) revert EmptyMerkleRoot();

        // Derive a unique ID. block.number prevents two identical (cid, root)
        // pairs submitted in different blocks from colliding.
        submissionId = keccak256(abi.encodePacked(ipfsCid, merkleRoot, block.number, msg.sender));

        // Very unlikely, but guard against a collision.
        if (_submissions[submissionId].exists) revert SubmissionAlreadyExists(submissionId);

        // ── Effects ───────────────────────────────────────────────────────
        _submissions[submissionId] = Submission({
            submissionId: submissionId,
            submitter: msg.sender, // Phase 2: replace with Semaphore nullifier
            ipfsCid: ipfsCid,
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            exists: true
        });
        unchecked {
            _submissionCount++;
        }

        // ── Event ─────────────────────────────────────────────────────────
        emit SubmissionRegistered(submissionId, msg.sender, ipfsCid, merkleRoot, block.timestamp);
    }

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISubmissionRegistry
    function getSubmission(bytes32 submissionId) external view override returns (Submission memory) {
        return _submissions[submissionId];
    }

    /// @inheritdoc ISubmissionRegistry
    function submissionExists(bytes32 submissionId) external view override returns (bool) {
        return _submissions[submissionId].exists;
    }

    /// @inheritdoc ISubmissionRegistry
    function submissionCount() external view override returns (uint256) {
        return _submissionCount;
    }
}
