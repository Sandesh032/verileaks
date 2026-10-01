/**
 * IStorageProvider.js — Abstract interface for evidence storage providers.
 *
 * Both PinataStorageProvider and MockStorageProvider implement this interface.
 * Phase 2 can add a FilecoinStorageProvider without touching any caller code.
 */

export class IStorageProvider {
  /**
   * Upload evidence file bytes and return the resulting IPFS CID.
   * @param {Buffer} fileData - Raw file bytes.
   * @param {string} [fileName] - Optional display name for the file.
   * @returns {Promise<string>} - IPFS CID (e.g. "QmXoypiz...")
   */
  // eslint-disable-next-line no-unused-vars
  async upload(fileData, fileName) {
    throw new Error("Not implemented: upload()");
  }

  /**
   * Check whether the provider is reachable and credentials are valid.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error("Not implemented: healthCheck()");
  }
}
