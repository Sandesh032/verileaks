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

  for (const chunk of chunks) {
    const leaf = await hashLeaf(chunk);
    currentLevel.push(leaf);
  }

  const leavesHex = currentLevel.map(bufferToHex);

  if (currentLevel.length === 1) {
    return {
      rootHex: "0x" + bufferToHex(currentLevel[0]),
      chunkCount: 1,
      leavesHex
    };
  }

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        const parent = await hashNode(currentLevel[i], currentLevel[i + 1]);
        nextLevel.push(parent);
      } else {
        // Odd node: promoted by hashing with itself
        const parent = await hashNode(currentLevel[i], currentLevel[i]);
        nextLevel.push(parent);
      }
    }
    currentLevel = nextLevel;
  }

  return {
    rootHex: "0x" + bufferToHex(currentLevel[0]),
    chunkCount: chunks.length,
    leavesHex
  };
}
