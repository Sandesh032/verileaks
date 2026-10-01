/**
 * workflow.js — Demonstrates the full Phase 1 workflow from the command line.
 *
 * Usage:
 *   node src/workflow.js
 *   node src/workflow.js --real-ipfs   (requires PINATA_* vars in .env)
 *
 * This script is a development aid, not a production tool.
 */

import { readFileSync } from "fs";
import { generateMerkleTree, generateMerkleProof, verifyMerkleProof } from "./merkle/MerkleTree.js";
import { MockStorageProvider } from "./storage/MockStorageProvider.js";
import crypto from "crypto";

// Load .env if present (best-effort; no crash if missing in dev)
try {
  const { config } = await import("dotenv");
  config();
} catch (_) {
  // dotenv not critical for mock mode
}

const args = process.argv.slice(2);
const useRealIPFS = args.includes("--real-ipfs");

// ────────────────────────────────────────────────────────────────────────────
// Storage provider selection
// ────────────────────────────────────────────────────────────────────────────

let storageProvider;
if (useRealIPFS) {
  const { createPinataProviderFromEnv } = await import("./storage/PinataStorageProvider.js");
  storageProvider = createPinataProviderFromEnv();
  console.log("Using REAL Pinata IPFS provider");
} else {
  storageProvider = new MockStorageProvider();
  console.log("Using MockStorageProvider (local development mode)");
}

// ────────────────────────────────────────────────────────────────────────────
// Evidence
// ────────────────────────────────────────────────────────────────────────────

const evidence = Buffer.from(
  "VeriLeaks Phase 1 Demo Evidence\n" +
    "================================\n" +
    "This file represents evidence submitted by a whistleblower.\n" +
    "It contains sensitive information about corporate misconduct.\n" +
    "CID and Merkle root will be anchored on-chain.\n"
);

console.log("\n=== STEP 1: Evidence File ===");
console.log(`  Size: ${evidence.length} bytes`);

// ────────────────────────────────────────────────────────────────────────────
// Merkle tree
// ────────────────────────────────────────────────────────────────────────────

console.log("\n=== STEP 2: Merkle Tree Generation ===");
const tree = generateMerkleTree(evidence);
console.log(`  Chunk count : ${tree.chunkCount}`);
console.log(`  Merkle root : ${tree.root}`);
console.log(`  Leaves      : ${tree.leaves.length}`);

// Verify proof for every chunk
for (let i = 0; i < tree.chunkCount; i++) {
  const { leaf, proof, root } = generateMerkleProof(evidence, i);
  const valid = verifyMerkleProof(leaf, proof, root);
  console.log(`  Proof[${i}] valid: ${valid}`);
}

// ────────────────────────────────────────────────────────────────────────────
// IPFS upload
// ────────────────────────────────────────────────────────────────────────────

console.log("\n=== STEP 3: Upload to IPFS ===");
const healthy = await storageProvider.healthCheck();
console.log(`  Provider healthy: ${healthy}`);

const cid = await storageProvider.upload(evidence, "evidence.bin");
console.log(`  IPFS CID: ${cid}`);

// ────────────────────────────────────────────────────────────────────────────
// On-chain registration (simulated)
// ────────────────────────────────────────────────────────────────────────────

console.log("\n=== STEP 4: On-Chain Registration (simulated) ===");
const merkleRootBytes32 = "0x" + tree.root;
console.log(`  Would call: SubmissionRegistry.registerSubmission("${cid}", "${merkleRootBytes32}")`);

// ────────────────────────────────────────────────────────────────────────────
// HTLC setup (simulated)
// ────────────────────────────────────────────────────────────────────────────

console.log("\n=== STEP 5: HTLC Bounty Escrow (simulated) ===");
const secret = crypto.randomBytes(32);
const preimage = "0x" + secret.toString("hex");
const hashlock = "0x" + crypto.createHash("sha256").update(secret).digest("hex");
const timelock = Math.floor(Date.now() / 1000) + 86400;
const bountyAmount = "1000000000000000000"; // 1 ETH in wei

console.log(`  Preimage (keep secret): ${preimage}`);
console.log(`  Hashlock (public)     : ${hashlock}`);
console.log(`  Timelock              : ${new Date(timelock * 1000).toISOString()}`);
console.log(`  Bounty amount         : 1 ETH`);
console.log(`  Would call: HTLC.fundBounty(submissionId, beneficiary, "${hashlock}", ${timelock})`);
console.log(`              {value: ${bountyAmount}}`);

console.log("\n=== Phase 1 Workflow Complete ===");
console.log("Next steps (using forge + anvil):");
console.log("  1. anvil --chain-id 31337");
console.log("  2. forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast");
console.log("  3. Use cast to call registerSubmission() and fundBounty()");
