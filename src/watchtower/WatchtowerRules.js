/**
 * WatchtowerRules.js — Pure rule evaluation logic for protocol state monitoring.
 * Maps contract states and time conditions to actionable triggers or alerts.
 */

export const VotingStatus = {
  NONE: 0,
  CREATED: 1,
  ACTIVE: 2,
  FINALIZED: 3,
  CANCELLED: 4
};

export const BountyStatus = {
  NONE: 0,
  FUNDED: 1,
  DISPUTED: 2,
  RELEASED: 3,
  REJECTED: 4,
  REFUNDED: 5
};

export class WatchtowerRules {
  /**
   * Evaluate all tracked disputes and return actionable decisions.
   * @param {Array<Object>} disputes - Tracked disputes from store
   * @param {number} currentTimestamp - Current block timestamp in seconds
   * @returns {Array<{ type: string, targetId: string, description: string }>}
   */
  static evaluateDisputes(disputes, currentTimestamp) {
    const actions = [];

    for (const d of disputes) {
      const now = Number(currentTimestamp);
      const commitDeadline = Number(d.commitDeadline || 0);
      const revealDeadline = Number(d.revealDeadline || 0);
      const createdAt = Number(d.createdAt || 0);
      const selectionTimeout = Number(d.selectionTimeout || 3600);
      const status = Number(d.status ?? VotingStatus.NONE);
      const revealedCount = Number(d.revealedCount || 0);
      const jurySize = Number(d.jurySize || 0);

      // Rule 1: Finalize dispute if reveal period passed or all jurors revealed
      if (status === VotingStatus.ACTIVE) {
        const revealOver = now >= revealDeadline;
        const allRevealed = jurySize > 0 && revealedCount >= jurySize;

        if (revealOver || allRevealed) {
          actions.push({
            type: "FINALIZE_DISPUTE",
            targetId: String(d.disputeId),
            contractName: "SchellingVoting",
            method: "finalize",
            args: [d.disputeId],
            description: `Dispute #${d.disputeId} ready for finalization (${allRevealed ? "all jurors revealed" : "reveal deadline elapsed"}).`
          });
        }
      }

      // Rule 2: Cancel dispute if selection timed out in CREATED state
      if (status === VotingStatus.CREATED) {
        if (now >= createdAt + selectionTimeout) {
          actions.push({
            type: "CANCEL_TIMEOUT_DISPUTE",
            targetId: String(d.disputeId),
            contractName: "SchellingVoting",
            method: "cancelDispute",
            args: [d.disputeId],
            description: `Dispute #${d.disputeId} VRF selection timed out (${now - createdAt}s >= ${selectionTimeout}s).`
          });
        }
      }
    }

    return actions;
  }

  /**
   * Evaluate all tracked bounties and return actionable decisions.
   * @param {Array<Object>} bounties - Tracked bounties from store
   * @param {Object} disputesMap - Lookup map of disputeId => dispute
   * @param {number} currentTimestamp - Current block timestamp in seconds
   * @returns {Array<{ type: string, targetId: string, description: string }>}
   */
  static evaluateBounties(bounties, disputesMap, currentTimestamp) {
    const actions = [];

    for (const b of bounties) {
      const now = Number(currentTimestamp);
      const timelock = Number(b.timelock || 0);
      const status = Number(b.status ?? BountyStatus.NONE);
      const activeDisputeId = b.activeDispute ? String(b.activeDispute) : null;

      // Rule 3: Settle bounty if active dispute finalized or cancelled
      if (status === BountyStatus.DISPUTED && activeDisputeId && activeDisputeId !== "0") {
        const dispute = disputesMap[activeDisputeId];
        if (dispute) {
          const dStatus = Number(dispute.status);
          if (dStatus === VotingStatus.FINALIZED || dStatus === VotingStatus.CANCELLED) {
            actions.push({
              type: "SETTLE_BOUNTY",
              targetId: String(b.bountyId),
              contractName: "ArbitratedBounty",
              method: "settle",
              args: [b.bountyId],
              description: `Bounty #${b.bountyId} ready to settle (Dispute #${activeDisputeId} is ${dStatus === VotingStatus.FINALIZED ? "FINALIZED" : "CANCELLED"}).`
            });
          }
        }
      }

      // Rule 4: Refund bounty if timelock expired and status is FUNDED or REJECTED
      if (status === BountyStatus.FUNDED || status === BountyStatus.REJECTED) {
        if (now > timelock) {
          actions.push({
            type: "REFUND_BOUNTY",
            targetId: String(b.bountyId),
            contractName: "ArbitratedBounty",
            method: "refund",
            args: [b.bountyId],
            description: `Bounty #${b.bountyId} expired at ${timelock} (current: ${now}). Ready for refund.`
          });
        }
      }
    }

    return actions;
  }
}
