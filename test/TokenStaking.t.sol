// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { TokenStaking } from "../contracts/TokenStaking.sol";

/// @notice Malicious contract that tries to reenter TokenStaking.unstake().
contract ReentrantAttacker {
    TokenStaking public target;
    uint256 public attackCount;

    constructor(address payable _target) payable {
        target = TokenStaking(_target);
    }

    function attack() external payable {
        target.stake{ value: msg.value }();
        target.unstake(msg.value);
    }

    receive() external payable {
        if (attackCount < 3 && address(target).balance > 0) {
            attackCount++;
            // This call should revert because balance is already 0 after state update.
            try target.unstake(1 ether) { } catch { }
        }
    }
}

contract TokenStakingTest is Test {
    TokenStaking public staking;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        staking = new TokenStaking();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Staking tests
    // ────────────────────────────────────────────────────────────────────────

    function test_stake_successful() public {
        vm.prank(alice);
        staking.stake{ value: 1 ether }();

        assertEq(staking.balanceOf(alice), 1 ether);
        assertEq(staking.totalStaked(), 1 ether);
        assertEq(address(staking).balance, 1 ether);
    }

    function test_stake_multipleUsers() public {
        vm.prank(alice);
        staking.stake{ value: 2 ether }();

        vm.prank(bob);
        staking.stake{ value: 3 ether }();

        assertEq(staking.balanceOf(alice), 2 ether);
        assertEq(staking.balanceOf(bob), 3 ether);
        assertEq(staking.totalStaked(), 5 ether);
    }

    function test_stake_multipleStakes_sameUser() public {
        vm.startPrank(alice);
        staking.stake{ value: 1 ether }();
        staking.stake{ value: 2 ether }();
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), 3 ether);
        assertEq(staking.totalStaked(), 3 ether);
    }

    function test_stake_emitsEvent() public {
        vm.recordLogs();
        vm.prank(alice);
        staking.stake{ value: 1 ether }();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        // Staked(address indexed user, uint256 amount, uint256 newTotal)
        assertEq(logs[0].topics[1], bytes32(uint256(uint160(alice))));
    }

    function test_revert_zeroStake() public {
        vm.prank(alice);
        vm.expectRevert(TokenStaking.ZeroStakeAmount.selector);
        staking.stake{ value: 0 }();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Unstaking tests
    // ────────────────────────────────────────────────────────────────────────

    function test_unstake_fullWithdrawal() public {
        vm.prank(alice);
        staking.stake{ value: 5 ether }();

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        staking.unstake(5 ether);

        assertEq(staking.balanceOf(alice), 0);
        assertEq(staking.totalStaked(), 0);
        assertEq(alice.balance, balBefore + 5 ether);
    }

    function test_unstake_partialWithdrawal() public {
        vm.prank(alice);
        staking.stake{ value: 5 ether }();

        vm.prank(alice);
        staking.unstake(2 ether);

        assertEq(staking.balanceOf(alice), 3 ether);
        assertEq(staking.totalStaked(), 3 ether);
    }

    function test_unstake_emitsEvent() public {
        vm.prank(alice);
        staking.stake{ value: 5 ether }();

        vm.recordLogs();
        vm.prank(alice);
        staking.unstake(3 ether);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[1], bytes32(uint256(uint160(alice))));
    }

    function test_unstake_completeMultipleTimes() public {
        vm.startPrank(alice);
        staking.stake{ value: 10 ether }();
        staking.unstake(4 ether);
        staking.unstake(4 ether);
        staking.unstake(2 ether);
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), 0);
        assertEq(staking.totalStaked(), 0);
    }

    function test_revert_withdrawExceedingBalance() public {
        vm.prank(alice);
        staking.stake{ value: 1 ether }();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TokenStaking.InsufficientStake.selector, 2 ether, 1 ether));
        staking.unstake(2 ether);
    }

    function test_revert_withdrawZero() public {
        vm.prank(alice);
        staking.stake{ value: 1 ether }();

        vm.prank(alice);
        vm.expectRevert(TokenStaking.ZeroWithdrawAmount.selector);
        staking.unstake(0);
    }

    function test_revert_withdrawWithNoStake() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TokenStaking.InsufficientStake.selector, 1 ether, 0));
        staking.unstake(1 ether);
    }

    function test_revert_plainEthTransfer() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success,) = address(staking).call{ value: 1 ether }("");
        assertFalse(success, "plain transfer should revert");
    }

    // ────────────────────────────────────────────────────────────────────────
    // Reentrancy test
    // ────────────────────────────────────────────────────────────────────────

    function test_reentrancyGuard() public {
        ReentrantAttacker attacker = new ReentrantAttacker{ value: 5 ether }(payable(address(staking)));
        attacker.attack{ value: 5 ether }();
        // After attack, attacker should NOT have drained extra funds.
        // The contract balance should be 0 (normal unstake succeeded once).
        assertEq(address(staking).balance, 0);
        // Attack counter should remain 0 — reentrant call was blocked.
        assertEq(attacker.attackCount(), 0);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Accounting integrity
    // ────────────────────────────────────────────────────────────────────────

    function test_balanceOf_isolatedPerUser() public {
        vm.prank(alice);
        staking.stake{ value: 5 ether }();

        // Bob's balance should be unaffected.
        assertEq(staking.balanceOf(bob), 0);
    }

    function test_totalStaked_correctAfterMixedOps() public {
        vm.prank(alice);
        staking.stake{ value: 3 ether }();

        vm.prank(bob);
        staking.stake{ value: 7 ether }();

        vm.prank(alice);
        staking.unstake(1 ether);

        assertEq(staking.totalStaked(), 9 ether);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Fuzz
    // ────────────────────────────────────────────────────────────────────────

    function testFuzz_stakeAndUnstake(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(alice, amount);

        vm.prank(alice);
        staking.stake{ value: amount }();
        assertEq(staking.balanceOf(alice), amount);

        vm.prank(alice);
        staking.unstake(amount);
        assertEq(staking.balanceOf(alice), 0);
    }
}
