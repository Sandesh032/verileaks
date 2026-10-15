// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { CredentialRegistry } from "../contracts/CredentialRegistry.sol";
import { JurorSelection } from "../contracts/JurorSelection.sol";
import { SchellingVoting } from "../contracts/SchellingVoting.sol";
import { ArbitratedBounty } from "../contracts/ArbitratedBounty.sol";
import { IHTLC } from "../contracts/interfaces/IHTLC.sol";
import { ISubmissionRegistry } from "../contracts/interfaces/ISubmissionRegistry.sol";
import { ITokenStakingLocks } from "../contracts/interfaces/ITokenStakingLocks.sol";
import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title Phase2Deploy
/// @notice Deploys Phase 2 VeriLeaks contracts to Arbitrum Sepolia.
contract Phase2Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Required deployed addresses (Phase 1 + dependencies)
        address htlcAddr = vm.envAddress("HTLC_ADDRESS");
        address registryAddr = vm.envAddress("REGISTRY_ADDRESS");
        address stakingAddr = vm.envAddress("STAKING_ADDRESS");
        address semaphoreAddr = vm.envAddress("SEMAPHORE_ADDRESS"); // 0x3889927F0B5Eb1a02C6E2C20b38a1Bb9E68DCE46 (Arbitrum Sepolia v4)
        address vrfCoordinator = vm.envAddress("VRF_COORDINATOR"); // 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61
        
        bytes32 keyHash = vm.envBytes32("VRF_KEY_HASH"); // 0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c9ed2cb5a8553610deefb0c
        uint256 subId = vm.envUint("VRF_SUB_ID");

        vm.startBroadcast(deployerKey);

        CredentialRegistry creds = new CredentialRegistry(ISemaphore(semaphoreAddr), deployer, 3600);
        console2.log("CredentialRegistry:", address(creds));

        JurorSelection selection = new JurorSelection(
            vrfCoordinator,
            creds,
            ITokenStakingLocks(stakingAddr),
            100 ether, // minPoolStake
            keyHash,
            subId,
            3, // requestConfirmations
            2_000_000, // callbackGasLimit
            false // nativePayment (LINK)
        );
        console2.log("JurorSelection:", address(selection));

        SchellingVoting.Config memory votingConfig = SchellingVoting.Config({
            jurySize: 3,
            minReveals: 3,
            commitDuration: 24 hours,
            revealDuration: 24 hours,
            selectionTimeout: 1 hours,
            minorityPenaltyBps: 5000,
            nonRevealPenaltyBps: 10000,
            stakePerJuror: 10 ether
        });

        SchellingVoting voting = new SchellingVoting(
            deployer,
            selection,
            ITokenStakingLocks(stakingAddr),
            ISubmissionRegistry(registryAddr),
            votingConfig
        );        console2.log("SchellingVoting:", address(voting));

        ArbitratedBounty bounty = new ArbitratedBounty(
            IHTLC(htlcAddr),
            ISubmissionRegistry(registryAddr),
            voting,
            creds,
            0.1 ether, // minBounty
            3 days // minLockDuration
        );
        console2.log("ArbitratedBounty:", address(bounty));

        // Wiring
        selection.setVoting(address(voting));
        voting.setCreator(address(bounty), true);

        vm.stopBroadcast();
        console2.log("=== Phase 2 Deployment Complete ===");
    }
}
