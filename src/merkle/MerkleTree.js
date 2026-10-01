/**
 * MerkleTree.js — VeriLeaks Phase 1 Merkle tree implementation.
 *
 * Hashing convention (deterministic)
 * ────────────────────────────────────
 * • Algorithm      : SHA-256 (via Node's crypto module)
 * • Chunk size     : 1 MB (1_048_576 bytes)
 * • Leaf hash rule : SHA256(0x00 || chunk_bytes)   — domain tag 0x00
 * • Node hash rule : SHA256(0x01 || left || right) — domain tag 0x01
 *                    where left and right are 32-byte hash Buffer values.
 * • Odd node rule  : The last node at a level is promoted (duplicated) to
 *                    pair with itself: hash(0x01 || last || last)
 * • Byte encoding  : Raw bytes (no Base64, no hex) inside the hash function.
 *                    All public APIs return hex strings for readability.
 *
 * Determinism guarantee
 * ──────────────────────
 * Given the same file bytes and the same CHUNK_SIZE, the output Merkle root
 * will always be identical. Tests in MerkleTree.test.js prove this.
 */

import crypto from "crypto";

export const CHUNK_SIZE = 1_048_576; // 1 MiB

// Domain separation tags prevent leaf / internal node collisions.
const LEAF_TAG = Buffer.from([0x00]);
const NODE_TAG = Buffer.from([0x01]);

/**
 * Hash a leaf chunk.
 * @param {Buffer} chunk
 * @returns {Buffer} 32-byte hash
 */
function hashLeaf(chunk) {
  return crypto.createHash("sha256").update(LEAF_TAG).update(chunk).digest();
}

/**
 * Hash two child nodes.
 * @param {Buffer} left  32-byte hash
 * @param {Buffer} right 32-byte hash
 * @returns {Buffer} 32-byte hash
 */
function hashNodes(left, right) {
  return crypto.createHash("sha256").update(NODE_TAG).update(left).update(right).digest();
}

/**
 * Split a Buffer into fixed-size chunks.
 * The last chunk may be shorter than CHUNK_SIZE.
 * @param {Buffer} data
 * @returns {Buffer[]}
 */
export function chunkData(data) {
  if (!Buffer.isBuffer(data)) throw new TypeError("data must be a Buffer");
  if (data.length === 0) throw new RangeError("data must not be empty");

  const chunks = [];
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    chunks.push(data.subarray(offset, offset + CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Build a Merkle tree from an array of leaf hashes and return all levels.
 * Level 0 = leaf hashes. Last level = [root].
 * @param {Buffer[]} leaves — array of 32-byte leaf hashes
 * @returns {Buffer[][]} levels
 */
function buildLevels(leaves) {
  if (leaves.length === 0) throw new RangeError("At least one leaf is required");

  const levels = [leaves.slice()];
  let current = leaves.slice();

  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      // Odd node: promote it by pairing with itself.
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(hashNodes(left, right));
    }
    levels.push(next);
    current = next;
  }

  return levels;
}

/**
 * Generate a Merkle tree from a file Buffer.
 *
 * @param {Buffer} fileData — raw file bytes
 * @returns {{
 *   root: string,         — hex-encoded Merkle root
 *   leaves: string[],     — hex-encoded leaf hashes
 *   levels: string[][],   — all tree levels (hex), levels[0] = leaves
 *   chunkCount: number
 * }}
 */
export function generateMerkleTree(fileData) {
  const chunks = chunkData(fileData);
  const leafHashes = chunks.map(hashLeaf);
  const levels = buildLevels(leafHashes);
  const root = levels[levels.length - 1][0];

  return {
    root: root.toString("hex"),
    leaves: leafHashes.map((h) => h.toString("hex")),
    levels: levels.map((level) => level.map((h) => h.toString("hex"))),
    chunkCount: chunks.length,
  };
}

/**
 * Generate a Merkle proof for a given leaf index.
 *
 * @param {Buffer} fileData
 * @param {number} leafIndex — 0-based index of the target chunk
 * @returns {{
 *   leaf: string,           — hex leaf hash
 *   proof: {hash: string, position: "left"|"right"}[],
 *   root: string
 * }}
 */
export function generateMerkleProof(fileData, leafIndex) {
  const chunks = chunkData(fileData);
  if (leafIndex < 0 || leafIndex >= chunks.length) {
    throw new RangeError(`leafIndex ${leafIndex} out of range [0, ${chunks.length - 1}]`);
  }

  const leafHashes = chunks.map(hashLeaf);
  const levels = buildLevels(leafHashes);

  const proof = [];
  let idx = leafIndex;

  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const level = levels[lvl];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;

    // For an odd node that was promoted, the sibling is itself.
    const sibling = siblingIdx < level.length ? level[siblingIdx] : level[idx];
    proof.push({
      hash: sibling.toString("hex"),
      position: isRight ? "left" : "right",
    });

    idx = Math.floor(idx / 2);
  }

  return {
    leaf: leafHashes[leafIndex].toString("hex"),
    proof,
    root: levels[levels.length - 1][0].toString("hex"),
  };
}

/**
 * Verify a Merkle proof.
 *
 * @param {string} leafHex    — hex leaf hash
 * @param {{ hash: string, position: "left"|"right" }[]} proof
 * @param {string} expectedRoot — hex root
 * @returns {boolean}
 */
export function verifyMerkleProof(leafHex, proof, expectedRoot) {
  let current = Buffer.from(leafHex, "hex");

  for (const step of proof) {
    const sibling = Buffer.from(step.hash, "hex");
    if (step.position === "left") {
      current = hashNodes(sibling, current);
    } else {
      current = hashNodes(current, sibling);
    }
  }

  return current.toString("hex") === expectedRoot;
}
