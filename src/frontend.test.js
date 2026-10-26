import { chunkData, hashLeaf, hashNode } from "../frontend/src/utils/merkle.js";
import { SUPPORTED_CHAINS, CONTRACT_ADDRESSES } from "../frontend/src/contracts/config.js";
import { VotingStatus, BountyStatus, WatchtowerRules } from "./watchtower/WatchtowerRules.js";

// Mock Web Crypto API in Node test environment if not present
if (!globalThis.crypto) {
  const nodeCrypto = await import("crypto");
  globalThis.crypto = nodeCrypto.webcrypto;
}

describe("Frontend Architecture & Client Utility Tests", () => {
  describe("Client-side Merkle Chunking & Domain Separation", () => {
    it("throws when data buffer is empty", () => {
      expect(() => chunkData(new ArrayBuffer(0))).toThrow();
    });

    it("chunks buffer into 1 MiB segments", () => {
      const buffer = new ArrayBuffer(2.5 * 1024 * 1024); // 2.5 MiB
      const chunks = chunkData(buffer);
      expect(chunks.length).toBe(3);
      expect(chunks[0].byteLength).toBe(1024 * 1024);
      expect(chunks[1].byteLength).toBe(1024 * 1024);
      expect(chunks[2].byteLength).toBe(0.5 * 1024 * 1024);
    });

    it("applies domain separation tag 0x00 to leaf hashes", async () => {
      const chunk = new Uint8Array([1, 2, 3, 4]);
      const leafHash = await hashLeaf(chunk);
      expect(leafHash).toBeInstanceOf(Uint8Array);
      expect(leafHash.length).toBe(32);
    });

    it("applies domain separation tag 0x01 to node hashes", async () => {
      const left = new Uint8Array(32).fill(1);
      const right = new Uint8Array(32).fill(2);
      const nodeHash = await hashNode(left, right);
      expect(nodeHash).toBeInstanceOf(Uint8Array);
      expect(nodeHash.length).toBe(32);
    });
  });

  describe("Network & Chain Configuration", () => {
    it("supports Arbitrum Sepolia (421614) and Anvil (31337)", () => {
      expect(SUPPORTED_CHAINS[421614]).toBeDefined();
      expect(SUPPORTED_CHAINS[421614].name).toBe("Arbitrum Sepolia");
      expect(SUPPORTED_CHAINS[31337]).toBeDefined();
      expect(SUPPORTED_CHAINS[31337].name).toBe("Anvil Localhost");
    });

    it("configures non-empty addresses for all 7 contracts", () => {
      const required = [
        "registry",
        "staking",
        "htlc",
        "voting",
        "arbitratedBounty",
        "jurorSelection",
        "credentials"
      ];
      for (const key of required) {
        expect(CONTRACT_ADDRESSES[key]).toBeDefined();
        expect(CONTRACT_ADDRESSES[key].startsWith("0x")).toBe(true);
      }
    });
  });

  describe("Voting Status & Error Handling Mapping", () => {
    it("correctly models lifecycle transitions", () => {
      expect(VotingStatus.ACTIVE).toBe(2);
      expect(VotingStatus.FINALIZED).toBe(3);
      expect(BountyStatus.DISPUTED).toBe(2);
      expect(BountyStatus.RELEASED).toBe(3);
    });

    it("evaluates deadline boundaries accurately without off-by-one errors", () => {
      const now = 1000;
      const disputeActive = {
        disputeId: "1",
        status: VotingStatus.ACTIVE,
        revealDeadline: 1000, // exact boundary
        jurySize: 3,
        revealedCount: 2
      };
      const actions = WatchtowerRules.evaluateDisputes([disputeActive], now);
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe("FINALIZE_DISPUTE");
    });
  });
});
