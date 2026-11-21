import http from "http";
import { ethers } from "ethers";
import { ABIS } from "../contracts/abis.js";
import { WatchtowerRules, VotingStatus, BountyStatus } from "./WatchtowerRules.js";

/**
 * WatchtowerWorker — Resilient off-chain monitor and automation worker.
 * Connects to EVM RPC, indexes protocol events into local store, checks
 * deadlines, and executes permissionless actions (finalize, settle, refund).
 */
export class WatchtowerWorker {
  /**
   * @param {Object} config
   * @param {string} config.nodeId - Name/identifier of this node
   * @param {ethers.Provider|string} config.provider - Provider instance or RPC URL
   * @param {ethers.Signer|null} [config.signer] - Optional signer for sending txs
   * @param {Object} config.contractAddresses - Address mapping
   * @param {import('./WatchtowerStore.js').WatchtowerStore} config.store - Local store
   * @param {Object} [config.options]
   */
  constructor({
    nodeId = "watchtower-1",
    provider,
    signer = null,
    contractAddresses,
    store,
    options = {}
  }) {
    this.nodeId = nodeId;
    this.provider = typeof provider === "string" ? new ethers.JsonRpcProvider(provider) : provider;
    this.signer = signer ? signer.connect(this.provider) : null;
    this.contractAddresses = contractAddresses;
    this.store = store;

    this.pollIntervalMs = options.pollIntervalMs || 3000;
    this.startBlock = options.startBlock || 0;
    this.confirmBlocks = options.confirmBlocks || 0;
    this.httpPort = options.httpPort || null;
    this.maxBlockBatch = options.maxBlockBatch || 2000;

    this.isRunning = false;
    this.isSyncing = false;
    this.isCrashed = false;
    this.timer = null;
    this.server = null;
    this.startTime = Date.now();
    this.lastSyncTime = null;
    this.chainId = null;

    // Instantiate contract wrappers with provider
    this.contracts = this._initContracts(this.provider);
    // Instantiate contract wrappers with signer (if signer provided)
    this.signerContracts = this.signer ? this._initContracts(this.signer) : null;
  }

  _initContracts(runner) {
    const c = {};
    if (this.contractAddresses.registry) {
      c.registry = new ethers.Contract(this.contractAddresses.registry, ABIS.SubmissionRegistry, runner);
    }
    if (this.contractAddresses.staking) {
      c.staking = new ethers.Contract(this.contractAddresses.staking, ABIS.TokenStaking, runner);
    }
    if (this.contractAddresses.htlc) {
      c.htlc = new ethers.Contract(this.contractAddresses.htlc, ABIS.HTLC, runner);
    }
    if (this.contractAddresses.jurorSelection) {
      c.jurorSelection = new ethers.Contract(this.contractAddresses.jurorSelection, ABIS.JurorSelection, runner);
    }
    if (this.contractAddresses.voting) {
      c.voting = new ethers.Contract(this.contractAddresses.voting, ABIS.SchellingVoting, runner);
    }
    if (this.contractAddresses.arbitratedBounty) {
      c.arbitratedBounty = new ethers.Contract(this.contractAddresses.arbitratedBounty, ABIS.ArbitratedBounty, runner);
    }
    return c;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const net = await this.provider.getNetwork();
      this.chainId = Number(net.chainId);
      this._log("INFO", `Connected to network chainId: ${this.chainId}`);
    } catch (err) {
      this._log("WARN", `Could not get chainId initially: ${err.message}`);
    }

    if (this.httpPort) {
      this._startHttpServer(this.httpPort);
    }

    this._log("INFO", `Watchtower started with checkpoint at block ${this.store.getCheckpoint()}`);

    // Begin polling loop
    const runLoop = async () => {
      if (!this.isRunning) return;
      try {
        await this.syncOnce();
      } catch (err) {
        this._log("WARN", `Sync loop error: ${err.message}`);
      }
      if (this.isRunning) {
        this.timer = setTimeout(runLoop, this.pollIntervalMs);
      }
    };

    runLoop();
  }

  async stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.server) {
      if (typeof this.server.closeAllConnections === "function") {
        this.server.closeAllConnections();
      }
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
    this._log("INFO", "Watchtower stopped cleanly.");
  }

  /**
   * Process a single sync cycle from checkpoint to head.
   */
  async syncOnce() {
    if (this.isSyncing || this.isCrashed) return;
    this.isSyncing = true;

    try {
      const latestBlock = await this.provider.getBlockNumber();
      const targetBlock = Math.max(0, latestBlock - this.confirmBlocks);
      let currentCheckpoint = this.store.getCheckpoint();

      if (currentCheckpoint > 0 && latestBlock < currentCheckpoint) {
        this.store.clear();
        currentCheckpoint = 0;
        this._log("INFO", `Detected chain reset (head block ${latestBlock}). Cleared watchtower state.`);
      }

      let fromBlock = currentCheckpoint > 0 ? currentCheckpoint + 1 : this.startBlock;

      if (fromBlock <= targetBlock) {
        // Process in bounded chunks
        while (fromBlock <= targetBlock && this.isRunning) {
          const toBlock = Math.min(fromBlock + this.maxBlockBatch - 1, targetBlock);
          await this._scanBlockRange(fromBlock, toBlock);
          this.store.saveCheckpoint(toBlock);
          fromBlock = toBlock + 1;
        }
      }

      this.lastSyncTime = new Date().toISOString();

      // After scanning blocks, evaluate rules and take actions
      const block = await this.provider.getBlock("latest");
      const currentTimestamp = block ? block.timestamp : Math.floor(Date.now() / 1000);
      await this._evaluateAndAct(currentTimestamp);
    } finally {
      this.isSyncing = false;
    }
  }

  async _scanBlockRange(fromBlock, toBlock) {
    const contractsToScan = [
      { name: "SubmissionRegistry", contract: this.contracts.registry },
      { name: "ArbitratedBounty", contract: this.contracts.arbitratedBounty },
      { name: "SchellingVoting", contract: this.contracts.voting },
      { name: "JurorSelection", contract: this.contracts.jurorSelection },
      { name: "HTLC", contract: this.contracts.htlc }
    ].filter((item) => Boolean(item.contract));

    for (const { name, contract } of contractsToScan) {
      try {
        const events = await contract.queryFilter("*", fromBlock, toBlock);
        for (const ev of events) {
          await this._handleEvent(name, ev);
        }
      } catch (err) {
        this._log("WARN", `Error querying logs for ${name} (${fromBlock}-${toBlock}): ${err.message}`);
      }
    }
  }

  async _handleEvent(contractName, ev) {
    const chainId = this.chainId || 0;
    const eventKey = `${chainId}:${ev.transactionHash}:${ev.index}`;

    if (this.store.hasProcessedEvent(eventKey)) {
      return; // Deduplicated
    }

    const eventName = ev.fragment ? ev.fragment.name : ev.eventName || "Unknown";
    const args = ev.args || {};

    // Update store according to event type
    if (contractName === "SubmissionRegistry" && eventName === "SubmissionRegistered") {
      this.store.updateSubmission(args.submissionId, {
        submitter: args.submitter,
        ipfsCid: args.ipfsCid,
        merkleRoot: args.merkleRoot,
        timestamp: Number(args.timestamp)
      });
      this._log("INFO", `Observed SubmissionRegistered: ${args.submissionId}`);
    } else if (contractName === "SchellingVoting" && eventName === "DisputeCreated") {
      this.store.updateDispute(args.disputeId, {
        creator: args.creator,
        submissionId: args.submissionId,
        externalRef: Number(args.externalRef),
        status: VotingStatus.CREATED,
        selectionRequestId: Number(args.selectionRequestId),
        createdAt: Math.floor(Date.now() / 1000)
      });
      this._log("INFO", `Observed DisputeCreated: #${args.disputeId}`);
    } else if (contractName === "SchellingVoting" && eventName === "JurorsSelected") {
      this.store.updateDispute(args.disputeId, {
        status: VotingStatus.ACTIVE,
        jurors: args.jurors,
        jurySize: args.jurors ? args.jurors.length : 0,
        commitDeadline: Number(args.commitDeadline),
        revealDeadline: Number(args.revealDeadline)
      });
      this._log("INFO", `Observed JurorsSelected: #${args.disputeId} (${args.jurors?.length} jurors)`);
    } else if (contractName === "SchellingVoting" && eventName === "VoteCommitted") {
      const d = this.store.getDispute(args.disputeId);
      const newCommitted = (d?.committedCount || 0) + 1;
      this.store.updateDispute(args.disputeId, { committedCount: newCommitted });
    } else if (contractName === "SchellingVoting" && eventName === "VoteRevealed") {
      const d = this.store.getDispute(args.disputeId);
      const newRevealed = (d?.revealedCount || 0) + 1;
      this.store.updateDispute(args.disputeId, { revealedCount: newRevealed });
    } else if (contractName === "SchellingVoting" && eventName === "DisputeCancelled") {
      this.store.updateDispute(args.disputeId, { status: VotingStatus.CANCELLED });
      this._log("WARN", `Observed DisputeCancelled: #${args.disputeId}`);
    } else if (contractName === "SchellingVoting" && eventName === "DisputeFinalized") {
      this.store.updateDispute(args.disputeId, {
        status: VotingStatus.FINALIZED,
        outcome: Number(args.outcome)
      });
      this._log("INFO", `Observed DisputeFinalized: #${args.disputeId} Outcome: ${args.outcome}`);
    } else if (contractName === "ArbitratedBounty" && eventName === "BountyFunded") {
      this.store.updateBounty(args.bountyId, {
        submissionId: args.submissionId,
        funder: args.funder,
        whistleblower: args.whistleblower,
        amount: args.amount.toString(),
        lockId: args.lockId,
        timelock: Number(args.timelock),
        status: BountyStatus.FUNDED
      });
      this._log("INFO", `Observed BountyFunded: #${args.bountyId}`);
    } else if (contractName === "ArbitratedBounty" && eventName === "DisputeOpened") {
      this.store.updateBounty(args.bountyId, {
        status: BountyStatus.DISPUTED,
        activeDispute: Number(args.disputeId)
      });
      this._log("INFO", `Observed DisputeOpened on Bounty #${args.bountyId}: Dispute #${args.disputeId}`);
    } else if (contractName === "ArbitratedBounty" && eventName === "BountySettled") {
      this.store.updateBounty(args.bountyId, {
        status: Number(args.newStatus),
        activeDispute: 0
      });
      this._log("INFO", `Observed BountySettled: #${args.bountyId} New Status: ${args.newStatus}`);
    } else if (contractName === "ArbitratedBounty" && eventName === "BountyRefunded") {
      this.store.updateBounty(args.bountyId, {
        status: BountyStatus.REFUNDED
      });
      this._log("INFO", `Observed BountyRefunded: #${args.bountyId}`);
    }

    // Persist event mark
    this.store.recordEvent(eventKey, {
      contractName,
      eventName,
      blockNumber: ev.blockNumber,
      txHash: ev.transactionHash
    });
  }

  async _evaluateAndAct(currentTimestamp) {
    const disputes = this.store.getAllDisputes();
    const bounties = this.store.getAllBounties();

    const disputesMap = {};
    for (const d of disputes) {
      disputesMap[String(d.disputeId)] = d;
    }

    const disputeActions = WatchtowerRules.evaluateDisputes(disputes, currentTimestamp);
    const bountyActions = WatchtowerRules.evaluateBounties(bounties, disputesMap, currentTimestamp);

    const allActions = [...disputeActions, ...bountyActions];

    for (const action of allActions) {
      const actionKey = `${action.type}:${action.targetId}`;
      if (this.store.hasExecutedAction(actionKey)) {
        continue;
      }

      if (!this.signerContracts) {
        // Read-only node: emit informational alert only
        this._log("INFO", `[Read-Only Alert] Action needed: ${action.description}`);
        continue;
      }

      await this._executeActionWithPreflight(action, actionKey);
    }
  }

  async _executeActionWithPreflight(action, actionKey) {
    try {
      if (this.isCrashed) return;

      // If this is Standby Node 2 in a live HTTP cluster, wait 800ms before preflight so Active Node 1
      // executes first when healthy, and Standby Node 2 seamlessly takes over when Node 1 is crashed!
      if (this.nodeId === "watchtower-node-2" && this.httpPort) {
        await new Promise((r) => setTimeout(r, 800));
        if (this.isCrashed) return;
      }

      // 1. On-chain preflight check to ensure action is still valid and not already executed
      if (action.type === "FINALIZE_DISPUTE") {
        const res = await this.contracts.voting.resultOf(action.targetId);
        // res.status: 3 = FINALIZED, 4 = CANCELLED
        if (Number(res[0]) === VotingStatus.FINALIZED || Number(res[0]) === VotingStatus.CANCELLED) {
          this.store.recordAction(actionKey, { skipped: true, reason: "Already resolved on-chain" });
          this._log(
            "INFO",
            `[Preflight Check] ${action.type} (#${action.targetId}) already executed on-chain by peer watchtower. Safely skipped duplicate tx.`
          );
          return;
        }
      } else if (action.type === "CANCEL_TIMEOUT_DISPUTE") {
        const res = await this.contracts.voting.resultOf(action.targetId);
        if (Number(res[0]) !== VotingStatus.CREATED) {
          this.store.recordAction(actionKey, { skipped: true, reason: "No longer in CREATED status" });
          return;
        }
      } else if (action.type === "SETTLE_BOUNTY") {
        const b = await this.contracts.arbitratedBounty.getBounty(action.targetId);
        if (Number(b.status) !== BountyStatus.DISPUTED) {
          this.store.recordAction(actionKey, { skipped: true, reason: "Bounty is no longer DISPUTED" });
          this._log(
            "INFO",
            `[Preflight Check] ${action.type} (#${action.targetId}) already settled on-chain by peer watchtower. Safely skipped duplicate tx.`
          );
          return;
        }
      } else if (action.type === "REFUND_BOUNTY") {
        const b = await this.contracts.arbitratedBounty.getBounty(action.targetId);
        if (Number(b.status) !== BountyStatus.FUNDED && Number(b.status) !== BountyStatus.REJECTED) {
          this.store.recordAction(actionKey, { skipped: true, reason: "Bounty not eligible for refund" });
          return;
        }
      }

      // 2. Submit on-chain transaction
      const roleTag = this.nodeId === "watchtower-node-2" ? " [STANDBY FAILOVER]" : "";
      this._log(
        "ACTION",
        `Executing ${action.type}${roleTag} -> ${action.contractName}.${action.method}(${action.args.join(", ")})`
      );

      const targetContract =
        action.contractName === "SchellingVoting"
          ? this.signerContracts.voting
          : this.signerContracts.arbitratedBounty;

      const tx = await targetContract[action.method](...action.args);
      const receipt = await tx.wait(1);

      this.store.recordAction(actionKey, {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        type: action.type,
        targetId: action.targetId
      });

      this._log("INFO", `Successfully executed ${action.type}! TX: ${receipt.hash}`);
    } catch (err) {
      this._log("ERROR", `Failed to execute ${action.type}: ${err.message}`);
    }
  }

  _log(level, message, details = {}) {
    const alert = this.store.addAlert(level, `[${this.nodeId}] ${message}`, details);
    console.log(`[${new Date().toISOString()}][${this.nodeId}][${level}] ${message}`);
    return alert;
  }

  _startHttpServer(port) {
    this.server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === "/health") {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: this.isCrashed ? "crashed" : "ok",
            crashed: this.isCrashed,
            nodeId: this.nodeId,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            checkpoint: this.store.getCheckpoint(),
            isSyncing: this.isSyncing,
            lastSyncTime: this.isCrashed ? "CRASHED / OFFLINE" : this.lastSyncTime
          })
        );
      } else if (req.url === "/status") {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            nodeId: this.nodeId,
            crashed: this.isCrashed,
            chainId: this.chainId,
            checkpoint: this.store.getCheckpoint(),
            disputes: this.store.getAllDisputes().length,
            bounties: this.store.getAllBounties().length,
            lastSyncTime: this.isCrashed ? "CRASHED / OFFLINE" : this.lastSyncTime
          })
        );
      } else if (req.url === "/alerts") {
        res.writeHead(200);
        res.end(JSON.stringify(this.store.getAlerts(50)));
      } else if (req.url === "/simulate-crash") {
        this.isCrashed = true;
        this._log(
          "ERROR",
          `💥 SIMULATED NODE CRASH: ${this.nodeId} halted at block checkpoint ${this.store.getCheckpoint()}! Standby watchtowers must take over.`
        );
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, crashed: true, checkpoint: this.store.getCheckpoint() }));
      } else if (req.url === "/simulate-recover") {
        const savedCheckpoint = this.store.getCheckpoint();
        this.isCrashed = false;
        this._log(
          "INFO",
          `🔄 NODE RECOVERED FROM CRASH: ${this.nodeId} resuming block scan from persisted atomic checkpoint #${savedCheckpoint}...`
        );
        this.syncOnce().catch(() => {});
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, crashed: false, checkpoint: savedCheckpoint }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      }
    });

    this.server.on("error", (err) => {
      this._log("WARN", `HTTP server error on port ${port}: ${err.message}`);
    });

    this.server.listen(port, "127.0.0.1", () => {
      this._log("INFO", `Health monitoring HTTP server listening on http://127.0.0.1:${port}`);
    });
  }
}
