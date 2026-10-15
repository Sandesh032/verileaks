// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITokenStaking } from "./interfaces/ITokenStaking.sol";
import { ITokenStakingLocks } from "./interfaces/ITokenStakingLocks.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title TokenStaking
/// @notice Phase 1 VeriLeaks staking module using native ETH.
///
/// Design notes
/// ─────────────
/// • Uses ETH for Phase 1. Phase 2 can extend this to an ERC-20 token for
///   governance/jury incentives without changing the accounting logic.
/// • Reentrancy is prevented by the Checks-Effects-Interactions pattern:
///   state is updated BEFORE the ETH transfer.
/// • Solidity 0.8.x built-in overflow checks eliminate the need for SafeMath.
/// • No ERC-20 dependency is needed for the Phase 1 ETH-based foundation.
///
/// Phase 2 extension (additive, see {ITokenStakingLocks})
/// ──────────────────────────────────────────────────────
/// • Authorised "locker" contracts (set by the owner) can reserve a user's FREE stake for the duration of a
///   dispute, release it, or slash locked stake into another account's free balance.
/// • `unstake` can only withdraw FREE stake (balance - locked). Without any locks, behaviour is unchanged.
/// • Slashing is internal accounting only: no ETH moves, `totalStaked` is invariant.
///
/// @custom:security-contact security@verileaks.example
contract TokenStaking is ITokenStaking, ITokenStakingLocks, Ownable2Step {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error ZeroStakeAmount();
    error ZeroWithdrawAmount();
    error InsufficientStake(uint256 requested, uint256 available);
    error TransferFailed();
    error StakeIsLocked(uint256 requested, uint256 free);
    error NotLocker(address caller);
    error ZeroAddress();
    error ZeroLockAmount();
    error InsufficientFreeStake(address user, uint256 requested, uint256 free);
    error InsufficientLockedStake(address user, uint256 requested, uint256 locked);

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @dev Per-user staked balance in wei.
    mapping(address => uint256) private _balances;

    /// @dev Aggregate ETH held in contract.
    uint256 private _totalStaked;

    /// @dev Per-user stake reserved by lockers (always <= _balances[user]).
    mapping(address => uint256) private _locked;

    /// @dev Contracts authorised to lock/unlock/slash.
    mapping(address => bool) private _lockers;

    // ────────────────────────────────────────────────────────────────────────
    // Construction / modifiers
    // ────────────────────────────────────────────────────────────────────────

    /// @dev Owner = deployer. The owner can only manage the locker allow-list; it can never move funds.
    constructor() Ownable(msg.sender) { }

    modifier onlyLocker() {
        if (!_lockers[msg.sender]) revert NotLocker(msg.sender);
        _;
    }

    // ────────────────────────────────────────────────────────────────────────
    // External mutating functions
    // ────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ITokenStaking
    /// @dev No reentrancy risk: receives ETH (no external call).
    function stake() external payable override {
        // ── Checks ────────────────────────────────────────────────────────
        if (msg.value == 0) revert ZeroStakeAmount();

        // ── Effects ───────────────────────────────────────────────────────
        _balances[msg.sender] += msg.value;
        _totalStaked += msg.value;

        emit Staked(msg.sender, msg.value, _balances[msg.sender]);
    }

    /// @inheritdoc ITokenStaking
    /// @dev Checks-Effects-Interactions: state updated before ETH transfer
    ///      to prevent reentrancy.
    function unstake(uint256 amount) external override {
        // ── Checks ────────────────────────────────────────────────────────
        if (amount == 0) revert ZeroWithdrawAmount();
        uint256 balance = _balances[msg.sender];
        if (amount > balance) revert InsufficientStake(amount, balance);
        // Phase 2: stake reserved by an open dispute cannot be withdrawn.
        uint256 free = balance - _locked[msg.sender];
        if (amount > free) revert StakeIsLocked(amount, free);

        // ── Effects ───────────────────────────────────────────────────────
        _balances[msg.sender] = balance - amount;
        _totalStaked -= amount;

        emit Unstaked(msg.sender, amount, _balances[msg.sender]);

        // ── Interactions ──────────────────────────────────────────────────
        (bool success,) = payable(msg.sender).call{ value: amount }("");
        if (!success) revert TransferFailed();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Phase 2: locker management and stake reservation
    // ────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ITokenStakingLocks
    function setLocker(address locker, bool allowed) external override onlyOwner {
        if (locker == address(0)) revert ZeroAddress();
        _lockers[locker] = allowed;
        emit LockerUpdated(locker, allowed);
    }

    /// @inheritdoc ITokenStakingLocks
    function lockStake(address user, uint256 amount) external override onlyLocker {
        if (amount == 0) revert ZeroLockAmount();
        uint256 free = _balances[user] - _locked[user];
        if (amount > free) revert InsufficientFreeStake(user, amount, free);

        _locked[user] += amount;
        emit StakeLocked(user, amount, _locked[user]);
    }

    /// @inheritdoc ITokenStakingLocks
    function unlockStake(address user, uint256 amount) external override onlyLocker {
        if (amount == 0) revert ZeroLockAmount();
        uint256 locked = _locked[user];
        if (amount > locked) revert InsufficientLockedStake(user, amount, locked);

        _locked[user] = locked - amount;
        emit StakeUnlocked(user, amount, _locked[user]);
    }

    /// @inheritdoc ITokenStakingLocks
    /// @dev Moves LOCKED stake only. No ETH transfer, so no reentrancy surface.
    function slashStake(address from, address to, uint256 amount) external override onlyLocker {
        if (amount == 0) revert ZeroLockAmount();
        if (to == address(0)) revert ZeroAddress();
        uint256 locked = _locked[from];
        if (amount > locked) revert InsufficientLockedStake(from, amount, locked);

        _locked[from] = locked - amount;
        _balances[from] -= amount;
        _balances[to] += amount;

        emit StakeSlashed(from, to, amount);
    }

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ITokenStakingLocks
    function lockedOf(address user) external view override returns (uint256) {
        return _locked[user];
    }

    /// @inheritdoc ITokenStakingLocks
    function freeBalanceOf(address user) external view override returns (uint256) {
        return _balances[user] - _locked[user];
    }

    /// @inheritdoc ITokenStakingLocks
    function isLocker(address account) external view override returns (bool) {
        return _lockers[account];
    }

    /// @inheritdoc ITokenStaking
    function balanceOf(address user) external view override returns (uint256) {
        return _balances[user];
    }

    /// @inheritdoc ITokenStaking
    function totalStaked() external view override returns (uint256) {
        return _totalStaked;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Fallback
    // ────────────────────────────────────────────────────────────────────────

    /// @dev Reject plain ETH transfers to avoid accidentally locked funds.
    receive() external payable {
        revert("Use stake()");
    }
}
