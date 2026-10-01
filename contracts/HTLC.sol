// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IHTLC } from "./interfaces/IHTLC.sol";

/// @title HTLC
/// @notice Phase 1 VeriLeaks bounty escrow using Hash Time-Locked Contracts.
///
/// Lifecycle
/// ──────────
///   FUNDED  ──claim(preimage)──► CLAIMED   (beneficiary receives ETH)
///   FUNDED  ──refund()─────────► REFUNDED  (funder reclaims ETH after expiry)
///
/// Security properties enforced
/// ─────────────────────────────
/// • Cannot claim twice (status guard).
/// • Cannot refund before timelock expires.
/// • Cannot claim after refund.
/// • Cannot refund after claim.
/// • Incorrect preimage is rejected.
/// • Zero-value bounties are rejected.
/// • Zero-address beneficiary is rejected.
/// • Reentrancy prevented by Checks-Effects-Interactions.
///
/// @custom:security-contact security@verileaks.example
contract HTLC is IHTLC {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error ZeroAmount();
    error ZeroBeneficiary();
    error ZeroHashlock();
    error TimelockMustBeFuture();
    error LockNotFound(bytes32 lockId);
    error AlreadyClaimed(bytes32 lockId);
    error AlreadyRefunded(bytes32 lockId);
    error NotFunded(bytes32 lockId);
    error TimelockNotExpired(uint256 timelock, uint256 current);
    error InvalidPreimage(bytes32 lockId);
    error NotBeneficiary(bytes32 lockId, address caller);
    error NotFunder(bytes32 lockId, address caller);
    error TransferFailed();

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @dev lockId → Lock
    mapping(bytes32 => Lock) private _locks;

    /// @dev Track which lockIds have ever been created to distinguish
    ///      "not found" from "zero-value struct".
    mapping(bytes32 => bool) private _lockExists;

    // ────────────────────────────────────────────────────────────────────────
    // External mutating functions
    // ────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IHTLC
    function fundBounty(bytes32 submissionId, address payable beneficiary, bytes32 hashlock, uint256 timelock)
        external
        payable
        override
        returns (bytes32 lockId)
    {
        // ── Checks ────────────────────────────────────────────────────────
        if (msg.value == 0) revert ZeroAmount();
        if (beneficiary == address(0)) revert ZeroBeneficiary();
        if (hashlock == bytes32(0)) revert ZeroHashlock();
        if (timelock <= block.timestamp) revert TimelockMustBeFuture();

        // Derive a unique lock ID. Using block.number prevents the same
        // (submissionId, hashlock) funded in different blocks from colliding.
        lockId = keccak256(abi.encodePacked(submissionId, hashlock, msg.sender, block.number));

        // ── Effects ───────────────────────────────────────────────────────
        _locks[lockId] = Lock({
            submissionId: submissionId,
            funder: payable(msg.sender),
            beneficiary: beneficiary,
            amount: msg.value,
            hashlock: hashlock,
            timelock: timelock,
            status: Status.FUNDED
        });
        _lockExists[lockId] = true;

        // ── Event ─────────────────────────────────────────────────────────
        emit BountyFunded(lockId, submissionId, msg.sender, beneficiary, msg.value, hashlock, timelock);
    }

    /// @inheritdoc IHTLC
    /// @dev Checks-Effects-Interactions: ETH is sent AFTER state update.
    function claim(bytes32 lockId, bytes32 preimage) external override {
        // ── Checks ────────────────────────────────────────────────────────
        if (!_lockExists[lockId]) revert LockNotFound(lockId);

        Lock storage lock = _locks[lockId];

        if (lock.status == Status.CLAIMED) revert AlreadyClaimed(lockId);
        if (lock.status == Status.REFUNDED) revert AlreadyRefunded(lockId);
        // Status must be FUNDED at this point.

        if (msg.sender != lock.beneficiary) revert NotBeneficiary(lockId, msg.sender);
        if (keccak256(abi.encodePacked(preimage)) != lock.hashlock) revert InvalidPreimage(lockId);

        // ── Effects ───────────────────────────────────────────────────────
        lock.status = Status.CLAIMED;
        uint256 amount = lock.amount;

        emit BountyClaimed(lockId, msg.sender, preimage);

        // ── Interactions ──────────────────────────────────────────────────
        (bool success,) = lock.beneficiary.call{ value: amount }("");
        if (!success) revert TransferFailed();
    }

    /// @inheritdoc IHTLC
    /// @dev Checks-Effects-Interactions: ETH is sent AFTER state update.
    function refund(bytes32 lockId) external override {
        // ── Checks ────────────────────────────────────────────────────────
        if (!_lockExists[lockId]) revert LockNotFound(lockId);

        Lock storage lock = _locks[lockId];

        if (lock.status == Status.CLAIMED) revert AlreadyClaimed(lockId);
        if (lock.status == Status.REFUNDED) revert AlreadyRefunded(lockId);

        if (msg.sender != lock.funder) revert NotFunder(lockId, msg.sender);
        if (block.timestamp <= lock.timelock) revert TimelockNotExpired(lock.timelock, block.timestamp);

        // ── Effects ───────────────────────────────────────────────────────
        lock.status = Status.REFUNDED;
        uint256 amount = lock.amount;

        emit BountyRefunded(lockId, msg.sender);

        // ── Interactions ──────────────────────────────────────────────────
        (bool success,) = lock.funder.call{ value: amount }("");
        if (!success) revert TransferFailed();
    }

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IHTLC
    function getLock(bytes32 lockId) external view override returns (Lock memory) {
        return _locks[lockId];
    }

    /// @inheritdoc IHTLC
    function lockExists(bytes32 lockId) external view override returns (bool) {
        return _lockExists[lockId];
    }

    // ────────────────────────────────────────────────────────────────────────
    // Fallback
    // ────────────────────────────────────────────────────────────────────────

    /// @dev Reject plain ETH transfers; ETH must enter only through fundBounty.
    receive() external payable {
        revert("Use fundBounty()");
    }
}
