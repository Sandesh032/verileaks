/**
 * MerkleTree.test.js — Unit tests for the VeriLeaks Merkle tree.
 *
 * Test categories:
 *   1. One chunk
 *   2. Multiple chunks (even)
 *   3. Multiple chunks (odd)
 *   4. Determinism: same input → same root
 *   5. Sensitivity: one-byte change → different root
 *   6. Proof generation
 *   7. Valid proof verification
 *   8. Invalid proof rejection
 */

import {
  generateMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  chunkData,
  CHUNK_SIZE,
} from "./MerkleTree.js";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function randomBytes(size) {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

// ────────────────────────────────────────────────────────────────────────────
// chunkData
// ────────────────────────────────────────────────────────────────────────────

describe("chunkData", () => {
  test("throws on empty buffer", () => {
    expect(() => chunkData(Buffer.alloc(0))).toThrow(RangeError);
  });

  test("throws on non-buffer input", () => {
    expect(() => chunkData("string")).toThrow(TypeError);
  });

  test("single chunk when data < CHUNK_SIZE", () => {
    const data = Buffer.from("hello world");
    const chunks = chunkData(data);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(data);
  });

  test("exact multiple of CHUNK_SIZE produces correct count", () => {
    const data = randomBytes(CHUNK_SIZE * 3);
    const chunks = chunkData(data);
    expect(chunks).toHaveLength(3);
  });

  test("non-multiple of CHUNK_SIZE — last chunk is shorter", () => {
    const data = randomBytes(CHUNK_SIZE * 2 + 500);
    const chunks = chunkData(data);
    expect(chunks).toHaveLength(3);
    expect(chunks[2].length).toBe(500);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// generateMerkleTree
// ────────────────────────────────────────────────────────────────────────────

describe("generateMerkleTree", () => {
  test("one chunk — root equals leaf hash", () => {
    const data = Buffer.from("single chunk content");
    const result = generateMerkleTree(data);

    expect(result.chunkCount).toBe(1);
    expect(result.leaves).toHaveLength(1);
    expect(result.root).toBe(result.leaves[0]);
    expect(result.root).toMatch(/^[0-9a-f]{64}$/);
  });

  test("two chunks (even)", () => {
    const data = randomBytes(CHUNK_SIZE + 1); // 2 chunks
    const result = generateMerkleTree(data);

    expect(result.chunkCount).toBe(2);
    expect(result.leaves).toHaveLength(2);
    expect(result.root).toMatch(/^[0-9a-f]{64}$/);
    expect(result.root).not.toBe(result.leaves[0]);
    expect(result.root).not.toBe(result.leaves[1]);
  });

  test("three chunks (odd)", () => {
    const data = randomBytes(CHUNK_SIZE * 2 + 1);
    const result = generateMerkleTree(data);

    expect(result.chunkCount).toBe(3);
    expect(result.leaves).toHaveLength(3);
    expect(result.root).toMatch(/^[0-9a-f]{64}$/);
  });

  test("four chunks (even power of 2)", () => {
    const data = randomBytes(CHUNK_SIZE * 4);
    const result = generateMerkleTree(data);

    expect(result.chunkCount).toBe(4);
    expect(result.leaves).toHaveLength(4);
  });

  // ── Determinism ────────────────────────────────────────────────────────

  test("determinism: same input → same root (small)", () => {
    const data = Buffer.from("deterministic content abc");
    const r1 = generateMerkleTree(data);
    const r2 = generateMerkleTree(data);
    expect(r1.root).toBe(r2.root);
    expect(r1.leaves).toEqual(r2.leaves);
  });

  test("determinism: same input → same root (multi-chunk)", () => {
    const data = randomBytes(CHUNK_SIZE * 3 + 12345);
    const r1 = generateMerkleTree(data);
    const r2 = generateMerkleTree(data);
    expect(r1.root).toBe(r2.root);
  });

  // ── Sensitivity ────────────────────────────────────────────────────────

  test("sensitivity: flipping one bit changes the root", () => {
    const data = randomBytes(CHUNK_SIZE * 2);
    const r1 = generateMerkleTree(data);

    // Flip a single byte in the SECOND chunk
    const modified = Buffer.from(data);
    modified[CHUNK_SIZE] ^= 0xff;
    const r2 = generateMerkleTree(modified);

    expect(r1.root).not.toBe(r2.root);
  });

  test("sensitivity: changing first byte of first chunk changes root", () => {
    const data = Buffer.from("abcdefghij");
    const r1 = generateMerkleTree(data);

    const modified = Buffer.from(data);
    modified[0] = modified[0] === 0 ? 1 : 0;
    const r2 = generateMerkleTree(modified);

    expect(r1.root).not.toBe(r2.root);
  });

  test("different content → different root", () => {
    const r1 = generateMerkleTree(Buffer.from("file content alpha"));
    const r2 = generateMerkleTree(Buffer.from("file content beta!"));
    expect(r1.root).not.toBe(r2.root);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// generateMerkleProof
// ────────────────────────────────────────────────────────────────────────────

describe("generateMerkleProof", () => {
  const fileData = randomBytes(CHUNK_SIZE * 4);
  const tree = generateMerkleTree(fileData);

  test("generates proof for index 0", () => {
    const proof = generateMerkleProof(fileData, 0);
    expect(proof.root).toBe(tree.root);
    expect(proof.leaf).toBe(tree.leaves[0]);
    expect(proof.proof.length).toBeGreaterThan(0);
  });

  test("generates proof for last index", () => {
    const proof = generateMerkleProof(fileData, 3);
    expect(proof.root).toBe(tree.root);
    expect(proof.leaf).toBe(tree.leaves[3]);
  });

  test("throws for out-of-range index (negative)", () => {
    expect(() => generateMerkleProof(fileData, -1)).toThrow(RangeError);
  });

  test("throws for out-of-range index (too large)", () => {
    expect(() => generateMerkleProof(fileData, 100)).toThrow(RangeError);
  });

  test("odd number of chunks — proof for promoted node", () => {
    const oddData = randomBytes(CHUNK_SIZE * 3);
    const proof = generateMerkleProof(oddData, 2); // last (promoted) leaf
    expect(proof.proof.length).toBeGreaterThan(0);
    expect(proof.root).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// verifyMerkleProof
// ────────────────────────────────────────────────────────────────────────────

describe("verifyMerkleProof", () => {
  const fileData = randomBytes(CHUNK_SIZE * 4);
  const tree = generateMerkleTree(fileData);

  test("valid proof verifies for every leaf index", () => {
    for (let i = 0; i < tree.leaves.length; i++) {
      const { leaf, proof, root } = generateMerkleProof(fileData, i);
      expect(verifyMerkleProof(leaf, proof, root)).toBe(true);
    }
  });

  test("invalid proof (wrong leaf) does NOT verify", () => {
    const { proof, root } = generateMerkleProof(fileData, 0);
    const fakeLeaf = "a".repeat(64); // 32 bytes of 0xaa
    expect(verifyMerkleProof(fakeLeaf, proof, root)).toBe(false);
  });

  test("invalid proof (tampered sibling hash) does NOT verify", () => {
    const { leaf, proof, root } = generateMerkleProof(fileData, 0);
    const tamperedProof = proof.map((step, i) =>
      i === 0 ? { ...step, hash: "b".repeat(64) } : step
    );
    expect(verifyMerkleProof(leaf, tamperedProof, root)).toBe(false);
  });

  test("wrong expected root does NOT verify", () => {
    const { leaf, proof } = generateMerkleProof(fileData, 0);
    const wrongRoot = "c".repeat(64);
    expect(verifyMerkleProof(leaf, proof, wrongRoot)).toBe(false);
  });

  test("single-chunk file — empty proof verifies when leaf equals root", () => {
    const small = Buffer.from("tiny file");
    const { leaf, proof, root } = generateMerkleProof(small, 0);
    expect(proof).toHaveLength(0); // no siblings; root == leaf
    expect(verifyMerkleProof(leaf, proof, root)).toBe(true);
  });

  test("odd-chunk file — valid proof for all indices", () => {
    const oddData = randomBytes(CHUNK_SIZE * 5 + 100);
    const oddTree = generateMerkleTree(oddData);
    for (let i = 0; i < oddTree.leaves.length; i++) {
      const { leaf, proof, root } = generateMerkleProof(oddData, i);
      expect(verifyMerkleProof(leaf, proof, root)).toBe(true);
    }
  });
});
