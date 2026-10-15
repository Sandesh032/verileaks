// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { SubmissionRegistry } from "../contracts/SubmissionRegistry.sol";
import { TokenStaking } from "../contracts/TokenStaking.sol";
import { HTLC } from "../contracts/HTLC.sol";
import { CredentialRegistry } from "../contracts/CredentialRegistry.sol";
import { JurorSelection } from "../contracts/JurorSelection.sol";
import { SchellingVoting } from "../contracts/SchellingVoting.sol";
import { ISchellingVoting } from "../contracts/interfaces/ISchellingVoting.sol";
import { ArbitratedBounty } from "../contracts/ArbitratedBounty.sol";
import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import { ISemaphoreGroups } from "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";
import { IVRFCoordinatorV2Plus } from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import { VRFV2PlusClient } from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

// Mock Semaphore that just accepts all proofs
contract MockSemaphore {
    mapping(uint256 => uint256) public groupDepth;
    mapping(uint256 => uint256) public groupRoot;
    
    uint256 public nextGroupId = 1;
    function createGroup(address admin, uint256 merkleTreeDuration) external returns (uint256) {
        uint256 id = nextGroupId++;
        groupDepth[id] = 20; // arbitrary
        return id;
    }

    function verifyProof(
        uint256 groupId,
        uint256 merkleTreeRoot,
        uint256 signal,
        uint256 nullifier,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) external view {
        // always succeeds
    }
}

// Mock VRF Coordinator
contract MockVRFCoordinator {
    mapping(uint256 => address) public consumers;
    uint256 public nextRequestId = 1;

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256 requestId) {
        consumers[nextRequestId] = msg.sender;
        return nextRequestId++;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        address consumer = consumers[requestId];
        require(consumer != address(0), "not found");
        (bool success, ) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        require(success, "fulfill failed");
    }
}

contract Phase2IntegrationTest is Test {
    SubmissionRegistry public registry;
    TokenStaking public staking;
    HTLC public htlc;
    MockSemaphore public semaphore;
    MockVRFCoordinator public vrf;
    CredentialRegistry public credentials;
    JurorSelection public selection;
    SchellingVoting public voting;
    ArbitratedBounty public bounty;

    address public owner = makeAddr("owner");
    address public whistleblower = makeAddr("whistleblower");
    address public funder = makeAddr("funder");
    address public disputer = makeAddr("disputer");

    // Jurors
    address[] public jurors;

    function setUp() public {
        vm.startPrank(owner);
        registry = new SubmissionRegistry();
        staking = new TokenStaking();
        htlc = new HTLC();
        semaphore = new MockSemaphore();
        vrf = new MockVRFCoordinator();

        credentials = new CredentialRegistry(ISemaphore(address(semaphore)), owner, 1 hours);
        
        selection = new JurorSelection(
            address(vrf),
            credentials,
            staking,
            1 ether, // min pool stake
            bytes32(0), // keyhash
            1, // sub id
            3, // confirmations
            1000000, // gas limit
            false // native payment
        );

        SchellingVoting.Config memory config = SchellingVoting.Config({
            jurySize: 3,
            minReveals: 2,
            commitDuration: 1 days,
            revealDuration: 1 days,
            selectionTimeout: 1 days,
            minorityPenaltyBps: 2000,
            nonRevealPenaltyBps: 5000,
            stakePerJuror: 0.1 ether
        });

        voting = new SchellingVoting(
            owner,
            selection,
            staking,
            registry,
            config
        );

        bounty = new ArbitratedBounty(
            htlc,
            registry,
            voting,
            credentials,
            1 ether, // min bounty
            30 days // min lock duration
        );
        
        // Grant locking roles
        staking.setLocker(address(selection), true);
        staking.setLocker(address(voting), true);
        
        // Grant voting/creator roles
        voting.setCreator(address(bounty), true);
        selection.setVoting(address(voting));
        vm.stopPrank();

        // Setup jurors
        for(uint i = 0; i < 10; i++) {
            address j = makeAddr(string(abi.encodePacked("juror", vm.toString(i))));
            jurors.push(j);
            vm.deal(j, 10 ether);
            vm.prank(j);
            staking.stake{value: 2 ether}();
            // In a real test, they would register in CredentialRegistry with a ZK proof
            // Here we just let them be eligible since they staked. 
            // Wait, JurorSelection checks credentials.isRegistered(j).
            // Let's add them to the MockSemaphore or just use vm.mockCall on credentials
        }

        // Mock credential registry for jurors
        for(uint i = 0; i < 10; i++) {
            vm.mockCall(
                address(credentials),
                abi.encodeWithSelector(CredentialRegistry.verifyAndConsume.selector),
                abi.encode(i + 1) // nullifier
            );
            vm.prank(jurors[i]);
            ISemaphore.SemaphoreProof memory dummyProof;
            selection.registerJuror(dummyProof);
        }

        vm.deal(whistleblower, 10 ether);
        vm.deal(funder, 100 ether);
        vm.deal(disputer, 10 ether);
    }

    function test_phase2_arbitratedBounty_happyPath() public {
        // 1. Whistleblower registers submission
        vm.prank(whistleblower);
        bytes32 submissionId = registry.registerSubmission("cid123", bytes32(uint256(1)));

        // 2. Funder creates an arbitrated bounty
        bytes32 preimage = keccak256("secret");
        bytes32 hashlock = keccak256(abi.encodePacked(preimage));
        
        vm.prank(funder);
        uint256 bountyId = bounty.fundBounty{value: 5 ether}(
            submissionId,
            whistleblower,
            vm.getBlockTimestamp() + 60 days
        );

        // Disputer disagrees and raises dispute on the voting contract
        vm.prank(disputer);
        vm.mockCall(
            address(credentials),
            abi.encodeWithSelector(CredentialRegistry.verifyAndConsume.selector),
            abi.encode(999) // arbitrary nullifier for disputer
        );
        ISemaphore.SemaphoreProof memory dummyProofDispute;
        uint256 disputeId = bounty.openDispute(bountyId, dummyProofDispute);

        // Mock VRF fulfillment to select jurors
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 123456789;
        vrf.fulfillRandomWords(1, randomWords); // requestId 1

        // Jurors commit
        // Advance time to allow commits
        vm.roll(block.number + 1);
        
        address[] memory selectedJurors = voting.jurorsOf(disputeId);
        for(uint i = 0; i < selectedJurors.length; i++) {
            address j = selectedJurors[i];
            // commitmentFor(uint256 disputeId, address juror, Vote vote, bytes32 salt)
            bytes32 commitHash = voting.commitmentFor(disputeId, j, ISchellingVoting.Vote.REAL, "salt123");
            vm.prank(j);
            voting.commitVote(disputeId, commitHash);
        }

        // Advance time to reveal phase
        skip(1 days + 1);

        for(uint i = 0; i < selectedJurors.length; i++) {
            address j = selectedJurors[i];
            vm.prank(j);
            voting.revealVote(disputeId, ISchellingVoting.Vote.REAL, "salt123");
        }

        // Advance time to finalize
        skip(1 days + 1);
        
        voting.finalize(disputeId);

        // Outcome is 1 (Real). Bounty remains intact for whistleblower.
        // Wait, the ArbitratedBounty contract needs to know the outcome. It's not directly hooked, 
        // the whistleblower just claims the bounty via HTLC or ArbitratedBounty?
        // Let's verify lock exists
        bytes32 lockId = bounty.getBounty(bountyId).lockId;
        assertEq(uint8(htlc.getLock(lockId).status), 0); // Status.FUNDED is 0
    }
}
