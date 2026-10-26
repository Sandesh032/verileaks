/**
 * e2e.test.js — VeriLeaks Phase 3 End-to-End Simulation & Multi-Node Watchtower Integration Test
 */

import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { generateMerkleTree } from "./merkle/MerkleTree.js";
import { MockStorageProvider } from "./storage/MockStorageProvider.js";
import { CONTRACT_ABIS } from "./contracts/abis.js";
import { MultiNodeCoordinator } from "./watchtower/MultiNodeCoordinator.js";
import {
  jurorRegistrationScope,
  jurorRegistrationMessage,
  disputeOpenScope,
  disputeOpenMessage
} from "./simulation/ProofBindings.js";

const ANVIL_PORT = 8548;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const FORGE_BIN = path.resolve(process.env.HOME || "", ".foundry/bin/forge");
const ANVIL_BIN = path.resolve(process.env.HOME || "", ".foundry/bin/anvil");

const TEST_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0: deployer
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1: whistleblower
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2: funder
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3: disputer
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4: watchtower automated executor
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // 5: juror 1
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // 6: juror 2
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // 7: juror 3
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"  // 8: juror 4
];

describe("VeriLeaks Phase 3 End-to-End Simulation", () => {
  let anvilProcess;
  let provider;
  let deployer, whistleblower, funder, disputer, watchtowerSigner;
  let jurors = [];
  let deployments;
  let contracts = {};
  let coordinator;
  let clusterDataDir = ".data/e2e-watchtowers";
  let currentSubmissionId;

  beforeAll(async () => {
    // 1. Launch isolated Anvil instance
    anvilProcess = spawn(ANVIL_BIN, ["--port", String(ANVIL_PORT), "--chain-id", "31337", "--silent"], {
      stdio: "ignore"
    });

    // Wait for RPC to respond
    provider = new ethers.JsonRpcProvider(RPC_URL);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        await provider.getBlockNumber();
        ready = true;
        break;
      } catch (_) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }
    if (!ready) throw new Error("Anvil failed to become ready on port " + ANVIL_PORT);

    // 2. Setup signers
    deployer = new ethers.Wallet(TEST_KEYS[0], provider);
    whistleblower = new ethers.Wallet(TEST_KEYS[1], provider);
    funder = new ethers.Wallet(TEST_KEYS[2], provider);
    disputer = new ethers.Wallet(TEST_KEYS[3], provider);
    watchtowerSigner = new ethers.Wallet(TEST_KEYS[4], provider);
    jurors = [
      new ethers.Wallet(TEST_KEYS[5], provider),
      new ethers.Wallet(TEST_KEYS[6], provider),
      new ethers.Wallet(TEST_KEYS[7], provider),
      new ethers.Wallet(TEST_KEYS[8], provider)
    ];

    // 3. Deploy contracts via forge script
    execSync(
      `${FORGE_BIN} script script/DeployAll.s.sol:DeployAll --rpc-url ${RPC_URL} --broadcast --tc DeployAll`,
      { stdio: "pipe" }
    );

    deployments = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "deployments.json"), "utf8"));

    // Connect contract instances
    contracts.registry = new ethers.Contract(deployments.registry, CONTRACT_ABIS.SubmissionRegistry, deployer);
    contracts.staking = new ethers.Contract(deployments.staking, CONTRACT_ABIS.TokenStaking, deployer);
    contracts.htlc = new ethers.Contract(deployments.htlc, CONTRACT_ABIS.HTLC, deployer);
    contracts.credentials = new ethers.Contract(deployments.credentials, CONTRACT_ABIS.CredentialRegistry, deployer);
    contracts.jurorSelection = new ethers.Contract(deployments.jurorSelection, CONTRACT_ABIS.JurorSelection, deployer);
    contracts.voting = new ethers.Contract(deployments.voting, CONTRACT_ABIS.SchellingVoting, deployer);
    contracts.arbitratedBounty = new ethers.Contract(deployments.arbitratedBounty, CONTRACT_ABIS.ArbitratedBounty, deployer);
    contracts.vrf = new ethers.Contract(
      deployments.vrfCoordinator,
      ["function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external"],
      deployer
    );

    // 4. Initialize MultiNodeCoordinator (3 Nodes, Node 1 has signer)
    if (fs.existsSync(clusterDataDir)) {
      fs.rmSync(clusterDataDir, { recursive: true, force: true });
    }

    coordinator = new MultiNodeCoordinator({
      nodeCount: 3,
      provider,
      signers: [watchtowerSigner, null, null],
      contractAddresses: deployments,
      baseDataDir: clusterDataDir
    });

    await coordinator.initializeNodes();
    await coordinator.startAll();
  }, 45000);

  afterAll(async () => {
    if (coordinator) {
      await coordinator.stopAll();
    }
    if (anvilProcess) {
      anvilProcess.kill("SIGKILL");
    }
    await new Promise((res) => setTimeout(res, 300));
    if (fs.existsSync(clusterDataDir)) {
      try {
        fs.rmSync(clusterDataDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  test("Step 1: Synthetic Evidence Submission & Merkle Anchoring", async () => {
    // Whistleblower generates synthetic evidence
    const syntheticContent = Buffer.from(
      "CONFIDENTIAL_WHISTLEBLOWER_LEAK_SYNTHETIC_E2E_EVIDENCE_2026_METRICS_AND_INTERNAL_MEMOS"
    );

    // Compute Merkle tree
    const { root, chunks } = generateMerkleTree(syntheticContent);
    expect(root).toBeDefined();
    expect(root.length).toBe(64); // 32-byte hex string

    // Upload to storage provider
    const storage = new MockStorageProvider();
    const cid = await storage.upload(syntheticContent, "synthetic_evidence.bin");
    expect(cid).toMatch(/^Qm[0-9a-fA-F]+/);

    // Register on-chain
    const rootHex = "0x" + root;
    const tx = await contracts.registry.connect(whistleblower).registerSubmission(cid, rootHex);
    const receipt = await tx.wait();
    expect(receipt.status).toBe(1);

    const parsedEvent = receipt.logs
      .map((log) => {
        try {
          return contracts.registry.interface.parseLog(log);
        } catch (_) {
          return null;
        }
      })
      .find((p) => p && p.name === "SubmissionRegistered");

    expect(parsedEvent).toBeDefined();
    currentSubmissionId = parsedEvent.args.submissionId;
    expect(currentSubmissionId).toBeDefined();

    const sub = await contracts.registry.getSubmission(currentSubmissionId);
    expect(sub.ipfsCid).toBe(cid);
    expect(sub.merkleRoot).toBe(rootHex);
    expect(sub.submitter).toBe(whistleblower.address);
  });

  test("Step 2: Juror Staking & Semaphore Credential Registration", async () => {
    const chainId = 31337n;
    const minStake = ethers.parseEther("2.0");

    for (let i = 0; i < jurors.length; i++) {
      const juror = jurors[i];
      let nonce = await provider.getTransactionCount(juror.address, "latest");

      // 1. Stake 2 ETH
      const stakeTx = await contracts.staking.connect(juror).stake({ value: minStake, nonce: nonce++ });
      await stakeTx.wait();

      const balance = await contracts.staking.balanceOf(juror.address);
      expect(balance).toBe(minStake);

      // 2. Generate bound Semaphore proof for JurorSelection
      const scope = jurorRegistrationScope(chainId, deployments.jurorSelection);
      const message = jurorRegistrationMessage(chainId, deployments.jurorSelection, juror.address);

      const proof = {
        merkleTreeDepth: 20n,
        merkleTreeRoot: 1n,
        nullifier: BigInt(2000 + i),
        message: message,
        scope: scope,
        points: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]
      };

      const regTx = await contracts.jurorSelection.connect(juror).registerJuror(proof, { nonce: nonce++ });
      await regTx.wait();
    }

    const poolSize = await contracts.jurorSelection.poolSize();
    expect(poolSize).toBe(BigInt(jurors.length));
  });

  test("Step 3: Bounty Funding & Dispute Initiation", async () => {
    const chainId = 31337n;
    const bountyAmount = ethers.parseEther("1.0");

    // Funder funds bounty #1
    const block = await provider.getBlock("latest");
    const timelock = block.timestamp + 3600 * 24 * 35; // 35 days in future

    const fundTx = await contracts.arbitratedBounty.connect(funder).fundBounty(
      currentSubmissionId,
      whistleblower.address,
      timelock,
      { value: bountyAmount }
    );
    const fundReceipt = await fundTx.wait();
    expect(fundReceipt.status).toBe(1);

    const bounty = await contracts.arbitratedBounty.getBounty(1);
    expect(Number(bounty.status)).toBe(1); // Status.FUNDED
    expect(bounty.amount).toBe(bountyAmount);
    expect(bounty.whistleblower).toBe(whistleblower.address);

    // Disputer raises dispute on bounty #1
    const disputeScopeVal = disputeOpenScope(chainId, deployments.arbitratedBounty, 1n, 0n);
    const disputeMsgVal = disputeOpenMessage(chainId, deployments.arbitratedBounty, 1n, 0n);

    const disputeProof = {
      merkleTreeDepth: 20n,
      merkleTreeRoot: 1n,
      nullifier: 8888n,
      message: disputeMsgVal,
      scope: disputeScopeVal,
      points: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]
    };

    const disputeTx = await contracts.arbitratedBounty.connect(disputer).openDispute(1, disputeProof);
    const disputeReceipt = await disputeTx.wait();
    expect(disputeReceipt.status).toBe(1);

    const disputedBounty = await contracts.arbitratedBounty.getBounty(1);
    expect(Number(disputedBounty.status)).toBe(2); // Status.DISPUTED
    expect(disputedBounty.activeDispute).toBe(1n);
  });

  test("Step 4: VRF Randomness Fulfillment & Commit-Reveal Voting", async () => {
    // Fulfill randomness via MockVRFCoordinator
    const fulfillTx = await contracts.vrf.connect(deployer).fulfillRandomWords(1, [888888888n]);
    await fulfillTx.wait();

    // Dispute is now COMMITTING with 3 selected jurors
    const selectedJurors = await contracts.voting.jurorsOf(1);
    expect(selectedJurors.length).toBe(3);

    // Jurors submit commitments: vote REAL (1) with secret salt
    const salt = ethers.keccak256(ethers.toUtf8Bytes("juror_secret_salt_999"));
    for (const jurorAddr of selectedJurors) {
      const jurorSigner = jurors.find((j) => j.address.toLowerCase() === jurorAddr.toLowerCase());
      expect(jurorSigner).toBeDefined();

      const commitHash = await contracts.voting.commitmentFor(1, jurorAddr, 1, salt);
      const commitTx = await contracts.voting.connect(jurorSigner).commitVote(1, commitHash);
      await commitTx.wait();
    }

    // Advance time on Anvil past commit deadline (1 day + 1 second)
    await provider.send("evm_increaseTime", [86401]);
    await provider.send("evm_mine", []);

    // Jurors reveal their votes
    for (const jurorAddr of selectedJurors) {
      const jurorSigner = jurors.find((j) => j.address.toLowerCase() === jurorAddr.toLowerCase());
      const revealTx = await contracts.voting.connect(jurorSigner).revealVote(1, 1, salt);
      await revealTx.wait();
    }

    const result = await contracts.voting.resultOf(1);
    // Status is 2 (COMMITTING/REVEALING until finalized)
    expect(result.status).toBe(2n);
  });

  test("Step 5: Watchtower Detection, Automated Finalize and Settle Execution", async () => {
    // Run multi-node sync across all 3 watchtower nodes:
    // Poll sync until bounty reaches status RELEASED (3)
    let settled = false;
    for (let i = 0; i < 20; i++) {
      await coordinator.syncAllOnce();
      const b = await contracts.arbitratedBounty.getBounty(1);
      if (Number(b.status) === 3) {
        settled = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    expect(settled).toBe(true);

    // Watchtowers should have processed blocks up to latest
    for (const node of coordinator.nodes) {
      expect(node.store.getCheckpoint()).toBeGreaterThan(0);
      expect(node.store.state.disputes["1"]).toBeDefined();
      expect(node.store.state.bounties["1"]).toBeDefined();
    }

    // Verify dispute outcome and bounty status
    const disputeResult = await contracts.voting.resultOf(1);
    expect(disputeResult.status).toBe(3n); // FINALIZED
    expect(disputeResult.outcome).toBe(1n); // REAL

    // Whistleblower has pending payout
    const pending = await contracts.arbitratedBounty.pendingPayout(whistleblower.address);
    expect(pending).toBe(ethers.parseEther("1.0"));

    // Whistleblower withdraws payout
    const rawBalBefore = await provider.send("eth_getBalance", [whistleblower.address, "latest"]);
    const balBefore = BigInt(rawBalBefore);

    const withdrawTx = await contracts.arbitratedBounty.connect(whistleblower).withdraw();
    const withdrawRc = await withdrawTx.wait();

    const rawBalAfter = await provider.send("eth_getBalance", [whistleblower.address, "latest"]);
    const balAfter = BigInt(rawBalAfter);

    const pendingAfter = await contracts.arbitratedBounty.pendingPayout(whistleblower.address);
    expect(pendingAfter).toBe(0n);
    expect(balAfter - balBefore + withdrawRc.fee).toBe(ethers.parseEther("1.0"));
  });

  test("Step 6: Fault Injection — Watchtower Restarts & Missed Event Recovery", async () => {
    const node1 = coordinator.nodes[0];
    const initialCheckpoint = node1.store.getCheckpoint();

    // Simulate node stop
    await node1.worker.stop();
    await new Promise((r) => setTimeout(r, 100));

    // Mine blocks on chain while node 1 is offline
    await provider.send("anvil_mine", ["0x2", "0x0"]);

    const newBlock = await provider.getBlockNumber();
    expect(newBlock).toBeGreaterThan(initialCheckpoint);

    // Restart node 1 and verify checkpoint recovery
    await node1.worker.start();
    await new Promise((r) => setTimeout(r, 100));
    await node1.worker.syncOnce();

    expect(node1.store.getCheckpoint()).toBe(newBlock);
  });

  test("Step 7: Fault Injection — Idempotent Re-execution & Replay Protection", async () => {
    const node1 = coordinator.nodes[0];

    // Attempt to settle already-released bounty #1
    const bounty1 = node1.store.state.bounties["1"];
    expect(Number(bounty1.status)).toBe(3); // Status.RELEASED

    // Direct contract call reverts safely
    await expect(
      contracts.arbitratedBounty.connect(watchtowerSigner).settle(1)
    ).rejects.toThrow();
  });

  test("Step 8: Watchtower HTTP Health, Status, and Alert Endpoints", async () => {
    for (let i = 0; i < coordinator.nodes.length; i++) {
      const port = 9101 + i;
      const res = await fetch(`http://127.0.0.1:${port}/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.nodeId).toBe(`watchtower-node-${i + 1}`);
      expect(data.checkpoint).toBeGreaterThan(0);
      expect(data.disputes).toBeDefined();
    }
  });
});
