// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import { ISemaphoreGroups } from "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ICredentialRegistry } from "./interfaces/ICredentialRegistry.sol";

/// @title CredentialRegistry
/// @notice Owns one Semaphore group ("vetted journalists / jurors") and gates every use of it.
///
/// Eligibility policy (documented in docs/phase2-architecture.md)
/// ───────────────────────────────────────────────────────────────
///  1. A person is vetted OFF-CHAIN by an attester (a multisig / trusted vetting body in production).
///  2. They generate a Semaphore identity locally and hand ONLY the public identity commitment to the attester.
///  3. The attester adds the commitment to the group (`addCredential`). Possessing a wallet is never enough.
///  4. Protected actions (juror-pool registration, dispute opening) require a valid Semaphore membership proof
///     for an action-specific (scope, message). A nullifier per scope stops reuse.
///  5. Staking is a SEPARATE requirement checked by the consumers (JurorSelection), not by this registry.
///
/// Why the registry is the Semaphore group admin
/// ─────────────────────────────────────────────
///  Only this contract can add/remove members, so "who may join" is exactly the attester allow-list.
///
/// Why nullifiers are tracked here and NOT through `Semaphore.validateProof`
/// ─────────────────────────────────────────────────────────────────────────
///  `validateProof` is callable by anyone and burns the nullifier. A mempool observer could front-run a victim's
///  proof directly against Semaphore and burn the nullifier without performing the action (griefing). Here
///  `verifyProof` (a view) is used and the nullifier is burned only when an authorised consumer actually runs
///  the protected action.
///
/// Limits (also in docs/phase2-security.md)
///  • Revocation is not instantaneous: proofs against an older Merkle root stay valid until
///    `merkleTreeDuration` elapses (Semaphore design).
///  • The attester is a trusted party for WHO is a journalist. Semaphore only hides WHICH member acts.
///
/// @custom:security-contact security@verileaks.example
contract CredentialRegistry is ICredentialRegistry, Ownable2Step {
    // ── Errors ──────────────────────────────────────────────────────────────
    error NotAttester(address caller);
    error NotConsumer(address caller);
    error ZeroAddress();
    error ScopeMismatch(uint256 expected, uint256 actual);
    error MessageMismatch(uint256 expected, uint256 actual);
    error NullifierAlreadyUsed(uint256 scope, uint256 nullifier);
    error NullifierNotOwnedByCaller(uint256 scope, uint256 nullifier);
    error InvalidProof();
    error BatchTooLarge(uint256 size, uint256 max);

    uint256 public constant MAX_BATCH = 50;

    // ── State ───────────────────────────────────────────────────────────────
    ISemaphore public immutable override semaphore;
    uint256 public immutable override groupId;

    mapping(address => bool) public isAttester;
    mapping(address => bool) public isConsumer;

    /// @dev scope => nullifier => consumer that burned it (address(0) = unused).
    mapping(uint256 => mapping(uint256 => address)) private _nullifierConsumer;

    // ── Construction ────────────────────────────────────────────────────────
    /// @param semaphore_          deployed Semaphore contract (official Semaphore v4 deployment or local).
    /// @param initialOwner        governs attesters/consumers (use a multisig outside of development).
    /// @param merkleTreeDuration  seconds an old Merkle root remains acceptable (Semaphore default: 3600).
    constructor(ISemaphore semaphore_, address initialOwner, uint256 merkleTreeDuration) Ownable(initialOwner) {
        if (address(semaphore_) == address(0)) revert ZeroAddress();
        semaphore = semaphore_;
        groupId = semaphore_.createGroup(address(this), merkleTreeDuration);
    }

    // ── Governance ──────────────────────────────────────────────────────────
    function setAttester(address attester, bool allowed) external onlyOwner {
        if (attester == address(0)) revert ZeroAddress();
        isAttester[attester] = allowed;
        emit AttesterUpdated(attester, allowed);
    }

    /// @notice Authorise a contract (JurorSelection, ArbitratedBounty) to consume membership proofs.
    function setConsumer(address consumer, bool allowed) external onlyOwner {
        if (consumer == address(0)) revert ZeroAddress();
        isConsumer[consumer] = allowed;
        emit ConsumerUpdated(consumer, allowed);
    }

    // ── Group management (attesters only) ───────────────────────────────────
    modifier onlyAttester() {
        if (!isAttester[msg.sender]) revert NotAttester(msg.sender);
        _;
    }

    /// @notice Add a vetted participant's Semaphore identity commitment to the group.
    function addCredential(uint256 identityCommitment) external onlyAttester {
        semaphore.addMember(groupId, identityCommitment);
        emit CredentialAdded(identityCommitment, msg.sender);
    }

    function addCredentials(uint256[] calldata identityCommitments) external onlyAttester {
        uint256 n = identityCommitments.length;
        if (n > MAX_BATCH) revert BatchTooLarge(n, MAX_BATCH);
        semaphore.addMembers(groupId, identityCommitments);
        for (uint256 i; i < n; ++i) {
            emit CredentialAdded(identityCommitments[i], msg.sender);
        }
    }

    /// @notice Revoke a credential. `merkleProofSiblings` is the member's current Merkle proof (see Semaphore docs).
    function revokeCredential(uint256 identityCommitment, uint256[] calldata merkleProofSiblings)
        external
        onlyAttester
    {
        semaphore.removeMember(groupId, identityCommitment, merkleProofSiblings);
        emit CredentialRevoked(identityCommitment, msg.sender);
    }

    // ── Proof consumption (authorised consumers only) ───────────────────────
    /// @inheritdoc ICredentialRegistry
    function verifyAndConsume(ISemaphore.SemaphoreProof calldata proof, uint256 expectedScope, uint256 expectedMessage)
        external
        override
        returns (uint256 nullifier)
    {
        // ── Checks ──
        if (!isConsumer[msg.sender]) revert NotConsumer(msg.sender);
        if (proof.scope != expectedScope) revert ScopeMismatch(expectedScope, proof.scope);
        if (proof.message != expectedMessage) revert MessageMismatch(expectedMessage, proof.message);

        nullifier = proof.nullifier;
        if (_nullifierConsumer[expectedScope][nullifier] != address(0)) {
            revert NullifierAlreadyUsed(expectedScope, nullifier);
        }

        // Real Groth16 verification inside Semaphore (reverts on unknown/expired root, empty group, bad depth).
        if (!semaphore.verifyProof(groupId, proof)) revert InvalidProof();

        // ── Effects ──
        _nullifierConsumer[expectedScope][nullifier] = msg.sender;
        emit ProofConsumed(msg.sender, expectedScope, nullifier);
    }

    /// @inheritdoc ICredentialRegistry
    function releaseNullifier(uint256 scope, uint256 nullifier) external override {
        if (_nullifierConsumer[scope][nullifier] != msg.sender) revert NullifierNotOwnedByCaller(scope, nullifier);
        delete _nullifierConsumer[scope][nullifier];
        emit NullifierReleased(msg.sender, scope, nullifier);
    }

    // ── Views ───────────────────────────────────────────────────────────────
    /// @inheritdoc ICredentialRegistry
    function isNullifierUsed(uint256 scope, uint256 nullifier) external view override returns (bool) {
        return _nullifierConsumer[scope][nullifier] != address(0);
    }

    function merkleTreeRoot() external view returns (uint256) {
        return ISemaphoreGroups(address(semaphore)).getMerkleTreeRoot(groupId);
    }

    function memberCount() external view returns (uint256) {
        return ISemaphoreGroups(address(semaphore)).getMerkleTreeSize(groupId);
    }
}
