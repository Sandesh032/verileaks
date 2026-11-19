import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ABIS } from "../contracts/abis.js";

const STATUS_MAP = [
  "NONE",
  "OPEN & FUNDED (Awaiting / Reviewing Evidence)",
  "DISPUTED (Under Jury Arbitration)",
  "RELEASED (Paid to Whistleblower)",
  "REJECTED (Evidence Ruled Fake)",
  "REFUNDED (Returned to Funder)"
];
const BADGE_MAP = ["", "badge-info", "badge-warning", "badge-success", "badge-danger", "badge-danger"];

const ZERO_BYTES32 = "0x" + "00".repeat(32);
const DEFAULT_WHISTLEBLOWER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export function BountyTab({
  signer,
  provider,
  contractAddresses,
  currentAccount,
  currentRoleLabel,
  selectedWalletId,
  onSwitchRole,
  activeBountyId,
  setActiveBountyId,
  onDisputeCreated,
  onGoToArbitration,
  onGoToSubmit,
  onBalanceChange,
  onAlert
}) {
  const [caseTitle, setCaseTitle] = useState(
    "Case #2026-A: Off-Ledger Reserve Manipulation & Audit Fraud"
  );
  const [amount, setAmount] = useState("1.5");
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);

  const [lookupId, setLookupId] = useState(activeBountyId || "1");
  const [bountyData, setBountyData] = useState(null);
  const [pendingPayout, setPendingPayout] = useState("0");
  const [knownBounties, setKnownBounties] = useState([]);

  // Strict Role Checks
  const isFunder = selectedWalletId === "funder";
  const isWatchtower = selectedWalletId === "watchtower";

  const loadStateSummary = useCallback(async () => {
    if (!provider) return [];
    try {
      const summary = await provider.send("verileaks_getStateSummary", []);
      if (summary?.bounties) {
        setKnownBounties(summary.bounties);
        return summary.bounties;
      }
    } catch (_) {}
    return [];
  }, [provider]);

  const loadPendingPayout = useCallback(async () => {
    if (!currentAccount || !provider || !contractAddresses.arbitratedBounty) return;
    try {
      const contract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        provider
      );
      const pending = await contract.pendingPayout(currentAccount);
      setPendingPayout(ethers.formatEther(pending));
    } catch (err) {
      console.warn("Could not load pending payout:", err);
    }
  }, [currentAccount, provider, contractAddresses.arbitratedBounty]);

  const fetchBounty = useCallback(
    async (idToFetch, silent = false) => {
      if (!provider || !contractAddresses.arbitratedBounty) return;
      try {
        const summaryBounties = await loadStateSummary();
        const meta = summaryBounties.find((x) => String(x.bountyId) === String(idToFetch));

        const contract = new ethers.Contract(
          contractAddresses.arbitratedBounty,
          ABIS.ArbitratedBounty,
          provider
        );
        const b = await contract.getBounty(idToFetch);
        if (Number(b.status) === 0) {
          setBountyData(null);
          if (!silent) {
            onAlert(
              `Bounty #${idToFetch} has not been funded yet. Use the form on the left as Bounty Funder to create Bounty #${idToFetch}!`,
              "info"
            );
          }
          return;
        }
        setBountyData({
          bountyId: String(idToFetch),
          caseTitle: meta?.caseTitle || `Case #${idToFetch}: Confidential Whistleblower Inquiry`,
          hasEvidence: Boolean(meta?.hasEvidence),
          submissionId: meta?.submissionId || b.submissionId,
          funder: b.funder,
          whistleblower: meta?.whistleblower || b.whistleblower,
          amount: ethers.formatEther(b.amount),
          lockId: b.lockId,
          timelock: new Date(Number(b.timelock) * 1000).toLocaleString(),
          statusNum: Number(b.status),
          statusText: STATUS_MAP[Number(b.status)] || "UNKNOWN",
          activeDispute: Number(b.activeDispute)
        });
      } catch (err) {
        if (!silent) {
          onAlert(`Could not find Bounty #${idToFetch}: ${err.message}`, "error");
        }
        setBountyData(null);
      }
    },
    [provider, contractAddresses.arbitratedBounty, loadStateSummary, onAlert]
  );

  useEffect(() => {
    loadPendingPayout();
    fetchBounty(lookupId, true);
  }, [loadPendingPayout, fetchBounty, lookupId, currentAccount]);

  const handleFundBounty = async (e) => {
    e.preventDefault();
    if (!isFunder) {
      onAlert("Role Restricted: Only the Bounty Funder role can deposit escrow funds.", "error");
      return;
    }
    if (!signer) {
      onAlert("Please select a wallet first.", "error");
      return;
    }
    try {
      setLoading(true);
      const contract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        signer
      );

      const block = await provider.getBlock("latest");
      const currentTs = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
      const timelock = currentTs + Math.max(3, Number(days)) * 86400;

      // Placeholder case hash until a whistleblower submits evidence to claim this bounty
      const casePlaceholderHash = ethers.keccak256(
        ethers.toUtf8Bytes(caseTitle + ":" + Date.now())
      );

      const tx = await contract.fundBounty(
        casePlaceholderHash,
        DEFAULT_WHISTLEBLOWER,
        timelock,
        {
          value: ethers.parseEther(amount)
        }
      );
      const receipt = await tx.wait(1);

      let createdBountyId = "1";
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === "BountyFunded") {
            createdBountyId = String(parsed.args.bountyId);
            break;
          }
        } catch (_) {}
      }

      await provider.send("verileaks_setBountyTitle", [Number(createdBountyId), caseTitle]);

      setLookupId(createdBountyId);
      if (setActiveBountyId) setActiveBountyId(createdBountyId);
      await fetchBounty(createdBountyId, true);
      if (onBalanceChange) onBalanceChange();

      onAlert(
        `Open Bounty #${createdBountyId} (${amount} ETH) funded in HTLC escrow! Now a Whistleblower can see this reward and submit evidence for it.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      onAlert(err.message || "Failed to fund bounty", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispute = async (bId) => {
    if (!isFunder) {
      onAlert(
        "Role Restricted: Only the Bounty Funder can initiate arbitration on submitted evidence.",
        "error"
      );
      return;
    }
    if (!bountyData?.hasEvidence) {
      onAlert(
        "No evidence has been submitted for this bounty yet! Switch to 🕵️ Whistleblower and submit evidence in Tab 2 first.",
        "error"
      );
      return;
    }
    try {
      setLoading(true);
      const contract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        signer
      );

      const proof = {
        merkleTreeDepth: 20n,
        merkleTreeRoot: 1n,
        nullifier: BigInt(Date.now()),
        message: BigInt(bId),
        scope: BigInt(bId),
        points: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]
      };

      const tx = await contract.openDispute(bId, proof);
      const receipt = await tx.wait(1);

      let createdDisputeId = 1;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === "DisputeOpened") {
            createdDisputeId = Number(parsed.args.disputeId);
            break;
          }
        } catch (_) {}
      }

      await fetchBounty(bId, true);
      if (onDisputeCreated) onDisputeCreated(createdDisputeId);

      onAlert(
        `Dispute #${createdDisputeId} opened! Chainlink VRF selected 3 Jurors and locked 1.0 ETH stake from each juror.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      onAlert(err.message || "Failed to open dispute", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!signer) return;
    try {
      setLoading(true);
      const contract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        signer
      );
      const tx = await contract.withdraw();
      await tx.wait(1);
      onAlert(
        `Successfully withdrew ${pendingPayout} ETH payout to ${currentRoleLabel} wallet!`,
        "success"
      );
      await loadPendingPayout();
      if (onBalanceChange) onBalanceChange();
    } catch (err) {
      onAlert(err.message || "Withdrawal failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (id) => {
    if (!isWatchtower) {
      onAlert(
        "Role Restricted: Only the Watchtower Executor can execute a time-locked refund after a REJECTED (FAKE) verdict!",
        "error"
      );
      return;
    }
    if (!signer) return;
    try {
      setLoading(true);
      const contract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        signer
      );
      const tx = await contract.refund(id);
      await tx.wait(1);
      onAlert(
        `Watchtower executed time-locked refund for rejected Bounty #${id}! Funds credited to Funder's pending payout.`,
        "success"
      );
      await loadPendingPayout();
      await fetchBounty(id, true);
      if (onBalanceChange) onBalanceChange();
    } catch (err) {
      onAlert(err.message || "Refund failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {Number(pendingPayout) > 0 && (
        <div
          className="glass-panel"
          style={{
            marginBottom: "24px",
            borderColor: "var(--success)",
            background: "rgba(16, 185, 129, 0.08)"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px"
            }}
          >
            <div>
              <h3 style={{ color: "var(--success)" }}>
                🎉 Unclaimed Bounty Payout Available ({currentRoleLabel})
              </h3>
              <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                You have <strong>{pendingPayout} ETH</strong> credited in{" "}
                <code>ArbitratedBounty.sol</code> pull-payment escrow.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleWithdraw} disabled={loading}>
              {loading ? "Withdrawing..." : `Withdraw ${pendingPayout} ETH to Wallet`}
            </button>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Left: Post & Fund Open Bounty Form (Step 1 in Real-World Flow) */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "10px" }}>Step 1: Post & Fund an Open Bounty</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "16px", fontSize: "0.9rem" }}>
            Funder locks ETH in <code>HTLC.sol</code> escrow for a specific investigation case{" "}
            <strong>first</strong>. Whistleblowers can inspect the locked reward before deciding to
            submit confidential evidence.
          </p>

          {!isFunder && (
            <div
              className="notice-card"
              style={{
                borderColor: "var(--danger)",
                background: "rgba(239, 68, 68, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px"
              }}
            >
              <div>
                <strong style={{ color: "var(--danger)" }}>
                  🔒 Role Restricted (Current: {currentRoleLabel})
                </strong>
                <div style={{ fontSize: "0.84rem", marginTop: "4px" }}>
                  Only the <strong>🏦 Bounty Funder</strong> role can post and fund a new bounty
                  escrow.
                </div>
              </div>
              {onSwitchRole && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                  onClick={() => onSwitchRole("funder")}
                >
                  Switch to 🏦 Bounty Funder
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleFundBounty}>
            <div className="form-group">
              <label className="form-label">Investigation Case / Bounty Description</label>
              <input
                className="form-input"
                placeholder="e.g., Case #2026-A: Proof of Off-Ledger Transfers..."
                required
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                disabled={!isFunder}
              />
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Bounty Reward Amount (ETH)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="form-input"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={!isFunder}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">HTLC Timelock Window (Days)</label>
                <input
                  type="number"
                  min="3"
                  className="form-input"
                  required
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  disabled={!isFunder}
                />
              </div>
            </div>

            <div className="notice-card" style={{ fontSize: "0.83rem" }}>
              <strong>How Whistleblower Incentive Works:</strong> Once you deposit{" "}
              <strong>{amount} ETH</strong> into escrow, any anonymous Whistleblower can see that
              the funds are cryptographically locked on-chain and submit their evidence in{" "}
              <strong>2. Submit Evidence</strong> to claim it.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "13px" }}
              disabled={loading || !isFunder}
            >
              {!isFunder
                ? "🔒 Disabled — Switch to Bounty Funder Role to Deposit Escrow"
                : loading
                ? "Confirming Transaction..."
                : `Lock ${amount} ETH Bounty in HTLC Escrow`}
            </button>
          </form>
        </div>

        {/* Right: Lookup & Challenge Bounty Card */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "10px" }}>Inspect & Verify Bounty Escrow</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginBottom: "12px" }}>
            Inspect open bounties, check whether a Whistleblower has attached evidence, and trigger
            VRF Jury Arbitration.
          </p>

          {knownBounties.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
              {knownBounties.map((kb) => (
                <button
                  key={kb.bountyId}
                  type="button"
                  className={
                    String(lookupId) === String(kb.bountyId) ? "btn btn-primary" : "btn btn-outline"
                  }
                  style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                  onClick={() => {
                    setLookupId(String(kb.bountyId));
                    fetchBounty(kb.bountyId, false);
                  }}
                >
                  Bounty #{kb.bountyId} ({kb.amountEth} ETH —{" "}
                  {kb.status === 1
                    ? kb.hasEvidence
                      ? "EVIDENCE SUBMITTED"
                      : "OPEN FOR EVIDENCE"
                    : kb.status === 2
                    ? "DISPUTED"
                    : kb.status === 3
                    ? "RELEASED"
                    : kb.status === 4
                    ? "REJECTED"
                    : "REFUNDED"}
                  )
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="number"
              min="1"
              className="form-input"
              style={{ width: "120px" }}
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <button className="btn btn-outline" onClick={() => fetchBounty(lookupId, false)}>
              Lookup Bounty
            </button>
          </div>

          {bountyData ? (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                  flexWrap: "wrap",
                  gap: "8px"
                }}
              >
                <h3>Bounty #{bountyData.bountyId}</h3>
                <span className={`badge ${BADGE_MAP[bountyData.statusNum]}`}>
                  {bountyData.statusNum === 1
                    ? bountyData.hasEvidence
                      ? "EVIDENCE SUBMITTED (Ready for Arbitration)"
                      : "OPEN BOUNTY (Awaiting Whistleblower Evidence)"
                    : bountyData.statusText}
                </span>
              </div>

              <div
                style={{
                  fontSize: "0.9rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(10, 14, 23, 0.5)",
                  border: "1px solid var(--border-color)"
                }}
              >
                <div>
                  <strong>Case Title:</strong>{" "}
                  <span style={{ color: "#fff" }}>{bountyData.caseTitle}</span>
                </div>
                <div>
                  <strong>Escrowed Reward:</strong>{" "}
                  <span style={{ color: "var(--success)", fontWeight: 700, fontSize: "1.05rem" }}>
                    {bountyData.amount} ETH
                  </span>
                </div>
                <div>
                  <strong>Funder:</strong> <code className="mono">{bountyData.funder}</code>
                </div>
                <div>
                  <strong>Evidence Status:</strong>{" "}
                  {bountyData.hasEvidence ? (
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                      ✅ Submitted by Whistleblower ({bountyData.whistleblower.substring(0, 8)}...)
                    </span>
                  ) : (
                    <span style={{ color: "var(--warning)" }}>
                      ⏳ Waiting for Whistleblower to submit evidence
                    </span>
                  )}
                </div>
                {bountyData.hasEvidence && (
                  <div>
                    <strong>Anchored Submission ID:</strong>{" "}
                    <code className="mono">{bountyData.submissionId.substring(0, 26)}...</code>
                  </div>
                )}
                <div>
                  <strong>HTLC Lock ID:</strong>{" "}
                  <code className="mono">{bountyData.lockId.substring(0, 22)}...</code>
                </div>
                <div>
                  <strong>Timelock Expiration:</strong> {bountyData.timelock}
                </div>
                {bountyData.activeDispute > 0 && (
                  <div style={{ color: "var(--warning)", fontWeight: 600 }}>
                    <strong>Active Schelling Dispute:</strong> Dispute #{bountyData.activeDispute}
                  </div>
                )}
              </div>

              {/* Role-Gated Action Buttons based on Bounty Status */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "18px" }}>
                {/* When Bounty is OPEN & awaiting evidence */}
                {bountyData.statusNum === 1 && !bountyData.hasEvidence && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "12px" }}
                    onClick={() => onGoToSubmit && onGoToSubmit(bountyData.bountyId)}
                  >
                    🕵️ Step 2: Go to Submit Evidence for Bounty #{bountyData.bountyId} ({bountyData.amount} ETH) →
                  </button>
                )}

                {/* When Whistleblower has submitted evidence -> Funder triggers VRF Jury Verification */}
                {bountyData.statusNum === 1 && bountyData.hasEvidence && (
                  <>
                    {!isFunder && (
                      <div
                        className="notice-card"
                        style={{
                          marginBottom: 0,
                          borderColor: "var(--accent-cyan)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        <span style={{ fontSize: "0.82rem" }}>
                          Evidence is anchored! Switch to <strong>🏦 Bounty Funder</strong> to
                          request VRF Jury Verification.
                        </span>
                        {onSwitchRole && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                            onClick={() => onSwitchRole("funder")}
                          >
                            Switch to 🏦 Funder
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "12px" }}
                      onClick={() => handleOpenDispute(bountyData.bountyId)}
                      disabled={loading || !isFunder}
                    >
                      {!isFunder
                        ? "🔒 Disabled — Switch to Bounty Funder to Request VRF Jury Arbitration"
                        : loading
                        ? "Opening Dispute..."
                        : "⚡ Step 3: Challenge / Verify Evidence via Chainlink VRF Jury (Locks 1 ETH/Juror)"}
                    </button>
                  </>
                )}

                {bountyData.statusNum === 1 && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border-color)",
                      fontSize: "0.82rem",
                      color: "var(--text-muted)"
                    }}
                  >
                    🔒 <strong>HTLC Escrow Lock Active:</strong> The Bounty Funder cannot
                    unilaterally pull back escrowed ETH while the bounty is active. Refunds only
                    unlock if Schelling Arbitration rules the evidence <code>FAKE (REJECTED)</code>{" "}
                    and are executed by the <strong>🛡️ Watchtower Executor</strong>.
                  </div>
                )}

                {/* Go to Arbitration (When DISPUTED) */}
                {bountyData.statusNum === 2 && bountyData.activeDispute > 0 && onGoToArbitration && (
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "12px" }}
                    onClick={() => onGoToArbitration(bountyData.activeDispute)}
                  >
                    ⚖️ Go to Arbitration & Juror Voting (Dispute #{bountyData.activeDispute}) →
                  </button>
                )}

                {/* Released to Whistleblower */}
                {bountyData.statusNum === 3 && (
                  <div
                    className="notice-card"
                    style={{
                      marginBottom: 0,
                      borderColor: "var(--success)",
                      color: "var(--success)"
                    }}
                  >
                    ✅ <strong>Bounty Released to Whistleblower!</strong> Switch to the{" "}
                    <strong>🕵️ Whistleblower</strong> role in the top bar to withdraw the{" "}
                    {bountyData.amount} ETH payout.
                  </div>
                )}

                {/* Rejected (Ruled FAKE) -> Automatically Refunded to Funder by Watchtower */}
                {bountyData.statusNum === 4 && (
                  <div
                    className="notice-card"
                    style={{
                      marginBottom: 0,
                      borderColor: "var(--danger)",
                      color: "#e2e8f0"
                    }}
                  >
                    ❌ <strong>Evidence Ruled FAKE by Jury:</strong> Watchtower Node 1 has
                    automatically settled this bounty and credited the{" "}
                    <strong>{bountyData.amount} ETH</strong> refund back to the{" "}
                    <strong>🏦 Bounty Funder</strong>'s pull-payment balance above.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
              No bounty funded yet at ID #{lookupId}. Switch to <strong>🏦 Bounty Funder</strong>{" "}
              and use the form on the left to post & fund <strong>Bounty #{lookupId}</strong>!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
