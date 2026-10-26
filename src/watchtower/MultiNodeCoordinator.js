import path from "path";
import { WatchtowerStore } from "./WatchtowerStore.js";
import { WatchtowerWorker } from "./WatchtowerWorker.js";

/**
 * MultiNodeCoordinator — Orchestrates a cluster of independent watchtower nodes.
 * Used for reproducible local testing and multi-node simulations.
 */
export class MultiNodeCoordinator {
  /**
   * @param {Object} config
   * @param {number} [config.nodeCount=3] - Number of independent nodes to instantiate
   * @param {string|ethers.Provider} config.provider - Provider or RPC URL
   * @param {Array<ethers.Signer>} [config.signers] - Array of signers for active nodes
   * @param {Object} config.contractAddresses - Deployed contract address mapping
   * @param {string} [config.baseDataDir] - Directory where node stores are persisted
   * @param {number} [config.basePort=9100] - Base port for HTTP health APIs
   */
  constructor({
    nodeCount = 3,
    provider,
    signers = [],
    contractAddresses,
    baseDataDir = ".data/watchtowers",
    basePort = 9100
  }) {
    this.nodeCount = nodeCount;
    this.provider = provider;
    this.signers = signers;
    this.contractAddresses = contractAddresses;
    this.baseDataDir = baseDataDir;
    this.basePort = basePort;
    this.nodes = [];
  }

  async initializeNodes() {
    this.nodes = [];

    for (let i = 1; i <= this.nodeCount; i++) {
      const nodeId = `watchtower-node-${i}`;
      const storePath = path.join(this.baseDataDir, `${nodeId}.json`);
      const store = new WatchtowerStore(storePath);
      const signer = this.signers[i - 1] || null;
      const httpPort = this.basePort + i;

      const worker = new WatchtowerWorker({
        nodeId,
        provider: this.provider,
        signer,
        contractAddresses: this.contractAddresses,
        store,
        options: {
          pollIntervalMs: 1000,
          httpPort,
          confirmBlocks: 0
        }
      });

      this.nodes.push({ nodeId, worker, store, httpPort });
    }
  }

  async startAll() {
    for (const node of this.nodes) {
      await node.worker.start();
    }
  }

  async stopAll() {
    for (const node of this.nodes) {
      await node.worker.stop();
    }
  }

  async syncAllOnce() {
    for (const node of this.nodes) {
      await node.worker.syncOnce();
    }
  }

  getNode(nodeId) {
    return this.nodes.find((n) => n.nodeId === nodeId);
  }

  getClusterStatus() {
    return this.nodes.map((n) => ({
      nodeId: n.nodeId,
      checkpoint: n.store.getCheckpoint(),
      eventsCount: Object.keys(n.store.state.processedEvents).length,
      actionsCount: Object.keys(n.store.state.executedActions).length,
      alertsCount: n.store.state.alerts.length
    }));
  }

  clearAllStores() {
    for (const node of this.nodes) {
      node.store.clear();
    }
  }
}
