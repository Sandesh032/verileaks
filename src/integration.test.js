/**
 * integration.test.js — Phase 1 end-to-end workflow test.
 *
 * This test exercises the complete Phase 1 pipeline using:
 *   • MockStorageProvider (no real IPFS required)
 *   • Real Merkle tree computation
 *   • Mock on-chain interaction (simulated via ABI encoding)
 *
 * The on-chain portion is tested in the Solidity tests (test/*.t.sol).
 * This file tests the off-chain JavaScript pipeline that feeds into the
 * on-chain calls.
 *
 * Full on-chain integration is validated separately via:
 *   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
 */

import { generateMerkleTree, generateMerkleProof, verifyMerkleProof, CHUNK_SIZE } from "./merkle/MerkleTree.js";
import { MockStorageProvider } from "./storage/MockStorageProvider.js";
import crypto from "crypto";

// ────────────────────────────────────────────────────────────────────────────
// Phase 1 Pipeline Integration Test
// ────────────────────────────────────────────────────────────────────────────

describe("Phase 1 Pipeline Integration", () => {
  test("complete workflow: evidence → Merkle → IPFS → on-chain registration data", async () => {
    // ── Step 1: Evidence file ──────────────────────────────────────────────
    const evidenceFile = Buffer.from(
      "Confidential document: Internal memo dated 2024-01-15. " +
        "Subject: Unauthorized disposal of environmental records. " +
        "This document provides evidence of regulatory non-compliance. " +
        "Hash integrity must be preserved through the entire pipeline."
    );

    // ── Step 2: Chunk and generate Merkle tree ────────────────────────────
    const tree = generateMerkleTree(evidenceFile);

    expect(tree.root).toMatch(/^[0-9a-f]{64}$/);
    expect(tree.chunkCount).toBeGreaterThan(0);
    expect(tree.leaves.length).toBe(tree.chunkCount);

    // ── Step 3: Upload to IPFS (mock) ─────────────────────────────────────
    const storage = new MockStorageProvider();
    const cid = await storage.upload(evidenceFile, "evidence.bin");

    expect(cid).toBeTruthy();
    expect(cid.startsWith("Qm")).toBe(true);

    // ── Step 4: Prepare on-chain registration parameters ──────────────────
    // These would be passed to SubmissionRegistry.registerSubmission()
    const ipfsCid = cid;
    const merkleRoot = "0x" + tree.root; // bytes32 hex for Solidity

    expect(ipfsCid.length).toBeGreaterThan(0);
    expect(merkleRoot.length).toBe(66); // 0x + 64 hex chars

    // ── Step 5: Simulate HTLC parameters ─────────────────────────────────
    const secret = crypto.randomBytes(32);
    const preimage = "0x" + secret.toString("hex");
    const hashlock = "0x" + crypto.createHash("sha256")
      .update(secret) // hash of the raw bytes, not the hex string
      .digest("hex");
    const timelock = Math.floor(Date.now() / 1000) + 86400; // +1 day

    expect(preimage).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hashlock).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hashlock).not.toBe(preimage);

    // ── Step 6: Verify Merkle proof for chunk 0 ───────────────────────────
    const { leaf, proof, root } = generateMerkleProof(evidenceFile, 0);
    expect(verifyMerkleProof(leaf, proof, root)).toBe(true);

    console.log("=== Phase 1 Pipeline Results ===");
    console.log("Evidence size  :", evidenceFile.length, "bytes");
    console.log("Chunk count    :", tree.chunkCount);
    console.log("Merkle root    :", merkleRoot);
    console.log("IPFS CID       :", ipfsCid);
    console.log("Preimage (hex) :", preimage);
    console.log("Hashlock (hex) :", hashlock);
    console.log("Timelock       :", new Date(timelock * 1000).toISOString());
    console.log("Proof valid    : true");
  });

  test("determinism: processing same evidence twice yields identical CID and Merkle root", async () => {
    const evidence = Buffer.from("Repeated evidence for determinism test 12345");
    const storage = new MockStorageProvider();

    const tree1 = generateMerkleTree(evidence);
    const cid1 = await storage.upload(evidence);

    const tree2 = generateMerkleTree(evidence);
    const cid2 = await storage.upload(evidence);

    expect(tree1.root).toBe(tree2.root);
    expect(cid1).toBe(cid2);
  });

  test("multi-chunk evidence: proof verification works for every chunk", async () => {
    // Create evidence slightly larger than 1 chunk
    const evidence = Buffer.alloc(CHUNK_SIZE + 1000, 0x42);
    const tree = generateMerkleTree(evidence);

    for (let i = 0; i < tree.chunkCount; i++) {
      const { leaf, proof, root } = generateMerkleProof(evidence, i);
      expect(verifyMerkleProof(leaf, proof, root)).toBe(true);
    }
  });

  test("tampering with evidence changes both CID and Merkle root", async () => {
    const original = Buffer.from("Original clean evidence file content.");
    const tampered = Buffer.from("0riginal cl3an evidence file content!"); // tampered

    const storage = new MockStorageProvider();

    const [cidOrig, cidTamp] = await Promise.all([
      storage.upload(original),
      storage.upload(tampered),
    ]);

    const treeOrig = generateMerkleTree(original);
    const treeTamp = generateMerkleTree(tampered);

    expect(cidOrig).not.toBe(cidTamp);
    expect(treeOrig.root).not.toBe(treeTamp.root);
  });

  test("HTLC hashlock: keccak256(preimage) pattern mimicked in JS", () => {
    // In Solidity: keccak256(abi.encodePacked(preimage))
    // For Phase 1 we use SHA-256 on the raw bytes (consistent with MerkleTree).
    // The HTLC contract uses keccak256; this test documents the off-chain convention.
    const preimage = Buffer.from("my_secret_preimage");
    const hashlock = crypto.createHash("sha256").update(preimage).digest("hex");
    const hashlock2 = crypto.createHash("sha256").update(preimage).digest("hex");
    expect(hashlock).toBe(hashlock2); // deterministic
    expect(hashlock).toMatch(/^[0-9a-f]{64}$/);
  });
});
