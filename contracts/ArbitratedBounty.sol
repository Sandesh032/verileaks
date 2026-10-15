// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IHTLC } from "./interfaces/IHTLC.sol";
import { ISubmissionRegistry } from "./interfaces/ISubmissionRegistry.sol";
import { ISchellingVoting } from "./interfaces/ISchellingVoting.sol";
import { ICredentialRegistry } from "./interfaces/ICredentialRegistry.sol";
import { ProofBindings } from "./libraries/ProofBindings.sol";

/// @title ArbitratedBounty
/// @notice Connects finalized arbitration outcomes to the UNMODIFIED Phase 1 {HTLC} escrow.
///
/// Why an adapter (and not an HTLC change)
/// ───────────────────────────────────────
///  The Phase 1 HTLC only knows "beneficiary claims with a preimage" and "funder refunds after the timelock".
///  It has no notion of an arbiter. Rather than rewriting it, this contract uses the HTLC as the vault:
///    • The adapter is BOTH the HTLC funder and the HTLC beneficiary of every arbitrated lock.
///    • The HTLC's `claim` requires msg.sender == beneficiary, so only this contract can ever claim.
///      The preimage is therefore NOT a secret (it is derived from public data); authorisation is the
///      beneficiary check, not secrecy. Nobody else can claim and the original funder cannot refund directly.
///    • REAL verdict  → adapter calls `htlc.claim` and credits the whistleblower (pull payment).
///    • FAKE verdict  → bounty becomes REJECTED; after the HTLC timelock the adapter calls `htlc.refund`
///                      and credits the original funder. (HTLC refunds are time-locked, so a FAKE verdict
///                      cannot return funds earlier than the timelock the funder chose: documented limitation.)
///    • INCONCLUSIVE / cancelled dispute → bounty returns to FUNDED and may be disputed again (≤ MAX_OPENS).
///
/// Authorisation of outcomes
/// ─────────────────────────
///  `settle` takes NO outcome argument. It reads the result from the configured SchellingVoting contract and
///  additionally checks that the dispute was created by THIS adapter for THIS bountyId and submission.
///  A frontend, relayer, or caller cannot assert or inject a result.
///
/// Dispute initiation
/// ──────────────────
///  `openDispute` needs a valid Semaphore proof of credential membership. Scope = (this, bountyId, attempt),
///  so each credential can open at most one dispute per bounty attempt; message binds the same parameters.
///  The proof hides WHICH credential holder opened it; the transaction sender is still public (a relayer
///  can be used later; none exists in this repository).
///
/// State machine
///   FUNDED ──openDispute──► DISPUTED ──settle(REAL)──► RELEASED
///     ▲  ▲                      │──settle(FAKE)──► REJECTED ──refund (after timelock)──► REFUNDED
///     │  └── settle(INCONCLUSIVE | CANCELLED) ◄──┘
///     └── refund (after timelock, only while no dispute is active) ──► REFUNDED
///
/// @custom:security-contact security@verileaks.example
contract ArbitratedBounty is ReentrancyGuard {
    // ── Types ───────────────────────────────────────────────────────────────
    enum Status {
        NONE,
        FUNDED,
        DISPUTED,
        RELEASED,
        REJECTED,
        REFUNDED
    }

    struct Bounty {
        bytes32 submissionId;
        address funder;
        address whistleblower;
        uint256 amount;
        bytes32 lockId;
        uint256 timelock;
        Status status;
        uint8 openCount;
        uint256 activeDispute;
    }

    // ── Errors ──────────────────────────────────────────────────────────────
    error ZeroAddress();
    error AmountTooSmall(uint256 amount, uint256 min);
    error LockTooShort(uint256 timelock, uint256 minTimelock);
    error UnknownSubmission(bytes32 submissionId);
    error UnknownBounty(uint256 bountyId);
    error InvalidStatus(uint256 bountyId, Status status);
    error MaxDisputesReached(uint256 bountyId);
    error DisputeWindowClosed(uint256 timelock, uint256 nowTs);
    error DisputeNotResolved(uint256 disputeId, ISchellingVoting.Status status);
    error DisputeLinkMismatch(uint256 disputeId);
    error TimelockNotExpired(uint256 timelock, uint256 nowTs);
    error NothingToWithdraw();
    error TransferFailed();
    error OnlyHtlc(address caller);

    // ── Events ──────────────────────────────────────────────────────────────
    event BountyFunded(
        uint256 indexed bountyId,
        bytes32 indexed submissionId,
        address indexed funder,
        address whistleblower,
        uint256 amount,
        bytes32 lockId,
        uint256 timelock
    );
    event DisputeOpened(uint256 indexed bountyId, uint256 indexed disputeId, uint256 attempt, uint256 nullifier);
    event BountySettled(uint256 indexed bountyId, uint256 indexed disputeId, ISchellingVoting.Outcome outcome, Status newStatus);
    event BountyRefunded(uint256 indexed bountyId, address indexed funder, uint256 amount);
    event PayoutCredited(address indexed account, uint256 amount);
    event PayoutWithdrawn(address indexed account, uint256 amount);

    // ── Constants / wiring ──────────────────────────────────────────────────
    bytes32 public constant PREIMAGE_TAG = keccak256("VERILEAKS_ARBITRATED_BOUNTY_PREIMAGE_V1");
    uint8 public constant MAX_OPENS = 6;

    IHTLC public immutable htlc;
    ISubmissionRegistry public immutable registry;
    ISchellingVoting public immutable voting;
    ICredentialRegistry public immutable credentials;
    /// @dev Spam guard: every dispute costs a VRF request paid from the protocol's subscription.
    uint256 public immutable minBounty;
    /// @dev Minimum time between funding and timelock so that selection+commit+reveal can complete.
    uint256 public immutable minLockDuration;

    // ── State ───────────────────────────────────────────────────────────────
    uint256 public bountyCount;
    mapping(uint256 => Bounty) private _bounties;
    mapping(uint256 => uint256) public bountyOfDispute;
    mapping(address => uint256) public pendingPayout;

    constructor(
        IHTLC htlc_,
        ISubmissionRegistry registry_,
        ISchellingVoting voting_,
        ICredentialRegistry credentials_,
        uint256 minBounty_,
        uint256 minLockDuration_
    ) {
        if (
            address(htlc_) == address(0) || address(registry_) == address(0) || address(voting_) == address(0)
                || address(credentials_) == address(0)
        ) revert ZeroAddress();
        htlc = htlc_;
        registry = registry_;
        voting = voting_;
        credentials = credentials_;
        minBounty = minBounty_;
        minLockDuration = minLockDuration_;
    }

    // ── Funding ─────────────────────────────────────────────────────────────
    /// @notice Escrow a bounty in the Phase 1 HTLC under arbitration control.
    /// @param whistleblower  address paid on a REAL verdict (use a fresh address; it is public).
    /// @param timelock       HTLC refund time (unix seconds). Disputes can only be opened before it.
    function fundBounty(bytes32 submissionId, address whistleblower, uint256 timelock)
        external
        payable
        nonReentrant
        returns (uint256 bountyId)
    {
        if (whistleblower == address(0)) revert ZeroAddress();
        if (msg.value < minBounty || msg.value == 0) revert AmountTooSmall(msg.value, minBounty);
        if (timelock < block.timestamp + minLockDuration) revert LockTooShort(timelock, block.timestamp + minLockDuration);
        if (!registry.submissionExists(submissionId)) revert UnknownSubmission(submissionId);

        bountyId = ++bountyCount;
        Bounty storage b = _bounties[bountyId];
        b.submissionId = submissionId;
        b.funder = msg.sender;
        b.whistleblower = whistleblower;
        b.amount = msg.value;
        b.timelock = timelock;
        b.status = Status.FUNDED;

        // Unique hashlock per bounty ⇒ unique HTLC lockId, so an existing lock can never be overwritten.
        bytes32 lockId = htlc.fundBounty{ value: msg.value }(
            submissionId, payable(address(this)), keccak256(abi.encodePacked(_preimage(bountyId))), timelock
        );
        b.lockId = lockId;

        emit BountyFunded(bountyId, submissionId, msg.sender, whistleblower, msg.value, lockId, timelock);
    }

    // ── Dispute initiation ──────────────────────────────────────────────────
    /// @notice Open an arbitration dispute for a funded bounty. Requires a Semaphore credential proof.
    function openDispute(uint256 bountyId, ISemaphore.SemaphoreProof calldata proof)
        external
        nonReentrant
        returns (uint256 disputeId)
    {
        Bounty storage b = _get(bountyId);
        if (b.status != Status.FUNDED) revert InvalidStatus(bountyId, b.status);
        if (b.openCount >= MAX_OPENS) revert MaxDisputesReached(bountyId);
        if (block.timestamp >= b.timelock) revert DisputeWindowClosed(b.timelock, block.timestamp);

        uint256 attempt = b.openCount;
        uint256 nullifier = credentials.verifyAndConsume(
            proof,
            ProofBindings.disputeOpenScope(address(this), bountyId, attempt),
            ProofBindings.disputeOpenMessage(address(this), bountyId, attempt)
        );

        // ── Effects ──
        b.openCount = uint8(attempt + 1);
        b.status = Status.DISPUTED;

        // ── Interaction (trusted voting contract) ──
        disputeId = voting.createDispute(b.submissionId, bountyId, b.funder, b.whistleblower);
        b.activeDispute = disputeId;
        bountyOfDispute[disputeId] = bountyId;

        emit DisputeOpened(bountyId, disputeId, attempt, nullifier);
    }

    // ── Settlement ──────────────────────────────────────────────────────────
    /// @notice Apply the finalized (or cancelled) dispute result. Permissionless: takes no outcome argument.
    function settle(uint256 bountyId) external nonReentrant {
        Bounty storage b = _get(bountyId);
        if (b.status != Status.DISPUTED) revert InvalidStatus(bountyId, b.status);

        uint256 disputeId = b.activeDispute;
        (
            ISchellingVoting.Status vStatus,
            ISchellingVoting.Outcome outcome,
            address creator,
            uint256 externalRef,
            bytes32 submissionId
        ) = voting.resultOf(disputeId);

        // Unambiguous link between the dispute and THIS bounty.
        if (creator != address(this) || externalRef != bountyId || submissionId != b.submissionId) {
            revert DisputeLinkMismatch(disputeId);
        }

        if (vStatus == ISchellingVoting.Status.CANCELLED) {
            b.activeDispute = 0;
            b.status = Status.FUNDED;
        } else if (vStatus == ISchellingVoting.Status.FINALIZED) {
            b.activeDispute = 0;
            if (outcome == ISchellingVoting.Outcome.REAL) {
                // ── Effects ──
                b.status = Status.RELEASED;
                pendingPayout[b.whistleblower] += b.amount;
                emit PayoutCredited(b.whistleblower, b.amount);
                // ── Interaction: HTLC sends the ETH to this contract (receive() accepts only the HTLC) ──
                htlc.claim(b.lockId, _preimage(bountyId));
            } else if (outcome == ISchellingVoting.Outcome.FAKE) {
                b.status = Status.REJECTED;
            } else if (outcome == ISchellingVoting.Outcome.INCONCLUSIVE) {
                b.status = Status.FUNDED;
            } else {
                revert DisputeNotResolved(disputeId, vStatus);
            }
        } else {
            revert DisputeNotResolved(disputeId, vStatus);
        }

        emit BountySettled(bountyId, disputeId, outcome, b.status);
    }

    /// @notice Return the escrow to the funder once the HTLC timelock has passed and no dispute is active.
    ///         Allowed from FUNDED (never disputed / inconclusive) and REJECTED (FAKE verdict). Permissionless
    ///         trigger; funds are credited to the original funder.
    function refund(uint256 bountyId) external nonReentrant {
        Bounty storage b = _get(bountyId);
        if (b.status != Status.FUNDED && b.status != Status.REJECTED) revert InvalidStatus(bountyId, b.status);
        // Matches HTLC.refund's own rule (block.timestamp > timelock).
        if (block.timestamp <= b.timelock) revert TimelockNotExpired(b.timelock, block.timestamp);

        // ── Effects ──
        b.status = Status.REFUNDED;
        pendingPayout[b.funder] += b.amount;
        emit PayoutCredited(b.funder, b.amount);
        emit BountyRefunded(bountyId, b.funder, b.amount);

        // ── Interaction ──
        htlc.refund(b.lockId);
    }

    /// @notice Pull payment (avoids pushing ETH to arbitrary recipients during settlement).
    function withdraw() external nonReentrant {
        uint256 amount = pendingPayout[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingPayout[msg.sender] = 0;
        emit PayoutWithdrawn(msg.sender, amount);
        (bool ok,) = payable(msg.sender).call{ value: amount }("");
        if (!ok) revert TransferFailed();
    }

    // ── Views ───────────────────────────────────────────────────────────────
    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return _bounties[bountyId];
    }

    // ── Internals ───────────────────────────────────────────────────────────
    function _get(uint256 bountyId) private view returns (Bounty storage b) {
        b = _bounties[bountyId];
        if (b.status == Status.NONE) revert UnknownBounty(bountyId);
    }

    /// @dev Public by design: the HTLC authorises by `msg.sender == beneficiary`, not by secrecy.
    function _preimage(uint256 bountyId) private view returns (bytes32) {
        return keccak256(abi.encode(PREIMAGE_TAG, block.chainid, address(this), bountyId));
    }

    /// @dev ETH is accepted only as the payout of an HTLC claim/refund.
    receive() external payable {
        if (msg.sender != address(htlc)) revert OnlyHtlc(msg.sender);
    }
}
