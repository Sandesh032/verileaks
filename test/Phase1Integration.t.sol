// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { SubmissionRegistry } from "../contracts/SubmissionRegistry.sol";
import { TokenStaking } from "../contracts/TokenStaking.sol";
import { HTLC } from "../contracts/HTLC.sol";
import { IHTLC } from "../contracts/interfaces/IHTLC.sol";

/// @title Phase1IntegrationTest
/// @notice Solidity-level end-to-end test for the Phase 1 bounty workflow.
///
/// Scenario:
///   1. Off-chain: evidence chunked, Merkle root computed, IPFS CID obtained.
///   2. On-chain: CID + root registered in SubmissionRegistry.
///   3. Funder funds an HTLC bounty linked to the submission.
///   4. Beneficiary (whistleblower) claims with correct preimage.
///   5. Verify all state transitions and fund flows.
contract Phase1IntegrationTest is Test {
    SubmissionRegistry public registry;
    TokenStaking public staking;
    HTLC public htlc;

    address payable public funder = payable(makeAddr("funder"));
    address payable public whistleblower = payable(makeAddr("whistleblower"));

    // Simulated off-chain outputs (would come from MerkleTree.js + IPFS)
    string constant EVIDENCE_CID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
    bytes32 constant MERKLE_ROOT = bytes32(uint256(0xdeadbeefcafe1234567890abcdef1234567890abcdef1234567890abcdef5678));

    // HTLC parameters
    bytes32 public preimage;
    bytes32 public hashlock;
    uint256 public bountyTimelock;

    function setUp() public {
        registry = new SubmissionRegistry();
        staking = new TokenStaking();
        htlc = new HTLC();

        vm.deal(funder, 10 ether);
        vm.deal(whistleblower, 1 ether);

        // Simulate off-chain preimage generation
        preimage = keccak256("whistleblower_secret_preimage_phase1");
        hashlock = keccak256(abi.encodePacked(preimage));
        bountyTimelock = block.timestamp + 7 days;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Full Phase 1 end-to-end test
    // ─────────────────────────────────────────────────────────────────────────

    function test_fullPhase1Workflow_fundAndClaim() public {
        console2.log("=== Phase 1 Integration Test: Fund and Claim ===");

        // ── 1. Register submission ────────────────────────────────────────
        vm.prank(whistleblower);
        bytes32 submissionId = registry.registerSubmission(EVIDENCE_CID, MERKLE_ROOT);

        console2.log("Submission registered:", vm.toString(submissionId));
        assertTrue(registry.submissionExists(submissionId), "Submission must exist");
        assertEq(registry.getSubmission(submissionId).ipfsCid, EVIDENCE_CID);
        assertEq(registry.getSubmission(submissionId).merkleRoot, MERKLE_ROOT);
        assertEq(registry.submissionCount(), 1);

        // ── 2. Funder stakes (optional; demonstrates staking module) ──────
        vm.prank(funder);
        staking.stake{ value: 1 ether }();
        assertEq(staking.balanceOf(funder), 1 ether);

        // ── 3. Fund HTLC bounty ───────────────────────────────────────────
        vm.prank(funder);
        bytes32 lockId = htlc.fundBounty{ value: 2 ether }(submissionId, whistleblower, hashlock, bountyTimelock);

        console2.log("HTLC funded, lockId:", vm.toString(lockId));
        assertTrue(htlc.lockExists(lockId), "Lock must exist");
        assertEq(uint8(htlc.getLock(lockId).status), uint8(IHTLC.Status.FUNDED));
        assertEq(htlc.getLock(lockId).amount, 2 ether);
        assertEq(address(htlc).balance, 2 ether);

        // ── 4. Whistleblower claims with correct preimage ─────────────────
        uint256 wbBalBefore = whistleblower.balance;
        vm.prank(whistleblower);
        htlc.claim(lockId, preimage);

        console2.log("Bounty claimed by whistleblower");
        assertEq(uint8(htlc.getLock(lockId).status), uint8(IHTLC.Status.CLAIMED));
        assertEq(whistleblower.balance, wbBalBefore + 2 ether, "Whistleblower must receive bounty");
        assertEq(address(htlc).balance, 0, "HTLC must be empty after claim");

        console2.log("=== Phase 1 Integration Test: PASSED ===");
    }

    function test_fullPhase1Workflow_timedOut_refund() public {
        console2.log("=== Phase 1 Integration Test: Timeout and Refund ===");

        // ── 1. Register submission ────────────────────────────────────────
        vm.prank(whistleblower);
        bytes32 submissionId = registry.registerSubmission(EVIDENCE_CID, MERKLE_ROOT);

        // ── 2. Fund HTLC ──────────────────────────────────────────────────
        vm.prank(funder);
        bytes32 lockId = htlc.fundBounty{ value: 3 ether }(submissionId, whistleblower, hashlock, bountyTimelock);

        // ── 3. Time passes — whistleblower did not claim ──────────────────
        vm.warp(bountyTimelock + 1);

        // ── 4. Funder reclaims ────────────────────────────────────────────
        uint256 funderBalBefore = funder.balance;
        vm.prank(funder);
        htlc.refund(lockId);

        assertEq(uint8(htlc.getLock(lockId).status), uint8(IHTLC.Status.REFUNDED));
        assertEq(funder.balance, funderBalBefore + 3 ether, "Funder must reclaim bounty");
        assertEq(address(htlc).balance, 0);

        console2.log("=== Phase 1 Integration Test: Refund PASSED ===");
    }

    function test_cannotDoubleClaimSubmission() public {
        vm.prank(whistleblower);
        bytes32 submissionId = registry.registerSubmission(EVIDENCE_CID, MERKLE_ROOT);

        vm.prank(funder);
        bytes32 lockId = htlc.fundBounty{ value: 1 ether }(submissionId, whistleblower, hashlock, bountyTimelock);

        vm.prank(whistleblower);
        htlc.claim(lockId, preimage);

        // Second claim must revert
        vm.prank(whistleblower);
        vm.expectRevert(abi.encodeWithSelector(HTLC.AlreadyClaimed.selector, lockId));
        htlc.claim(lockId, preimage);
    }

    function test_cannotRefundAfterClaim() public {
        vm.prank(whistleblower);
        bytes32 submissionId = registry.registerSubmission(EVIDENCE_CID, MERKLE_ROOT);

        vm.prank(funder);
        bytes32 lockId = htlc.fundBounty{ value: 1 ether }(submissionId, whistleblower, hashlock, bountyTimelock);

        vm.prank(whistleblower);
        htlc.claim(lockId, preimage);

        vm.warp(bountyTimelock + 1);
        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(HTLC.AlreadyClaimed.selector, lockId));
        htlc.refund(lockId);
    }

    function test_multipleSubmissionsAndBounties() public {
        bytes32 root2 = keccak256("second evidence root");

        // Submission 1
        vm.prank(whistleblower);
        bytes32 subId1 = registry.registerSubmission(EVIDENCE_CID, MERKLE_ROOT);

        // Submission 2 — different block
        vm.roll(vm.getBlockNumber() + 1);
        vm.prank(whistleblower);
        bytes32 subId2 = registry.registerSubmission("QmDifferentCid", root2);

        assertTrue(subId1 != subId2);
        assertEq(registry.submissionCount(), 2);

        // Two independent bounties
        bytes32 preimage2 = keccak256("another_secret");
        bytes32 hashlock2 = keccak256(abi.encodePacked(preimage2));

        vm.prank(funder);
        bytes32 lock1 = htlc.fundBounty{ value: 1 ether }(subId1, whistleblower, hashlock, bountyTimelock);

        vm.roll(block.number + 1);
        vm.prank(funder);
        bytes32 lock2 = htlc.fundBounty{ value: 2 ether }(subId2, whistleblower, hashlock2, bountyTimelock);

        assertTrue(lock1 != lock2);
        assertEq(address(htlc).balance, 3 ether);

        // Claim both
        vm.prank(whistleblower);
        htlc.claim(lock1, preimage);

        vm.prank(whistleblower);
        htlc.claim(lock2, preimage2);

        assertEq(address(htlc).balance, 0);
    }
}
