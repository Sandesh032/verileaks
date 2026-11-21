/**
 * encryption.js — Client-side AES-256-GCM encryption and decryption using WebCrypto API.
 * Ensures that plaintext evidence never leaves the Whistleblower's browser unencrypted,
 * and only VRF-selected jurors holding the sealed key envelope can decrypt the file.
 */

export function bytesToHex(bytes) {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToBytes(hexStr) {
  const clean = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToUint8Array(base64) {
  const binaryStr = window.atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts an ArrayBuffer in the browser using AES-256-GCM.
 * @param {ArrayBuffer} plainBuffer
 * @returns {Promise<{
 *   ciphertextBuffer: ArrayBuffer,
 *   ciphertextBase64: string,
 *   ciphertextPreviewHex: string,
 *   aesKeyHex: string,
 *   ivHex: string,
 *   algorithm: string
 * }>}
 */
export async function encryptEvidenceBuffer(plainBuffer) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    plainBuffer
  );

  const rawKeyBuffer = await window.crypto.subtle.exportKey("raw", key);
  const aesKeyHex = bytesToHex(new Uint8Array(rawKeyBuffer));
  const ivHex = bytesToHex(iv);
  const cipherBytes = new Uint8Array(ciphertextBuffer);
  const ciphertextPreviewHex = bytesToHex(cipherBytes.slice(0, 32)) + "...";
  const ciphertextBase64 = arrayBufferToBase64(ciphertextBuffer);

  return {
    ciphertextBuffer,
    ciphertextBase64,
    ciphertextPreviewHex,
    aesKeyHex,
    ivHex,
    algorithm: "AES-256-GCM"
  };
}

/**
 * Decrypts a Base64-encoded AES-256-GCM ciphertext in the browser.
 * @param {string} ciphertextBase64
 * @param {string} aesKeyHex
 * @param {string} ivHex
 * @returns {Promise<Uint8Array>}
 */
export async function decryptEvidenceBuffer(ciphertextBase64, aesKeyHex, ivHex) {
  const cipherBytes = base64ToUint8Array(ciphertextBase64);
  const keyBytes = hexToBytes(aesKeyHex);
  const ivBytes = hexToBytes(ivHex);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
    cryptoKey,
    cipherBytes
  );

  return new Uint8Array(plainBuffer);
}
