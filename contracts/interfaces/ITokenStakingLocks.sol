// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITokenStakingLocks
/// @notice Phase 2 additive extension of {ITokenStaking}: stake reservation and slashing hooks for arbitration.
/// @dev    Kept in a separate interface so the Phase 1 {ITokenStaking} surface is unchanged.
///         A "locker" is a contract explicitly authorised by the staking owner (e.g. SchellingVoting).
///         Lockers can only touch stake that THEY locked-for-purpose: they can lock free stake, unlock locked
///         stake, and move *locked* stake to another account's free balance. They can never move free stake.
interface ITokenStakingLocks {
    event LockerUpdated(address indexed locker, bool allowed);
    event StakeLocked(address indexed user, uint256 amount, uint256 totalLocked);
    event StakeUnlocked(address indexed user, uint256 amount, uint256 totalLocked);
    event StakeSlashed(address indexed user, address indexed to, uint256 amount);

    /// @notice Stake currently reserved by lockers and therefore not withdrawable.
    function lockedOf(address user) external view returns (uint256);

    /// @notice Stake that can be withdrawn or newly locked: balanceOf(user) - lockedOf(user).
    function freeBalanceOf(address user) external view returns (uint256);

    function isLocker(address account) external view returns (bool);

    /// @notice Owner-only: authorise or revoke a locker contract.
    function setLocker(address locker, bool allowed) external;

    /// @notice Locker-only: reserve `amount` of `user`'s FREE stake. Reverts if free stake is insufficient.
    function lockStake(address user, uint256 amount) external;

    /// @notice Locker-only: release `amount` of previously locked stake back to the user's free balance.
    function unlockStake(address user, uint256 amount) external;

    /// @notice Locker-only: move `amount` of `from`'s LOCKED stake into `to`'s FREE balance.
    ///         Pure internal accounting: no ETH leaves the contract and `totalStaked` is unchanged.
    function slashStake(address from, address to, uint256 amount) external;
}
