import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ABIS } from "../contracts/abis.js";

const STATUS_MAP = ["NONE", "FUNDED", "DISPUTED", "RELEASED", "REJECTED", "REFUNDED"];
const BADGE_MAP = ["", "badge-info", "badge-warning", "badge-success", "badge-danger", "badge-danger"];

export function BountyTab({ signer, provider, contractAddresses, currentAccount, onAlert }) {
  const [submissionId, setSubmissionId] = useState("");
  const [whistleblower, setWhistleblower] = useState("");
  const [amount, setAmount] = useState("0.5");
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);

  const [lookupId, setLookupId] = useState("1");
  const [bountyData, setBountyData] = useState(null);
  const [pendingPayout, setPendingPayout] = useState("0");

  const loadPendingPayout = async () => {
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
  };

  useEffect(() => {
    loadPendingPayout();
  }, [currentAccount, provider, contractAddresses.arbitratedBounty]);

  const handleFundBounty = async (e) => {
    e.preventDefault();
    if (!signer) {
      onAlert("Please connect your wallet first.", "error");
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
      const currentTs = block ? block.timestamp : Math.floor(Date.now() / 1000);
      const timelock = currentTs + Math.max(3, Number(days)) * 86400;

      const tx = await contract.fundBounty(submissionId, whistleblower, timelock, {
        value: ethers.parseEther(amount)
      });
      const receipt = await tx.wait(1);

      onAlert(`Bounty successfully funded in escrow! (Tx: ${receipt.hash.substring(0, 10)}...)`, "success");
      setSubmissionId("");
    } catch (err) {
      console.error(err);
      onAlert(err.message || "Failed to fund bounty", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    if (!provider || !contractAddresses.arbitratedBounty) return;
    try {
      const contract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        provider
      );
      const b = await contract.getBounty(lookupId);
      setBountyData({
        bountyId: lookupId,
        submissionId: b.submissionId,
        funder: b.funder,
        whistleblower: b.whistleblower,
        amount: ethers.formatEther(b.amount),
        lockId: b.lockId,
        timelock: new Date(Number(b.timelock) * 1000).toLocaleString(),
        statusNum: Number(b.status),
        statusText: STATUS_MAP[Number(b.status)] || "UNKNOWN",
        activeDispute: Number(b.activeDispute)
      });
    } catch (err) {
      onAlert(`Could not find Bounty #${lookupId}: ${err.message}`, "error");
      setBountyData(null);
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
      onAlert("Successfully claimed pending payout!", "success");
      await loadPendingPayout();
    } catch (err) {
      onAlert(err.message || "Withdrawal failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (id) => {
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
      onAlert(`Refund triggered for Bounty #${id}! Funds credited to pending payout.`, "success");
      await loadPendingPayout();
      await handleLookup();
    } catch (err) {
      onAlert(err.message || "Refund failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {Number(pendingPayout) > 0 && (
        <div className="glass-panel" style={{ marginBottom: "24px", borderColor: "var(--success)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ color: "var(--success)" }}>🎉 Unclaimed Payout Available</h3>
              <p style={{ color: "var(--text-muted)" }}>
                You have <strong>{pendingPayout} ETH</strong> credited to your account from bounty claims or refunds.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleWithdraw} disabled={loading}>
              {loading ? "Withdrawing..." : "Withdraw ETH to Wallet"}
            </button>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Fund Bounty Form */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Escrow a New Bounty</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.92rem" }}>
            Deposit ETH into an HTLC escrow governed by decentralized arbitration.
          </p>

          <form onSubmit={handleFundBounty}>
            <div className="form-group">
              <label className="form-label">Submission ID (bytes32)</label>
              <input
                className="form-input mono"
                placeholder="0x..."
                required
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Whistleblower Beneficiary Address</label>
              <input
                className="form-input mono"
                placeholder="0x..."
                required
                value={whistleblower}
                onChange={(e) => setWhistleblower(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Bounty Amount (ETH)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  className="form-input"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Timelock Period (Days)</label>
                <input
                  type="number"
                  min="3"
                  className="form-input"
                  required
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Confirming..." : "Deposit Bounty to Escrow"}
            </button>
          </form>
        </div>

        {/* Lookup Bounty Card */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Inspect Bounty Escrow</h2>
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="number"
              className="form-input"
              style={{ width: "120px" }}
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <button className="btn btn-outline" onClick={handleLookup}>
              Lookup
            </button>
          </div>

          {bountyData ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3>Bounty #{bountyData.bountyId}</h3>
                <span className={`badge ${BADGE_MAP[bountyData.statusNum]}`}>
                  {bountyData.statusText}
                </span>
              </div>

              <div style={{ fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div><strong>Amount:</strong> {bountyData.amount} ETH</div>
                <div><strong>Submission:</strong> <code className="mono">{bountyData.submissionId.substring(0, 16)}...</code></div>
                <div><strong>Whistleblower:</strong> <code className="mono">{bountyData.whistleblower}</code></div>
                <div><strong>Funder:</strong> <code className="mono">{bountyData.funder}</code></div>
                <div><strong>Timelock:</strong> {bountyData.timelock}</div>
                {bountyData.activeDispute > 0 && (
                  <div style={{ color: "var(--warning)" }}>
                    <strong>Active Dispute:</strong> #{bountyData.activeDispute}
                  </div>
                )}
              </div>

              {(bountyData.statusNum === 1 || bountyData.statusNum === 4) && (
                <button
                  className="btn btn-outline"
                  style={{ width: "100%", marginTop: "16px" }}
                  onClick={() => handleRefund(bountyData.bountyId)}
                  disabled={loading}
                >
                  Trigger Time-Locked Refund
                </button>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
              Enter a Bounty ID above to inspect on-chain escrow status and timelocks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
