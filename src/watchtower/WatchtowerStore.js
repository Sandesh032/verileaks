import fs from "fs";
import path from "path";

/**
 * WatchtowerStore — Durable, atomic local JSON store for a watchtower node.
 * Uses atomic file replacement (write temp + rename) to guarantee persistence
 * even across sudden crashes or power failures.
 */
export class WatchtowerStore {
  /**
   * @param {string} storageFilePath - Absolute or relative path to JSON file
   */
  constructor(storageFilePath) {
    this.filePath = storageFilePath;
    this.dir = path.dirname(storageFilePath);
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    this.state = this._loadInitialState();
  }

  _loadInitialState() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf8");
        return JSON.parse(raw);
      } catch (err) {
        console.warn(`[WatchtowerStore] Corrupt store at ${this.filePath}, resetting: ${err.message}`);
      }
    }
    return {
      checkpoint: {
        lastProcessedBlock: 0,
        updatedAt: new Date().toISOString()
      },
      processedEvents: {},
      executedActions: {},
      disputes: {},
      bounties: {},
      submissions: {},
      alerts: []
    };
  }

  _persist() {
    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    const data = JSON.stringify(this.state, null, 2);
    fs.writeFileSync(tempPath, data, "utf8");
    fs.renameSync(tempPath, this.filePath);
  }

  getCheckpoint() {
    return this.state.checkpoint.lastProcessedBlock || 0;
  }

  saveCheckpoint(blockNumber) {
    this.state.checkpoint = {
      lastProcessedBlock: blockNumber,
      updatedAt: new Date().toISOString()
    };
    this._persist();
  }

  hasProcessedEvent(eventKey) {
    return Boolean(this.state.processedEvents[eventKey]);
  }

  recordEvent(eventKey, meta = {}) {
    this.state.processedEvents[eventKey] = {
      ...meta,
      recordedAt: new Date().toISOString()
    };
    this._persist();
  }

  hasExecutedAction(actionKey) {
    return Boolean(this.state.executedActions[actionKey]);
  }

  recordAction(actionKey, meta = {}) {
    this.state.executedActions[actionKey] = {
      ...meta,
      executedAt: new Date().toISOString()
    };
    this._persist();
  }

  updateDispute(disputeId, data) {
    const id = String(disputeId);
    this.state.disputes[id] = {
      ...(this.state.disputes[id] || {}),
      ...data,
      disputeId: id,
      updatedAt: new Date().toISOString()
    };
    this._persist();
  }

  getDispute(disputeId) {
    return this.state.disputes[String(disputeId)];
  }

  getAllDisputes() {
    return Object.values(this.state.disputes);
  }

  updateBounty(bountyId, data) {
    const id = String(bountyId);
    this.state.bounties[id] = {
      ...(this.state.bounties[id] || {}),
      ...data,
      bountyId: id,
      updatedAt: new Date().toISOString()
    };
    this._persist();
  }

  getBounty(bountyId) {
    return this.state.bounties[String(bountyId)];
  }

  getAllBounties() {
    return Object.values(this.state.bounties);
  }

  updateSubmission(submissionId, data) {
    this.state.submissions[submissionId] = {
      ...(this.state.submissions[submissionId] || {}),
      ...data,
      submissionId,
      updatedAt: new Date().toISOString()
    };
    this._persist();
  }

  addAlert(level, message, details = {}) {
    const alert = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      level, // 'INFO' | 'WARN' | 'ACTION' | 'ERROR'
      message,
      details,
      timestamp: new Date().toISOString()
    };
    this.state.alerts.unshift(alert);
    // Keep last 100 alerts
    if (this.state.alerts.length > 100) {
      this.state.alerts.pop();
    }
    this._persist();
    return alert;
  }

  getAlerts(limit = 50) {
    return this.state.alerts.slice(0, limit);
  }

  clear() {
    this.state = {
      checkpoint: { lastProcessedBlock: 0, updatedAt: new Date().toISOString() },
      processedEvents: {},
      executedActions: {},
      disputes: {},
      bounties: {},
      submissions: {},
      alerts: []
    };
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }
}
