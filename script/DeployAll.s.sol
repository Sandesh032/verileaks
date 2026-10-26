// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { SubmissionRegistry } from "../contracts/SubmissionRegistry.sol";
import { TokenStaking } from "../contracts/TokenStaking.sol";
import { HTLC } from "../contracts/HTLC.sol";
import { CredentialRegistry } from "../contracts/CredentialRegistry.sol";
import { JurorSelection } from "../contracts/JurorSelection.sol";
import { SchellingVoting } from "../contracts/SchellingVoting.sol";
import { ArbitratedBounty } from "../contracts/ArbitratedBounty.sol";
import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import { ITokenStakingLocks } from "../contracts/interfaces/ITokenStakingLocks.sol";
import { ISubmissionRegistry } from "../contracts/interfaces/ISubmissionRegistry.sol";
import { IHTLC } from "../contracts/interfaces/IHTLC.sol";
import { VRFV2PlusClient } from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

// Mock Semaphore for local Anvil development
contract MockSemaphoreDev {
    mapping(uint256 => uint256) public groupDepth;
    uint256 public nextGroupId = 1;

    function createGroup(address, uint256) external returns (uint256) {
        uint256 id = nextGroupId++;
        groupDepth[id] = 20;
        return id;
    }

    function addMember(uint256, uint256) external {}
    function addMembers(uint256, uint256[] calldata) external {}

    function verifyProof(
        uint256,
        ISemaphore.SemaphoreProof calldata
    ) external pure returns (bool) {
        return true;
    }
}

// Mock VRF Coordinator for local development
contract MockVRFCoordinatorDev {
    mapping(uint256 => address) public consumers;
    uint256 public nextRequestId = 1;

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata
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

/// @title DeployAll
/// @notice Deploys full VeriLeaks protocol (Phase 1 + Phase 2 + Phase 3 wiring)
contract DeployAll is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        address semaphoreAddr = vm.envOr("SEMAPHORE_ADDRESS", address(0));
        address vrfCoordinator = vm.envOr("VRF_COORDINATOR", address(0));
        bytes32 keyHash = vm.envOr("VRF_KEY_HASH", bytes32(0));
        uint256 subId = vm.envOr("VRF_SUB_ID", uint256(1));

        vm.startBroadcast(deployerKey);

        // 1. Phase 1 Foundations
        SubmissionRegistry registry = new SubmissionRegistry();
        console2.log("SubmissionRegistry:", address(registry));

        TokenStaking staking = new TokenStaking();
        console2.log("TokenStaking:", address(staking));

        HTLC htlc = new HTLC();
        console2.log("HTLC:", address(htlc));

        // 2. Semaphore identity setup (Mock if local or 0)
        if (semaphoreAddr == address(0)) {
            MockSemaphoreDev mockSem = new MockSemaphoreDev();
            semaphoreAddr = address(mockSem);
            console2.log("Deployed MockSemaphoreDev:", semaphoreAddr);
        }

        CredentialRegistry credentials = new CredentialRegistry(ISemaphore(semaphoreAddr), deployer, 3600);
        console2.log("CredentialRegistry:", address(credentials));

        // 3. Chainlink VRF juror selection
        if (vrfCoordinator == address(0)) {
            MockVRFCoordinatorDev mockVrf = new MockVRFCoordinatorDev();
            vrfCoordinator = address(mockVrf);
            console2.log("Deployed MockVRFCoordinatorDev:", vrfCoordinator);
        }

        JurorSelection selection = new JurorSelection(
            vrfCoordinator,
            credentials,
            ITokenStakingLocks(address(staking)),
            1 ether, // minPoolStake
            keyHash,
            subId,
            3, // requestConfirmations
            2_000_000, // callbackGasLimit
            false // nativePayment
        );
        console2.log("JurorSelection:", address(selection));

        // 4. Schelling commit-reveal consensus
        SchellingVoting.Config memory votingConfig = SchellingVoting.Config({
            jurySize: 3,
            minReveals: 2,
            commitDuration: 1 days,
            revealDuration: 1 days,
            selectionTimeout: 1 hours,
            minorityPenaltyBps: 2000,
            nonRevealPenaltyBps: 5000,
            stakePerJuror: 0.1 ether
        });

        SchellingVoting voting = new SchellingVoting(
            deployer,
            selection,
            ITokenStakingLocks(address(staking)),
            ISubmissionRegistry(address(registry)),
            votingConfig
        );
        console2.log("SchellingVoting:", address(voting));

        // 5. Arbitrated Bounty
        ArbitratedBounty bounty = new ArbitratedBounty(
            IHTLC(address(htlc)),
            ISubmissionRegistry(address(registry)),
            voting,
            credentials,
            0.1 ether, // minBounty
            3 days // minLockDuration
        );
        console2.log("ArbitratedBounty:", address(bounty));

        // 6. Complete Protocol Wiring
        staking.setLocker(address(selection), true);
        staking.setLocker(address(voting), true);
        selection.setVoting(address(voting));
        voting.setCreator(address(bounty), true);
        credentials.setConsumer(address(selection), true);
        credentials.setConsumer(address(bounty), true);

        vm.stopBroadcast();

        // 7. Write output JSON manifest
        string memory json = "{\n";
        json = string.concat(json, "  \"registry\": \"", vm.toString(address(registry)), "\",\n");
        json = string.concat(json, "  \"staking\": \"", vm.toString(address(staking)), "\",\n");
        json = string.concat(json, "  \"htlc\": \"", vm.toString(address(htlc)), "\",\n");
        json = string.concat(json, "  \"credentials\": \"", vm.toString(address(credentials)), "\",\n");
        json = string.concat(json, "  \"jurorSelection\": \"", vm.toString(address(selection)), "\",\n");
        json = string.concat(json, "  \"voting\": \"", vm.toString(address(voting)), "\",\n");
        json = string.concat(json, "  \"arbitratedBounty\": \"", vm.toString(address(bounty)), "\",\n");
        json = string.concat(json, "  \"vrfCoordinator\": \"", vm.toString(vrfCoordinator), "\",\n");
        json = string.concat(json, "  \"chainId\": ", vm.toString(block.chainid), "\n");
        json = string.concat(json, "}");

        vm.writeFile("deployments.json", json);
        console2.log("Deployments written to deployments.json");
    }
}
