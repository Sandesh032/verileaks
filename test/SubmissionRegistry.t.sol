// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { SubmissionRegistry } from "../contracts/SubmissionRegistry.sol";
import { ISubmissionRegistry } from "../contracts/interfaces/ISubmissionRegistry.sol";

contract SubmissionRegistryTest is Test {
    SubmissionRegistry public registry;

    // Test data
    string constant VALID_CID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
    bytes32 constant VALID_ROOT = keccak256("some merkle root");

    event SubmissionRegistered(
        bytes32 indexed submissionId,
        address indexed submitter,
        string ipfsCid,
        bytes32 indexed merkleRoot,
        uint256 timestamp
    );

    function setUp() public {
        registry = new SubmissionRegistry();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Happy-path tests
    // ────────────────────────────────────────────────────────────────────────

    function test_successfulSubmission() public {
        bytes32 id = registry.registerSubmission(VALID_CID, VALID_ROOT);
        assertTrue(id != bytes32(0), "ID must be non-zero");
        assertTrue(registry.submissionExists(id));

        ISubmissionRegistry.Submission memory s = registry.getSubmission(id);
        assertEq(s.submissionId, id);
        assertEq(s.submitter, address(this));
        assertEq(s.ipfsCid, VALID_CID);
        assertEq(s.merkleRoot, VALID_ROOT);
        assertEq(s.timestamp, block.timestamp);
        assertTrue(s.exists);
    }

    function test_submissionCount_incrementsOnEachSubmission() public {
        assertEq(registry.submissionCount(), 0);
        registry.registerSubmission(VALID_CID, VALID_ROOT);
        assertEq(registry.submissionCount(), 1);

        // Roll block number so IDs differ
        vm.roll(block.number + 1);
        registry.registerSubmission("QmAnother", VALID_ROOT);
        assertEq(registry.submissionCount(), 2);
    }

    function test_multipleSubmissionsHaveUniqueIds() public {
        bytes32 id1 = registry.registerSubmission(VALID_CID, VALID_ROOT);

        vm.roll(block.number + 1);
        bytes32 id2 = registry.registerSubmission(VALID_CID, VALID_ROOT);

        assertTrue(id1 != id2, "IDs must differ across blocks");
    }

    function test_multipleSubmissionsDifferentData() public {
        bytes32 id1 = registry.registerSubmission(VALID_CID, VALID_ROOT);

        vm.roll(block.number + 1);
        bytes32 root2 = keccak256("other root");
        bytes32 id2 = registry.registerSubmission("QmDifferent", root2);

        assertTrue(id1 != id2);
        assertTrue(registry.submissionExists(id1));
        assertTrue(registry.submissionExists(id2));
    }

    function test_emitsSubmissionRegisteredEvent() public {
        // We record logs then check indexed fields
        vm.recordLogs();
        bytes32 id = registry.registerSubmission(VALID_CID, VALID_ROOT);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);

        // Topic[0] = event sig, Topic[1] = submissionId, Topic[2] = submitter, Topic[3] = merkleRoot
        assertEq(logs[0].topics[1], id);
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(address(this)))));
        assertEq(logs[0].topics[3], VALID_ROOT);
    }

    function test_retrieval_returnsCorrectData() public {
        bytes32 id = registry.registerSubmission(VALID_CID, VALID_ROOT);
        ISubmissionRegistry.Submission memory s = registry.getSubmission(id);

        assertEq(s.ipfsCid, VALID_CID);
        assertEq(s.merkleRoot, VALID_ROOT);
    }

    function test_submissionExists_trueForRegistered() public {
        bytes32 id = registry.registerSubmission(VALID_CID, VALID_ROOT);
        assertTrue(registry.submissionExists(id));
    }

    function test_submissionExists_falseForUnregistered() public view {
        assertFalse(registry.submissionExists(keccak256("nonexistent")));
    }

    function test_differentCallers_differentIds() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        bytes32 idAlice = registry.registerSubmission(VALID_CID, VALID_ROOT);

        vm.roll(block.number + 1);
        vm.prank(bob);
        bytes32 idBob = registry.registerSubmission(VALID_CID, VALID_ROOT);

        assertTrue(idAlice != idBob);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Revert / edge case tests
    // ────────────────────────────────────────────────────────────────────────

    function test_revert_emptyIpfsCid() public {
        vm.expectRevert(SubmissionRegistry.EmptyIpfsCid.selector);
        registry.registerSubmission("", VALID_ROOT);
    }

    function test_revert_emptyMerkleRoot() public {
        vm.expectRevert(SubmissionRegistry.EmptyMerkleRoot.selector);
        registry.registerSubmission(VALID_CID, bytes32(0));
    }

    function test_revert_bothEmpty() public {
        vm.expectRevert(SubmissionRegistry.EmptyIpfsCid.selector);
        registry.registerSubmission("", bytes32(0));
    }

    function test_getSubmission_nonexistent_returnsDefault() public view {
        ISubmissionRegistry.Submission memory s = registry.getSubmission(keccak256("nope"));
        assertFalse(s.exists);
        assertEq(s.submissionId, bytes32(0));
    }

    // ────────────────────────────────────────────────────────────────────────
    // Fuzz tests
    // ────────────────────────────────────────────────────────────────────────

    function testFuzz_registerAndRetrieve(string calldata cid, bytes32 root) public {
        vm.assume(bytes(cid).length > 0);
        vm.assume(root != bytes32(0));

        bytes32 id = registry.registerSubmission(cid, root);
        ISubmissionRegistry.Submission memory s = registry.getSubmission(id);

        assertEq(s.ipfsCid, cid);
        assertEq(s.merkleRoot, root);
        assertTrue(s.exists);
    }
}
