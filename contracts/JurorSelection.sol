// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { VRFConsumerBaseV2Plus } from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import { VRFV2PlusClient } from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IJurorSelection } from "./interfaces/IJurorSelection.sol";
import { ISchellingVoting } from "./interfaces/ISchellingVoting.sol";
import { ICredentialRegistry } from "./interfaces/ICredentialRegistry.sol";
import { ITokenStakingLocks } from "./interfaces/ITokenStakingLocks.sol";
import { ProofBindings } from "./libraries/ProofBindings.sol";

/// @title JurorSelection
/// @notice Bounded juror pool + Chainlink VRF v2.5 consumer. Knows nothing about votes or reward accounting.
///
/// Candidate pool (MVP)
/// ────────────────────
///  • A wallet joins with `registerJuror(proof)`: (a) a valid Semaphore membership proof whose message binds
///    THIS wallet (so a proof cannot be hijacked from the mempool for another wallet) and (b) enough free stake
///    in TokenStaking. One credential ⇒ one pool slot at a time (nullifier per scope).
///  • The pool is a plain array capped at MAX_POOL. A cap is what makes selection gas-bounded: the callback
///    loops over at most MAX_POOL candidates. On-chain enumeration does NOT scale beyond a few hundred entries;
///    a production design needs an off-chain indexed pool + on-chain Merkle commitment (documented limitation).
///  • The juror's WALLET is public (needed for stake/slashing). Semaphore hides which credential holder it is,
///    not that this wallet is a juror.
///
/// Selection (executed atomically inside the VRF callback, so there is no window between "randomness known" and
/// "jurors fixed" during which anyone could react to the result)
/// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
///  1. eligible = pool entries that are not excluded and have freeBalance ≥ stakePerJuror (≤ MAX_POOL staticcalls).
///  2. If |eligible| < jurySize → selection FAILS (never silently shrinks the jury).
///  3. Partial Fisher–Yates over `eligible`; step i picks j = i + keccak(word, i) mod (n − i). Distinct by
///     construction. Pool order is attacker-influenceable but irrelevant: a uniform shuffle of any ordering is
///     uniform, and the order is fixed before the VRF word exists. Modulo bias ≤ 2^-248 (n ≤ 128).
///
/// Failure handling
/// ────────────────
///  • The VRF callback NEVER reverts for logic reasons (a revert would burn the randomness: the coordinator does
///    not retry). Unknown/duplicate/cancelled requests are ignored, a failed downstream call is caught.
///  • If randomness never arrives, the voting contract cancels after `selectionTimeout`; late randomness is then
///    ignored. There is deliberately NO fallback randomness (no block.timestamp / prevrandao / blockhash).
///
/// @custom:security-contact security@verileaks.example
contract JurorSelection is IJurorSelection, VRFConsumerBaseV2Plus, ReentrancyGuard {
    // ── Types ───────────────────────────────────────────────────────────────
    enum RequestStatus {
        NONE,
        PENDING,
        FULFILLED,
        CANCELLED,
        FAILED
    }

    struct Request {
        uint256 disputeId;
        RequestStatus status;
        uint8 jurySize;
        uint256 stakePerJuror;
        address excludedA;
        address excludedB;
        uint256 randomWord;
    }

    // ── Errors ──────────────────────────────────────────────────────────────
    // NOTE: `ZeroAddress()` is inherited from VRFConsumerBaseV2Plus.
    error NotVoting(address caller);
    error VotingAlreadySet();
    error VotingNotSet();
    error AlreadyRegistered(address juror);
    error NotRegistered(address juror);
    error PoolFull(uint256 max);
    error PoolTooSmall(uint256 poolSize, uint256 required);
    error InsufficientPoolStake(uint256 free, uint256 required);
    error InvalidJurySize(uint8 jurySize);
    error SelectionAlreadyRequested(uint256 disputeId);
    error NoSuchSelection(uint256 disputeId);
    error CallbackGasTooHigh(uint32 given, uint32 max);

    // ── Events ──────────────────────────────────────────────────────────────
    event JurorRegistered(address indexed juror, uint256 nullifier, uint256 poolSize);
    event JurorRemoved(address indexed juror, uint256 poolSize, bool byOwner);
    event SelectionRequested(uint256 indexed disputeId, uint256 indexed requestId, uint8 jurySize);
    event JurorsSelected(uint256 indexed disputeId, uint256 indexed requestId, address[] jurors);
    event SelectionFailed(uint256 indexed disputeId, uint256 indexed requestId, string reason);
    event SelectionCancelled(uint256 indexed disputeId, uint256 indexed requestId);
    event FulfillmentIgnored(uint256 indexed requestId, RequestStatus status);
    event VrfConfigUpdated(
        bytes32 keyHash, uint256 subscriptionId, uint16 confirmations, uint32 callbackGasLimit, bool nativePayment
    );
    event MinPoolStakeUpdated(uint256 minPoolStake);
    event VotingSet(address voting);

    // ── Constants ───────────────────────────────────────────────────────────
    uint256 public constant MAX_POOL = 128;
    uint8 public constant MAX_JURY = 15;
    /// @dev Highest callback gas allowed by Chainlink VRF v2.5 on Arbitrum Sepolia is 2,500,000 (official docs).
    uint32 public constant MAX_CALLBACK_GAS = 2_500_000;

    // ── Immutable wiring ────────────────────────────────────────────────────
    ICredentialRegistry public immutable credentials;
    ITokenStakingLocks public immutable staking;

    // ── Config ──────────────────────────────────────────────────────────────
    address public voting;
    uint256 public minPoolStake;

    bytes32 public keyHash;
    uint256 public subscriptionId;
    uint16 public requestConfirmations;
    uint32 public callbackGasLimit;
    bool public nativePayment;

    // ── Pool ────────────────────────────────────────────────────────────────
    address[] private _pool;
    mapping(address => uint256) private _poolIndexPlusOne;
    mapping(address => uint256) private _jurorNullifier;

    // ── Requests ────────────────────────────────────────────────────────────
    mapping(uint256 => Request) private _requests; // requestId => request
    mapping(uint256 => uint256) private _requestIdOfDispute; // disputeId => requestId

    // ── Construction ────────────────────────────────────────────────────────
    /// @param vrfCoordinator   VRF v2.5 coordinator (value from official docs; NOT hard-coded here).
    constructor(
        address vrfCoordinator,
        ICredentialRegistry credentials_,
        ITokenStakingLocks staking_,
        uint256 minPoolStake_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint16 requestConfirmations_,
        uint32 callbackGasLimit_,
        bool nativePayment_
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        if (address(credentials_) == address(0) || address(staking_) == address(0)) revert ZeroAddress();
        credentials = credentials_;
        staking = staking_;
        minPoolStake = minPoolStake_;
        _setVrfConfig(keyHash_, subscriptionId_, requestConfirmations_, callbackGasLimit_, nativePayment_);
    }

    // ── Governance ──────────────────────────────────────────────────────────
    /// @notice One-time wiring of the voting contract (the only caller allowed to request selections).
    function setVoting(address voting_) external onlyOwner {
        if (voting != address(0)) revert VotingAlreadySet();
        if (voting_ == address(0)) revert ZeroAddress();
        voting = voting_;
        emit VotingSet(voting_);
    }

    function setVrfConfig(
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint16 requestConfirmations_,
        uint32 callbackGasLimit_,
        bool nativePayment_
    ) external onlyOwner {
        _setVrfConfig(keyHash_, subscriptionId_, requestConfirmations_, callbackGasLimit_, nativePayment_);
    }

    function setMinPoolStake(uint256 minPoolStake_) external onlyOwner {
        minPoolStake = minPoolStake_;
        emit MinPoolStakeUpdated(minPoolStake_);
    }

    function _setVrfConfig(
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint16 requestConfirmations_,
        uint32 callbackGasLimit_,
        bool nativePayment_
    ) private {
        if (callbackGasLimit_ > MAX_CALLBACK_GAS) revert CallbackGasTooHigh(callbackGasLimit_, MAX_CALLBACK_GAS);
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        requestConfirmations = requestConfirmations_;
        callbackGasLimit = callbackGasLimit_;
        nativePayment = nativePayment_;
        emit VrfConfigUpdated(keyHash_, subscriptionId_, requestConfirmations_, callbackGasLimit_, nativePayment_);
    }

    // ── Pool membership ─────────────────────────────────────────────────────
    /// @notice Join the juror pool: Semaphore credential proof (bound to msg.sender) + free stake ≥ minPoolStake.
    function registerJuror(ISemaphore.SemaphoreProof calldata proof) external nonReentrant {
        // ── Checks ──
        if (_poolIndexPlusOne[msg.sender] != 0) revert AlreadyRegistered(msg.sender);
        if (_pool.length >= MAX_POOL) revert PoolFull(MAX_POOL);
        uint256 free = staking.freeBalanceOf(msg.sender);
        if (free < minPoolStake) revert InsufficientPoolStake(free, minPoolStake);

        // ── Interaction with trusted registry (reverts on any invalid proof / reused nullifier) ──
        uint256 nullifier = credentials.verifyAndConsume(
            proof,
            ProofBindings.jurorRegistrationScope(address(this)),
            ProofBindings.jurorRegistrationMessage(address(this), msg.sender)
        );

        // ── Effects ──
        _pool.push(msg.sender);
        _poolIndexPlusOne[msg.sender] = _pool.length;
        _jurorNullifier[msg.sender] = nullifier;

        emit JurorRegistered(msg.sender, nullifier, _pool.length);
    }

    /// @notice Leave the pool. Frees the credential so it can later register a (possibly different) wallet.
    /// @dev    Stake locked by open disputes stays locked in TokenStaking; leaving does not release it.
    function deregisterJuror() external nonReentrant {
        _removeJuror(msg.sender, false);
    }

    /// @notice Governance escape hatch: eject a juror (e.g. revoked credential). Owner cannot touch stake.
    function removeJurorByOwner(address juror) external onlyOwner nonReentrant {
        _removeJuror(juror, true);
    }

    function _removeJuror(address juror, bool byOwner) private {
        uint256 idxPlusOne = _poolIndexPlusOne[juror];
        if (idxPlusOne == 0) revert NotRegistered(juror);

        // ── Effects (swap-and-pop) ──
        uint256 lastIdx = _pool.length - 1;
        uint256 idx = idxPlusOne - 1;
        if (idx != lastIdx) {
            address moved = _pool[lastIdx];
            _pool[idx] = moved;
            _poolIndexPlusOne[moved] = idx + 1;
        }
        _pool.pop();
        delete _poolIndexPlusOne[juror];
        uint256 nullifier = _jurorNullifier[juror];
        delete _jurorNullifier[juror];

        // ── Interaction ──
        credentials.releaseNullifier(ProofBindings.jurorRegistrationScope(address(this)), nullifier);

        emit JurorRemoved(juror, _pool.length, byOwner);
    }

    // ── Selection requests (voting contract only) ───────────────────────────
    modifier onlyVoting() {
        if (voting == address(0)) revert VotingNotSet();
        if (msg.sender != voting) revert NotVoting(msg.sender);
        _;
    }

    /// @inheritdoc IJurorSelection
    function requestSelection(
        uint256 disputeId,
        uint8 jurySize,
        uint256 stakePerJuror,
        address excludedA,
        address excludedB
    ) external override onlyVoting returns (uint256 requestId) {
        if (jurySize == 0 || jurySize > MAX_JURY) revert InvalidJurySize(jurySize);
        if (_requestIdOfDispute[disputeId] != 0) revert SelectionAlreadyRequested(disputeId);
        // Fail fast (clean revert in createDispute) when the pool cannot possibly supply a jury.
        if (_pool.length < jurySize) revert PoolTooSmall(_pool.length, jurySize);

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({ nativePayment: nativePayment }))
            })
        );

        _requests[requestId] = Request({
            disputeId: disputeId,
            status: RequestStatus.PENDING,
            jurySize: jurySize,
            stakePerJuror: stakePerJuror,
            excludedA: excludedA,
            excludedB: excludedB,
            randomWord: 0
        });
        _requestIdOfDispute[disputeId] = requestId;

        emit SelectionRequested(disputeId, requestId, jurySize);
    }

    /// @inheritdoc IJurorSelection
    function cancelSelection(uint256 disputeId) external override onlyVoting {
        uint256 requestId = _requestIdOfDispute[disputeId];
        if (requestId == 0) revert NoSuchSelection(disputeId);
        Request storage r = _requests[requestId];
        if (r.status == RequestStatus.PENDING) {
            r.status = RequestStatus.CANCELLED;
            emit SelectionCancelled(disputeId, requestId);
        }
    }

    // ── VRF callback ────────────────────────────────────────────────────────
    /// @dev Called by the coordinator via `rawFulfillRandomWords` (which enforces msg.sender == coordinator).
    ///      Must not revert for logic reasons: the coordinator will not re-deliver randomness.
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        Request storage r = _requests[requestId];
        if (r.status != RequestStatus.PENDING || randomWords.length == 0) {
            emit FulfillmentIgnored(requestId, r.status);
            return;
        }

        uint256 disputeId = r.disputeId;
        uint256 word = randomWords[0];
        r.randomWord = word;

        (address[] memory jurors, bool ok) = _select(word, r.jurySize, r.stakePerJuror, r.excludedA, r.excludedB);

        if (!ok) {
            r.status = RequestStatus.FAILED;
            emit SelectionFailed(disputeId, requestId, "not enough eligible jurors");
            try ISchellingVoting(voting).onSelectionFailed(disputeId) { } catch { }
            return;
        }

        // Optimistic: downstream call locks stakes; if it reverts, none of its effects persist.
        r.status = RequestStatus.FULFILLED;
        try ISchellingVoting(voting).onJurorsSelected(disputeId, jurors) {
            emit JurorsSelected(disputeId, requestId, jurors);
        } catch {
            r.status = RequestStatus.FAILED;
            emit SelectionFailed(disputeId, requestId, "voting rejected selection");
            try ISchellingVoting(voting).onSelectionFailed(disputeId) { } catch { }
        }
    }

    /// @dev Deterministic: same (pool state, word, params) ⇒ same jurors. Bounded by MAX_POOL.
    function _select(uint256 word, uint8 jurySize, uint256 stakePerJuror, address exA, address exB)
        private
        view
        returns (address[] memory jurors, bool ok)
    {
        uint256 poolLen = _pool.length;
        address[] memory eligible = new address[](poolLen);
        uint256 n = 0;
        for (uint256 i = 0; i < poolLen; ++i) {
            address cand = _pool[i];
            if (cand == exA || cand == exB) continue;
            if (staking.freeBalanceOf(cand) < stakePerJuror) continue;
            eligible[n++] = cand;
        }
        if (n < jurySize) return (new address[](0), false);

        jurors = new address[](jurySize);
        for (uint256 i; i < jurySize; ++i) {
            uint256 j = i + (uint256(keccak256(abi.encode(word, i))) % (n - i));
            (eligible[i], eligible[j]) = (eligible[j], eligible[i]);
            jurors[i] = eligible[i];
        }
        ok = true;
    }

    // ── Views ───────────────────────────────────────────────────────────────
    function poolSize() external view returns (uint256) {
        return _pool.length;
    }

    function poolAt(uint256 index) external view returns (address) {
        return _pool[index];
    }

    function isRegistered(address juror) external view returns (bool) {
        return _poolIndexPlusOne[juror] != 0;
    }

    function requestIdOf(uint256 disputeId) external view returns (uint256) {
        return _requestIdOfDispute[disputeId];
    }

    function getRequest(uint256 requestId) external view returns (Request memory) {
        return _requests[requestId];
    }

    /// @notice Pure helper so off-chain tooling / tests can predict a selection for a given word.
    function previewSelection(uint256 word, uint8 jurySize, uint256 stakePerJuror, address exA, address exB)
        external
        view
        returns (address[] memory jurors, bool ok)
    {
        return _select(word, jurySize, stakePerJuror, exA, exB);
    }
}
