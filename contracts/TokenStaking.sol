// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITokenStaking } from "./interfaces/ITokenStaking.sol";

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
/// @custom:security-contact security@verileaks.example
contract TokenStaking is ITokenStaking {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error ZeroStakeAmount();
    error ZeroWithdrawAmount();
    error InsufficientStake(uint256 requested, uint256 available);
    error TransferFailed();

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @dev Per-user staked balance in wei.
    mapping(address => uint256) private _balances;

    /// @dev Aggregate ETH held in contract.
    uint256 private _totalStaked;

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

        // ── Effects ───────────────────────────────────────────────────────
        _balances[msg.sender] = balance - amount;
        _totalStaked -= amount;

        emit Unstaked(msg.sender, amount, _balances[msg.sender]);

        // ── Interactions ──────────────────────────────────────────────────
        (bool success,) = payable(msg.sender).call{ value: amount }("");
        if (!success) revert TransferFailed();
    }

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

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
