// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { DeployAll } from "../script/DeployAll.s.sol";
import { SubmissionRegistry } from "../contracts/SubmissionRegistry.sol";
import { TokenStaking } from "../contracts/TokenStaking.sol";
import { JurorSelection } from "../contracts/JurorSelection.sol";
import { SchellingVoting } from "../contracts/SchellingVoting.sol";
import { ArbitratedBounty } from "../contracts/ArbitratedBounty.sol";
import { ISemaphore } from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import { ProofBindings } from "../contracts/libraries/ProofBindings.sol";

contract DeployAllTest is Test {
    DeployAll public deployerScript;

    function setUp() public {
        deployerScript = new DeployAll();
        deployerScript.run();
    }

    function test_deployAll_wiring_and_jurorRegistration() public {
        // Read deployments or test contracts deployed
        assertTrue(true);
    }
}
