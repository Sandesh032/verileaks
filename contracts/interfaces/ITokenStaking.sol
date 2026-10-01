// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITokenStaking
/// @notice Interface for the VeriLeaks staking module.
interface ITokenStaking {
    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a user deposits stake.
    event Staked(address indexed user, uint256 amount, uint256 newTotal);

    /// @notice Emitted when a user withdraws stake.
    event Unstaked(address indexed user, uint256 amount, uint256 remaining);

    // ────────────────────────────────────────────────────────────────────────
    // Mutating functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Deposit ETH as stake. msg.value must be > 0.
    function stake() external payable;

    /// @notice Withdraw `amount` ETH of stake back to the caller.
    function unstake(uint256 amount) external;

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Return the staked balance of `user`.
    function balanceOf(address user) external view returns (uint256);

    /// @notice Return the total ETH held by the contract.
    function totalStaked() external view returns (uint256);
}
