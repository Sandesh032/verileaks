/**
 * PinataStorageProvider.js — Pinata IPFS pinning service integration.
 *
 * Credentials are read from environment variables — NEVER hard-coded.
 * Set the following in your .env file:
 *
 *   PINATA_API_URL=https://api.pinata.cloud
 *   PINATA_API_KEY=<your_api_key>
 *   PINATA_API_SECRET=<your_api_secret>
 *
 * This provider implements IStorageProvider and can be swapped for
 * MockStorageProvider in tests without changing any caller code.
 */

import FormData from "form-data";
import fetch from "node-fetch";
import { IStorageProvider } from "./IStorageProvider.js";

export class PinataStorageProvider extends IStorageProvider {
  /**
   * @param {object} options
   * @param {string} options.apiUrl    — e.g. "https://api.pinata.cloud"
   * @param {string} options.apiKey    — Pinata API key
   * @param {string} options.apiSecret — Pinata API secret
   */
  constructor({ apiUrl, apiKey, apiSecret }) {
    super();
    if (!apiUrl || !apiKey || !apiSecret) {
      throw new Error(
        "PinataStorageProvider requires apiUrl, apiKey, and apiSecret. " +
          "Set PINATA_API_URL, PINATA_API_KEY, PINATA_API_SECRET in .env"
      );
    }
    this._apiUrl = apiUrl.replace(/\/$/, ""); // strip trailing slash
    this._headers = {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    };
  }

  /**
   * Pin a file to IPFS via Pinata's pinFileToIPFS endpoint.
   * Returns the IPFS CID of the uploaded file.
   *
   * @param {Buffer} fileData
   * @param {string} [fileName]
   * @returns {Promise<string>} IPFS CID
   */
  async upload(fileData, fileName = "evidence") {
    if (!Buffer.isBuffer(fileData) || fileData.length === 0) {
      throw new TypeError("fileData must be a non-empty Buffer");
    }

    const form = new FormData();
    form.append("file", fileData, {
      filename: fileName,
      contentType: "application/octet-stream",
    });

    const url = `${this._apiUrl}/pinning/pinFileToIPFS`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this._headers,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pinata upload failed [${res.status}]: ${text}`);
    }

    const json = await res.json();
    if (!json.IpfsHash) {
      throw new Error(`Pinata response missing IpfsHash: ${JSON.stringify(json)}`);
    }

    return json.IpfsHash;
  }

  /**
   * Verify that Pinata credentials are working.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    const url = `${this._apiUrl}/data/testAuthentication`;
    const res = await fetch(url, { headers: this._headers });
    return res.ok;
  }
}

/**
 * Factory: create a PinataStorageProvider from environment variables.
 * Throws if any required variable is missing.
 */
export function createPinataProviderFromEnv() {
  const apiUrl = process.env.PINATA_API_URL;
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;

  if (!apiUrl || !apiKey || !apiSecret) {
    throw new Error(
      "Missing Pinata credentials. Ensure .env contains:\n" +
        "  PINATA_API_URL\n  PINATA_API_KEY\n  PINATA_API_SECRET"
    );
  }

  return new PinataStorageProvider({ apiUrl, apiKey, apiSecret });
}
