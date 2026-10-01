// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { SubmissionRegistry } from "../contracts/SubmissionRegistry.sol";
import { TokenStaking } from "../contracts/TokenStaking.sol";
import { HTLC } from "../contracts/HTLC.sol";

/// @title Deploy
/// @notice Deploys all Phase 1 VeriLeaks contracts.
///
/// Usage:
///   Local (Anvil):
///     anvil &
///     forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///
///   Sepolia (requires PRIVATE_KEY and RPC_URL in .env):
///     source .env
///     forge script script/Deploy.s.sol \
///       --rpc-url $RPC_URL \
///       --private-key $PRIVATE_KEY \
///       --broadcast \
///       --verify \
///       --etherscan-api-key $ETHERSCAN_API_KEY
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("Deploying Phase 1 contracts...");
        console2.log("Deployer:", deployer);
        console2.log("Balance :", deployer.balance);

        vm.startBroadcast(deployerKey);

        SubmissionRegistry registry = new SubmissionRegistry();
        console2.log("SubmissionRegistry deployed at:", address(registry));

        TokenStaking staking = new TokenStaking();
        console2.log("TokenStaking deployed at:", address(staking));

        HTLC htlc = new HTLC();
        console2.log("HTLC deployed at:", address(htlc));

        vm.stopBroadcast();

        console2.log("=== Deployment complete ===");
        console2.log("SubmissionRegistry:", address(registry));
        console2.log("TokenStaking      :", address(staking));
        console2.log("HTLC              :", address(htlc));
    }
}
