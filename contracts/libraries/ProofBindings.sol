// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProofBindings
/// @notice Canonical Semaphore `scope` and `message` values for every protected VeriLeaks action.
///
/// Why: a Semaphore proof only proves "I am in group G" for a given (scope, message). The contract must demand
/// action-specific values, otherwise a proof made for one action could be replayed for another.
///   • scope   → decides the nullifier. Same member + same scope ⇒ same nullifier ⇒ one use per scope.
///   • message → binds the proof to the action's parameters (and, for juror registration, to the wallet) so a
///               mempool observer cannot re-submit the proof for a different wallet/bounty.
///
/// The off-chain mirror lives in `scripts/semaphore/bindings.mjs` and MUST stay byte-identical.
library ProofBindings {
    bytes32 internal constant JUROR_SCOPE_TAG = keccak256("VERILEAKS_JUROR_REGISTRATION_SCOPE_V1");
    bytes32 internal constant JUROR_MESSAGE_TAG = keccak256("VERILEAKS_JUROR_REGISTRATION_MESSAGE_V1");
    bytes32 internal constant DISPUTE_SCOPE_TAG = keccak256("VERILEAKS_DISPUTE_OPEN_SCOPE_V1");
    bytes32 internal constant DISPUTE_MESSAGE_TAG = keccak256("VERILEAKS_DISPUTE_OPEN_MESSAGE_V1");

    /// @dev One pool slot per credential (per selection contract, per chain).
    function jurorRegistrationScope(address selection) internal view returns (uint256) {
        return uint256(keccak256(abi.encode(JUROR_SCOPE_TAG, block.chainid, selection)));
    }

    /// @dev Binds the registration proof to the wallet that will hold stake and vote.
    function jurorRegistrationMessage(address selection, address wallet) internal view returns (uint256) {
        return uint256(keccak256(abi.encode(JUROR_MESSAGE_TAG, block.chainid, selection, wallet)));
    }

    /// @dev One dispute-opening right per credential, per bounty, per attempt index.
    function disputeOpenScope(address bounty, uint256 bountyId, uint256 attempt) internal view returns (uint256) {
        return uint256(keccak256(abi.encode(DISPUTE_SCOPE_TAG, block.chainid, bounty, bountyId, attempt)));
    }

    function disputeOpenMessage(address bounty, uint256 bountyId, uint256 attempt) internal view returns (uint256) {
        return uint256(keccak256(abi.encode(DISPUTE_MESSAGE_TAG, block.chainid, bounty, bountyId, attempt)));
    }
}
