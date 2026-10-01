/**
 * MockStorageProvider.js — In-memory IPFS mock for local development and tests.
 *
 * Generates a deterministic pseudo-CID based on the SHA-256 hash of the file
 * content so that tests remain reproducible.
 *
 * This provider MUST NOT be used in production. It is labelled as a development
 * provider. Use PinataStorageProvider for real IPFS pinning.
 */

import crypto from "crypto";
import { IStorageProvider } from "./IStorageProvider.js";

export class MockStorageProvider extends IStorageProvider {
  constructor() {
    super();
    /** @type {Map<string, Buffer>} */
    this._store = new Map();
  }

  /**
   * "Upload" a file by computing a deterministic pseudo-CID and storing
   * the bytes in memory.
   *
   * CID format: "Qm" + first 44 hex chars of SHA256(fileData)
   * (This mimics the look of a real CIDv0 without real IPFS encoding.)
   *
   * @param {Buffer} fileData
   * @param {string} [fileName]
   * @returns {Promise<string>} pseudo-CID
   */
  async upload(fileData, fileName = "evidence") {
    if (!Buffer.isBuffer(fileData) || fileData.length === 0) {
      throw new TypeError("fileData must be a non-empty Buffer");
    }

    const hash = crypto.createHash("sha256").update(fileData).digest("hex");
    // CIDv0 base58 prefix "Qm" + 44 hex chars (totals 46 chars like a real CIDv0)
    const cid = "Qm" + hash.substring(0, 44);

    this._store.set(cid, fileData);
    console.log(`[MockStorageProvider] Stored "${fileName}" with CID: ${cid}`);
    return cid;
  }

  /**
   * Retrieve a previously "uploaded" file.
   * @param {string} cid
   * @returns {Buffer|undefined}
   */
  retrieve(cid) {
    return this._store.get(cid);
  }

  async healthCheck() {
    return true; // always healthy in tests
  }

  get storedCount() {
    return this._store.size;
  }
}
