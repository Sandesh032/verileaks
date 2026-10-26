import fs from "fs";
import path from "path";
import http from "http";
import { WatchtowerStore } from "./WatchtowerStore.js";
import { WatchtowerRules, VotingStatus, BountyStatus } from "./WatchtowerRules.js";
import { MultiNodeCoordinator } from "./MultiNodeCoordinator.js";

const TEST_DIR = ".test-data/watchtower";

describe("Watchtower Network & Rules Test Suite", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("WatchtowerStore Persistence & Recovery", () => {
    it("should atomically persist checkpoints and recover after restart", () => {
      const storeFile = path.join(TEST_DIR, "node-1.json");
      const store1 = new WatchtowerStore(storeFile);

      expect(store1.getCheckpoint()).toBe(0);
      store1.saveCheckpoint(1050);
      expect(store1.getCheckpoint()).toBe(1050);

      store1.updateDispute(42, {
        status: VotingStatus.ACTIVE,
        commitDeadline: 1700000000,
        revealDeadline: 1700086400,
        jurySize: 3
      });

      store1.recordEvent("1337:0xabc:0", { eventName: "DisputeCreated" });
      store1.recordAction("FINALIZE:42", { txHash: "0x123" });

      // Simulate crash and restart by creating a new WatchtowerStore instance on same file
      const store2 = new WatchtowerStore(storeFile);

      expect(store2.getCheckpoint()).toBe(1050);
      expect(store2.hasProcessedEvent("1337:0xabc:0")).toBe(true);
      expect(store2.hasExecutedAction("FINALIZE:42")).toBe(true);

      const d = store2.getDispute(42);
      expect(d).toBeDefined();
      expect(d.status).toBe(VotingStatus.ACTIVE);
      expect(d.jurySize).toBe(3);
    });

    it("should handle event and action deduplication", () => {
      const storeFile = path.join(TEST_DIR, "dedup.json");
      const store = new WatchtowerStore(storeFile);

      const eventKey = "42161:0xdeadbeef:2";
      expect(store.hasProcessedEvent(eventKey)).toBe(false);

      store.recordEvent(eventKey, { blockNumber: 50 });
      expect(store.hasProcessedEvent(eventKey)).toBe(true);

      const actionKey = "SETTLE_BOUNTY:1";
      expect(store.hasExecutedAction(actionKey)).toBe(false);

      store.recordAction(actionKey, { txHash: "0x789" });
      expect(store.hasExecutedAction(actionKey)).toBe(true);
    });
  });

  describe("WatchtowerRules Evaluation", () => {
    const now = 1700100000;

    it("Rule 1: FINALIZE_DISPUTE triggers when reveal deadline has passed", () => {
      const disputes = [
        {
          disputeId: "1",
          status: VotingStatus.ACTIVE,
          revealDeadline: now - 100, // passed
          jurySize: 3,
          revealedCount: 1
        }
      ];

      const actions = WatchtowerRules.evaluateDisputes(disputes, now);
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe("FINALIZE_DISPUTE");
      expect(actions[0].targetId).toBe("1");
    });

    it("Rule 1: FINALIZE_DISPUTE triggers early if all jurors revealed before deadline", () => {
      const disputes = [
        {
          disputeId: "2",
          status: VotingStatus.ACTIVE,
          revealDeadline: now + 5000, // in future
          jurySize: 3,
          revealedCount: 3 // all revealed!
        }
      ];

      const actions = WatchtowerRules.evaluateDisputes(disputes, now);
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe("FINALIZE_DISPUTE");
      expect(actions[0].targetId).toBe("2");
    });

    it("Rule 1: Does NOT trigger finalize when reveal period is active and unrevealed jurors remain", () => {
      const disputes = [
        {
          disputeId: "3",
          status: VotingStatus.ACTIVE,
          revealDeadline: now + 5000,
          jurySize: 3,
          revealedCount: 1
        }
      ];

      const actions = WatchtowerRules.evaluateDisputes(disputes, now);
      expect(actions.length).toBe(0);
    });

    it("Rule 2: CANCEL_TIMEOUT_DISPUTE triggers when VRF selection times out in CREATED state", () => {
      const disputes = [
        {
          disputeId: "4",
          status: VotingStatus.CREATED,
          createdAt: now - 4000,
          selectionTimeout: 3600 // 1 hour
        }
      ];

      const actions = WatchtowerRules.evaluateDisputes(disputes, now);
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe("CANCEL_TIMEOUT_DISPUTE");
      expect(actions[0].targetId).toBe("4");
    });

    it("Rule 3: SETTLE_BOUNTY triggers when dispute is finalized or cancelled", () => {
      const bounties = [
        {
          bountyId: "10",
          status: BountyStatus.DISPUTED,
          activeDispute: "100"
        }
      ];

      const disputesMap = {
        "100": {
          disputeId: "100",
          status: VotingStatus.FINALIZED
        }
      };

      const actions = WatchtowerRules.evaluateBounties(bounties, disputesMap, now);
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe("SETTLE_BOUNTY");
      expect(actions[0].targetId).toBe("10");
    });

    it("Rule 4: REFUND_BOUNTY triggers when timelock expired for FUNDED or REJECTED bounties", () => {
      const bounties = [
        {
          bountyId: "20",
          status: BountyStatus.FUNDED,
          timelock: now - 300 // expired
        },
        {
          bountyId: "21",
          status: BountyStatus.REJECTED,
          timelock: now - 100 // expired
        },
        {
          bountyId: "22",
          status: BountyStatus.FUNDED,
          timelock: now + 5000 // not expired
        }
      ];

      const actions = WatchtowerRules.evaluateBounties(bounties, {}, now);
      expect(actions.length).toBe(2);
      expect(actions.map((a) => a.targetId)).toEqual(["20", "21"]);
    });
  });

  describe("MultiNodeCoordinator Simulation (3 Nodes)", () => {
    it("should initialize 3 independent nodes and support concurrent observations and restarts", async () => {
      const coordinator = new MultiNodeCoordinator({
        nodeCount: 3,
        provider: "http://127.0.0.1:8545", // dummy url for unit test
        contractAddresses: {},
        baseDataDir: path.join(TEST_DIR, "cluster"),
        basePort: 19100
      });

      await coordinator.initializeNodes();
      expect(coordinator.nodes.length).toBe(3);

      // Node 1, 2, and 3 observe an event independently
      const eventKey = "421614:0xabc123:1";
      for (const node of coordinator.nodes) {
        node.store.recordEvent(eventKey, { eventName: "SubmissionRegistered" });
      }

      // Check all 3 recorded it without collision
      for (const node of coordinator.nodes) {
        expect(node.store.hasProcessedEvent(eventKey)).toBe(true);
      }

      // Check cluster status report
      const status = coordinator.getClusterStatus();
      expect(status.length).toBe(3);
      expect(status[0].eventsCount).toBe(1);
      expect(status[1].eventsCount).toBe(1);
      expect(status[2].eventsCount).toBe(1);

      // Test restart recovery for Node 2: kill it and create a fresh store on same path
      const node2StorePath = coordinator.nodes[1].store.filePath;
      coordinator.nodes[1].store.saveCheckpoint(8888);

      const restartedNode2Store = new WatchtowerStore(node2StorePath);
      expect(restartedNode2Store.getCheckpoint()).toBe(8888);
      expect(restartedNode2Store.hasProcessedEvent(eventKey)).toBe(true);
    });
  });
});
