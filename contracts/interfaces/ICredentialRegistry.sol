// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title ICredentialRegistry
/// @notice Semaphore-backed registry of vetted participants (journalist / juror credentials).
interface ICredentialRegistry {
    event AttesterUpdated(address indexed attester, bool allowed);
    event ConsumerUpdated(address indexed consumer, bool allowed);
    event CredentialAdded(uint256 indexed identityCommitment, address indexed attester);
    event CredentialRevoked(uint256 indexed identityCommitment, address indexed attester);
    event ProofConsumed(address indexed consumer, uint256 indexed scope, uint256 nullifier);
    event NullifierReleased(address indexed consumer, uint256 indexed scope, uint256 nullifier);

    function semaphore() external view returns (ISemaphore);

    function groupId() external view returns (uint256);

    /// @notice Verify `proof` against the credential group and burn its nullifier for this consumer.
    /// @dev Callable only by authorised consumers. Reverts on any failure.
    /// @param expectedScope   scope the consumer requires (action-specific).
    /// @param expectedMessage message the consumer requires (binds action parameters).
    /// @return nullifier      the proof's nullifier (so the consumer may later release it).
    function verifyAndConsume(ISemaphore.SemaphoreProof calldata proof, uint256 expectedScope, uint256 expectedMessage)
        external
        returns (uint256 nullifier);

    /// @notice Free a nullifier previously consumed by msg.sender (e.g. when a juror leaves the pool).
    function releaseNullifier(uint256 scope, uint256 nullifier) external;

    function isNullifierUsed(uint256 scope, uint256 nullifier) external view returns (bool);
}
