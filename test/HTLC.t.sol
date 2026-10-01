// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { HTLC } from "../contracts/HTLC.sol";
import { IHTLC } from "../contracts/interfaces/IHTLC.sol";

contract HTLCTest is Test {
    HTLC public htlc;

    address payable public funder = payable(makeAddr("funder"));
    address payable public beneficiary = payable(makeAddr("beneficiary"));

    bytes32 public preimage = keccak256("secret_preimage_1234");
    bytes32 public hashlock;
    uint256 public timelock;
    bytes32 public submissionId = keccak256("submission_id_001");

    function setUp() public {
        htlc = new HTLC();
        hashlock = keccak256(abi.encodePacked(preimage));
        timelock = block.timestamp + 1 days;

        vm.deal(funder, 100 ether);
        vm.deal(beneficiary, 1 ether);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Helper
    // ────────────────────────────────────────────────────────────────────────

    function _fund(uint256 amount) internal returns (bytes32 lockId) {
        vm.prank(funder);
        lockId = htlc.fundBounty{ value: amount }(submissionId, beneficiary, hashlock, timelock);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Fund tests
    // ────────────────────────────────────────────────────────────────────────

    function test_fund_successful() public {
        bytes32 lockId = _fund(1 ether);

        assertTrue(htlc.lockExists(lockId));
        IHTLC.Lock memory lock = htlc.getLock(lockId);

        assertEq(lock.funder, funder);
        assertEq(lock.beneficiary, beneficiary);
        assertEq(lock.amount, 1 ether);
        assertEq(lock.hashlock, hashlock);
        assertEq(lock.timelock, timelock);
        assertEq(uint8(lock.status), uint8(IHTLC.Status.FUNDED));
        assertEq(lock.submissionId, submissionId);
        assertEq(address(htlc).balance, 1 ether);
    }

    function test_fund_emitsBountyFundedEvent() public {
        vm.recordLogs();
        bytes32 lockId = _fund(1 ether);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[1], lockId);
        assertEq(logs[0].topics[2], submissionId);
        assertEq(logs[0].topics[3], bytes32(uint256(uint160(address(funder)))));
    }

    function test_fund_multipleHTLCs() public {
        bytes32 id1 = _fund(1 ether);
        vm.roll(block.number + 1);
        bytes32 id2 = _fund(2 ether);

        assertTrue(id1 != id2);
        assertEq(htlc.getLock(id1).amount, 1 ether);
        assertEq(htlc.getLock(id2).amount, 2 ether);
        assertEq(address(htlc).balance, 3 ether);
    }

    function test_revert_fund_zeroAmount() public {
        vm.prank(funder);
        vm.expectRevert(HTLC.ZeroAmount.selector);
        htlc.fundBounty{ value: 0 }(submissionId, beneficiary, hashlock, timelock);
    }

    function test_revert_fund_zeroBeneficiary() public {
        vm.prank(funder);
        vm.expectRevert(HTLC.ZeroBeneficiary.selector);
        htlc.fundBounty{ value: 1 ether }(submissionId, payable(address(0)), hashlock, timelock);
    }

    function test_revert_fund_zeroHashlock() public {
        vm.prank(funder);
        vm.expectRevert(HTLC.ZeroHashlock.selector);
        htlc.fundBounty{ value: 1 ether }(submissionId, beneficiary, bytes32(0), timelock);
    }

    function test_revert_fund_timelockInPast() public {
        vm.prank(funder);
        vm.expectRevert(HTLC.TimelockMustBeFuture.selector);
        htlc.fundBounty{ value: 1 ether }(submissionId, beneficiary, hashlock, block.timestamp);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Claim tests
    // ────────────────────────────────────────────────────────────────────────

    function test_claim_correctPreimage() public {
        bytes32 lockId = _fund(1 ether);
        uint256 balBefore = beneficiary.balance;

        vm.prank(beneficiary);
        htlc.claim(lockId, preimage);

        assertEq(uint8(htlc.getLock(lockId).status), uint8(IHTLC.Status.CLAIMED));
        assertEq(beneficiary.balance, balBefore + 1 ether);
        assertEq(address(htlc).balance, 0);
    }

    function test_claim_emitsBountyClaimedEvent() public {
        bytes32 lockId = _fund(1 ether);
        vm.recordLogs();
        vm.prank(beneficiary);
        htlc.claim(lockId, preimage);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[1], lockId);
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(address(beneficiary)))));
    }

    function test_revert_claim_wrongPreimage() public {
        bytes32 lockId = _fund(1 ether);
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(HTLC.InvalidPreimage.selector, lockId));
        htlc.claim(lockId, keccak256("wrong_preimage"));
    }

    function test_revert_claim_afterRefund() public {
        bytes32 lockId = _fund(1 ether);
        vm.warp(timelock + 1);

        vm.prank(funder);
        htlc.refund(lockId);

        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(HTLC.AlreadyRefunded.selector, lockId));
        htlc.claim(lockId, preimage);
    }

    function test_revert_claim_doubleClaim() public {
        bytes32 lockId = _fund(1 ether);

        vm.prank(beneficiary);
        htlc.claim(lockId, preimage);

        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(HTLC.AlreadyClaimed.selector, lockId));
        htlc.claim(lockId, preimage);
    }

    function test_revert_claim_notBeneficiary() public {
        bytes32 lockId = _fund(1 ether);
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(HTLC.NotBeneficiary.selector, lockId, attacker));
        htlc.claim(lockId, preimage);
    }

    function test_revert_claim_nonexistentLock() public {
        bytes32 fakeId = keccak256("does_not_exist");
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(HTLC.LockNotFound.selector, fakeId));
        htlc.claim(fakeId, preimage);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Refund tests
    // ────────────────────────────────────────────────────────────────────────

    function test_refund_afterTimelock() public {
        bytes32 lockId = _fund(1 ether);
        uint256 balBefore = funder.balance;

        vm.warp(timelock + 1);
        vm.prank(funder);
        htlc.refund(lockId);

        assertEq(uint8(htlc.getLock(lockId).status), uint8(IHTLC.Status.REFUNDED));
        assertEq(funder.balance, balBefore + 1 ether);
        assertEq(address(htlc).balance, 0);
    }

    function test_refund_emitsBountyRefundedEvent() public {
        bytes32 lockId = _fund(1 ether);
        vm.warp(timelock + 1);

        vm.recordLogs();
        vm.prank(funder);
        htlc.refund(lockId);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[1], lockId);
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(address(funder)))));
    }

    function test_revert_refund_beforeTimelock() public {
        bytes32 lockId = _fund(1 ether);

        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(HTLC.TimelockNotExpired.selector, timelock, block.timestamp));
        htlc.refund(lockId);
    }

    function test_revert_refund_atExactTimelock() public {
        bytes32 lockId = _fund(1 ether);
        vm.warp(timelock); // exactly at — still not expired (requires >)

        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(HTLC.TimelockNotExpired.selector, timelock, timelock));
        htlc.refund(lockId);
    }

    function test_revert_refund_afterClaim() public {
        bytes32 lockId = _fund(1 ether);

        vm.prank(beneficiary);
        htlc.claim(lockId, preimage);

        vm.warp(timelock + 1);
        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(HTLC.AlreadyClaimed.selector, lockId));
        htlc.refund(lockId);
    }

    function test_revert_refund_doubleRefund() public {
        bytes32 lockId = _fund(1 ether);
        vm.warp(timelock + 1);

        vm.prank(funder);
        htlc.refund(lockId);

        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(HTLC.AlreadyRefunded.selector, lockId));
        htlc.refund(lockId);
    }

    function test_revert_refund_notFunder() public {
        bytes32 lockId = _fund(1 ether);
        vm.warp(timelock + 1);

        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(HTLC.NotFunder.selector, lockId, attacker));
        htlc.refund(lockId);
    }

    function test_revert_refund_nonexistentLock() public {
        bytes32 fakeId = keccak256("fake");
        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(HTLC.LockNotFound.selector, fakeId));
        htlc.refund(fakeId);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Edge-case / security
    // ────────────────────────────────────────────────────────────────────────

    function test_revert_plainEthTransfer() public {
        (bool ok,) = address(htlc).call{ value: 1 ether }("");
        assertFalse(ok, "plain ETH to HTLC must revert");
    }

    function test_multipleLocks_independentState() public {
        bytes32 preimage2 = keccak256("secret2");
        bytes32 hashlock2 = keccak256(abi.encodePacked(preimage2));

        bytes32 lockId1 = _fund(1 ether);

        vm.roll(block.number + 1);
        vm.prank(funder);
        bytes32 lockId2 = htlc.fundBounty{ value: 2 ether }(submissionId, beneficiary, hashlock2, timelock);

        // Claim first
        vm.prank(beneficiary);
        htlc.claim(lockId1, preimage);

        // Second should still be FUNDED
        assertEq(uint8(htlc.getLock(lockId2).status), uint8(IHTLC.Status.FUNDED));

        // Refund second
        vm.warp(timelock + 1);
        vm.prank(funder);
        htlc.refund(lockId2);

        assertEq(uint8(htlc.getLock(lockId2).status), uint8(IHTLC.Status.REFUNDED));
    }

    function test_lockExists_falseForUnknown() public view {
        assertFalse(htlc.lockExists(keccak256("unknown")));
    }

    // ────────────────────────────────────────────────────────────────────────
    // Fuzz
    // ────────────────────────────────────────────────────────────────────────

    function testFuzz_fundAndClaim(uint96 amount, bytes32 secret) public {
        vm.assume(amount > 0);
        vm.assume(secret != bytes32(0));
        bytes32 hl = keccak256(abi.encodePacked(secret));

        vm.deal(funder, amount);
        vm.prank(funder);
        bytes32 lockId = htlc.fundBounty{ value: amount }(submissionId, beneficiary, hl, timelock);

        uint256 balBefore = beneficiary.balance;
        vm.prank(beneficiary);
        htlc.claim(lockId, secret);

        assertEq(beneficiary.balance, balBefore + amount);
    }
}
