/**
 * cli.js — Command-line launcher for single watchtower node or multi-node cluster.
 *
 * Usage:
 *   node src/watchtower/cli.js                # Starts single node
 *   node src/watchtower/cli.js --cluster      # Starts 3 independent nodes
 */

import { ethers } from "ethers";
import { WatchtowerStore } from "./WatchtowerStore.js";
import { WatchtowerWorker } from "./WatchtowerWorker.js";
import { MultiNodeCoordinator } from "./MultiNodeCoordinator.js";

import fs from "fs";
import path from "path";

// Load .env if present
try {
  const { config } = await import("dotenv");
  config();
} catch (_) {}

let deployments = {};
try {
  const depPath = path.resolve(process.cwd(), "deployments.json");
  if (fs.existsSync(depPath)) {
    deployments = JSON.parse(fs.readFileSync(depPath, "utf8"));
  }
} catch (_) {}

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(rpcUrl);

const contractAddresses = {
  registry: process.env.SUBMISSION_REGISTRY_ADDRESS || process.env.REGISTRY_ADDRESS || deployments.registry,
  staking: process.env.TOKEN_STAKING_ADDRESS || process.env.STAKING_ADDRESS || deployments.staking,
  htlc: process.env.HTLC_ADDRESS || deployments.htlc,
  voting: process.env.VOTING_ADDRESS || deployments.voting,
  arbitratedBounty: process.env.ARBITRATED_BOUNTY_ADDRESS || deployments.arbitratedBounty,
  jurorSelection: process.env.JUROR_SELECTION_ADDRESS || deployments.jurorSelection
};

const args = process.argv.slice(2);
const isCluster = args.includes("--cluster");

if (isCluster) {
  console.log("=== Launching VeriLeaks Multi-Node Watchtower Cluster (3 Nodes) ===");
  const defaultWatchtowerKey =
    process.env.PRIVATE_KEY ||
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";
  const activeSigner = new ethers.Wallet(defaultWatchtowerKey, provider);
  console.log(`Watchtower Node 1 configured as Active Automated Executor (${activeSigner.address})`);

  const coordinator = new MultiNodeCoordinator({
    nodeCount: 3,
    provider,
    signers: [activeSigner, null, null],
    contractAddresses,
    baseDataDir: ".data/watchtowers"
  });

  await coordinator.initializeNodes();
  await coordinator.startAll();

  console.log("Cluster running! Ports: 9101, 9102, 9103.");
  console.log("Press Ctrl+C to terminate.");

  process.on("SIGINT", async () => {
    console.log("\nShutting down cluster...");
    await coordinator.stopAll();
    process.exit(0);
  });
} else {
  console.log("=== Launching VeriLeaks Watchtower Node 1 ===");
  const store = new WatchtowerStore(".data/watchtowers/watchtower-node-1.json");

  let signer = null;
  if (process.env.PRIVATE_KEY) {
    signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`Node configured with active transaction signer: ${signer.address}`);
  } else {
    console.log("Node running in read-only monitoring mode (no PRIVATE_KEY provided).");
  }

  const worker = new WatchtowerWorker({
    nodeId: "watchtower-1",
    provider,
    signer,
    contractAddresses,
    store,
    options: {
      httpPort: Number(process.env.WATCHTOWER_PORT || 9100)
    }
  });

  await worker.start();
  console.log(`Watchtower listening on http://127.0.0.1:${process.env.WATCHTOWER_PORT || 9100}`);

  process.on("SIGINT", async () => {
    console.log("\nShutting down watchtower...");
    await worker.stop();
    process.exit(0);
  });
}
