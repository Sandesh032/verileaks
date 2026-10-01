/**
 * StorageProvider.test.js — Unit tests for MockStorageProvider.
 * PinataStorageProvider is integration-only (requires real credentials).
 */

import { MockStorageProvider } from "./MockStorageProvider.js";

describe("MockStorageProvider", () => {
  let provider;

  beforeEach(() => {
    provider = new MockStorageProvider();
  });

  test("healthCheck returns true", async () => {
    expect(await provider.healthCheck()).toBe(true);
  });

  test("upload returns a CID string starting with Qm", async () => {
    const data = Buffer.from("test evidence content");
    const cid = await provider.upload(data);
    expect(typeof cid).toBe("string");
    expect(cid.startsWith("Qm")).toBe(true);
  });

  test("upload: same content → same CID (deterministic)", async () => {
    const data = Buffer.from("deterministic content");
    const cid1 = await provider.upload(data, "file1.txt");
    const cid2 = await provider.upload(data, "file2.txt");
    expect(cid1).toBe(cid2);
  });

  test("upload: different content → different CID", async () => {
    const cid1 = await provider.upload(Buffer.from("content alpha"));
    const cid2 = await provider.upload(Buffer.from("content beta!"));
    expect(cid1).not.toBe(cid2);
  });

  test("retrieve returns stored content", async () => {
    const data = Buffer.from("my secret evidence");
    const cid = await provider.upload(data);
    const retrieved = provider.retrieve(cid);
    expect(retrieved).toEqual(data);
  });

  test("retrieve returns undefined for unknown CID", () => {
    expect(provider.retrieve("QmUnknown")).toBeUndefined();
  });

  test("storedCount increments on each unique upload", async () => {
    expect(provider.storedCount).toBe(0);
    await provider.upload(Buffer.from("file A"));
    expect(provider.storedCount).toBe(1);
    await provider.upload(Buffer.from("file B"));
    expect(provider.storedCount).toBe(2);
  });

  test("upload throws on empty Buffer", async () => {
    await expect(provider.upload(Buffer.alloc(0))).rejects.toThrow(TypeError);
  });

  test("upload throws on non-Buffer", async () => {
    await expect(provider.upload("not a buffer")).rejects.toThrow(TypeError);
  });
});
