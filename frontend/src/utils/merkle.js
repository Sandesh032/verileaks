/**
 * merkle.js — Client-side Merkle Tree generation matching the VeriLeaks standard.
 * Uses Web Crypto API (crypto.subtle) for fast, zero-dependency hashing in the browser.
 */

export const CHUNK_SIZE = 1024 * 1024; // 1 MiB

async function sha256(buffer) {
  const cryptoObj = typeof window !== "undefined" && window.crypto ? window.crypto : globalThis.crypto;
  const hashBuffer = await cryptoObj.subtle.digest("SHA-256", buffer);
  return new Uint8Array(hashBuffer);
}

function bufferToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function chunkData(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("Evidence data buffer cannot be empty");
  }
  const chunks = [];
  let offset = 0;
  while (offset < arrayBuffer.byteLength) {
    const end = Math.min(offset + CHUNK_SIZE, arrayBuffer.byteLength);
    chunks.push(new Uint8Array(arrayBuffer.slice(offset, end)));
    offset = end;
  }
  return chunks;
}

export async function hashLeaf(chunkBytes) {
  const payload = new Uint8Array(1 + chunkBytes.length);
  payload[0] = 0x00; // Domain separation tag for leaf
  payload.set(chunkBytes, 1);
  return await sha256(payload);
}

export async function hashNode(leftBytes, rightBytes) {
  const payload = new Uint8Array(1 + leftBytes.length + rightBytes.length);
  payload[0] = 0x01; // Domain separation tag for internal node
  payload.set(leftBytes, 1);
  payload.set(rightBytes, 1 + leftBytes.length);
  return await sha256(payload);
}

export async function generateClientMerkleTree(fileArrayBuffer) {
  const chunks = chunkData(fileArrayBuffer);
  let currentLevel = [];
  let currentNodesMeta = [];
  const chunkDetails = [];
  let offset = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const leaf = await hashLeaf(chunk);
    const leafHex = "0x" + bufferToHex(leaf);
    currentLevel.push(leaf);
    chunkDetails.push({
      index: idx,
      byteStart: offset,
      byteEnd: offset + chunk.byteLength,
      sizeBytes: chunk.byteLength,
      leafHashHex: leafHex
    });
    currentNodesMeta.push({
      level: 0,
      index: idx,
      label: `Leaf L${idx + 1} (Chunk #${idx + 1})`,
      hashHex: leafHex,
      role: idx % 2 === 0 ? "LEFT" : "RIGHT",
      isLeaf: true,
      isDuplicateOdd: false,
      leftChildHash: null,
      rightChildHash: null,
      leftChildLabel: null,
      rightChildLabel: null
    });
    offset += chunk.byteLength;
  }

  const leavesHex = currentLevel.map((l) => "0x" + bufferToHex(l));
  const treeLevels = [leavesHex];
  const detailedLevels = [currentNodesMeta];

  if (currentLevel.length === 1) {
    currentNodesMeta[0].role = "ROOT (SINGLE LEAF)";
    return {
      rootHex: "0x" + bufferToHex(currentLevel[0]),
      chunkCount: 1,
      leavesHex,
      chunkDetails,
      treeLevels,
      detailedLevels
    };
  }

  let levelIdx = 1;
  while (currentLevel.length > 1) {
    const nextLevel = [];
    const nextNodesMeta = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const leftNodeMeta = currentNodesMeta[i];
      const hasRight = i + 1 < currentLevel.length;
      const rightNodeMeta = hasRight ? currentNodesMeta[i + 1] : currentNodesMeta[i];
      const parent = hasRight
        ? await hashNode(currentLevel[i], currentLevel[i + 1])
        : await hashNode(currentLevel[i], currentLevel[i]);
      const parentHex = "0x" + bufferToHex(parent);
      const nodeIdx = Math.floor(i / 2);
      nextLevel.push(parent);
      nextNodesMeta.push({
        level: levelIdx,
        index: nodeIdx,
        label:
          Math.ceil(currentLevel.length / 2) === 1
            ? "Merkle Root"
            : `Branch L${levelIdx}-N${nodeIdx + 1}`,
        hashHex: parentHex,
        role:
          Math.ceil(currentLevel.length / 2) === 1
            ? "MERKLE ROOT"
            : nodeIdx % 2 === 0
            ? "LEFT"
            : "RIGHT",
        isRoot: Math.ceil(currentLevel.length / 2) === 1,
        isLeaf: false,
        isDuplicateOdd: !hasRight,
        leftChildHash: leftNodeMeta.hashHex,
        rightChildHash: rightNodeMeta.hashHex,
        leftChildLabel: leftNodeMeta.label,
        rightChildLabel: hasRight
          ? rightNodeMeta.label
          : `${leftNodeMeta.label} (Duplicated Odd Node)`
      });
    }
    currentLevel = nextLevel;
    currentNodesMeta = nextNodesMeta;
    treeLevels.push(currentLevel.map((n) => "0x" + bufferToHex(n)));
    detailedLevels.push(currentNodesMeta);
    levelIdx++;
  }

  return {
    rootHex: "0x" + bufferToHex(currentLevel[0]),
    chunkCount: chunks.length,
    leavesHex,
    chunkDetails,
    treeLevels,
    detailedLevels
  };
}
