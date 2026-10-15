// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IJurorSelection
/// @notice Randomness + candidate-pool component. Knows nothing about votes or stakes accounting.
interface IJurorSelection {
    /// @notice Request VRF randomness to select `jurySize` distinct eligible jurors for `disputeId`.
    /// @dev Callable only by the configured voting contract.
    function requestSelection(
        uint256 disputeId,
        uint8 jurySize,
        uint256 stakePerJuror,
        address excludedA,
        address excludedB
    ) external returns (uint256 requestId);

    /// @notice Mark the pending request of `disputeId` as cancelled so late randomness is ignored.
    function cancelSelection(uint256 disputeId) external;
}
