import React, { useState } from "react";
import { ethers } from "ethers";
import { ABIS } from "../contracts/abis.js";

const VOTING_STATUS = ["NONE", "CREATED (Awaiting VRF)", "ACTIVE (Commit/Reveal)", "FINALIZED", "CANCELLED"];
const OUTCOME_MAP = ["NONE", "REAL (Evidence Valid)", "FAKE (Evidence Fraudulent)", "INCONCLUSIVE"];

export function ArbitrationTab({ signer, provider, contractAddresses, currentAccount, onAlert }) {
  const [disputeId, setDisputeId] = useState("1");
  const [disputeInfo, setDisputeInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Voting action inputs
  const [voteChoice, setVoteChoice] = useState("1"); // 1 = REAL, 2 = FAKE
  const [salt, setSalt] = useState("");

  const handleLookup = async () => {
    if (!provider || !contractAddresses.voting) return;
    try {
      setLoading(true);
      const votingContract = new ethers.Contract(
        contractAddresses.voting,
        ABIS.SchellingVoting,
        provider
      );

      const res = await votingContract.resultOf(disputeId);
      // res returns [status, outcome, creator, externalRef, submissionId]

      let jurors = [];
      try {
        jurors = await votingContract.jurorsOf(disputeId);
      } catch (_) {}

      setDisputeInfo({
        disputeId,
        statusNum: Number(res[0]),
        statusText: VOTING_STATUS[Number(res[0])] || "UNKNOWN",
        outcomeNum: Number(res[1]),
        outcomeText: OUTCOME_MAP[Number(res[1])] || "NONE",
        creator: res[2],
        bountyId: Number(res[3]),
        submissionId: res[4],
        jurors
      });
    } catch (err) {
      onAlert(`Failed to lookup Dispute #${disputeId}: ${err.message}`, "error");
      setDisputeInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const generateSalt = () => {
    const randomBytes = ethers.hexlify(ethers.randomBytes(32));
    setSalt(randomBytes);
    onAlert("Generated new cryptographic salt! Save this to reveal your vote.", "info");
  };

  const handleCommitVote = async () => {
    if (!signer) return onAlert("Connect wallet first", "error");
    if (!salt) return onAlert("Generate or enter a 32-byte salt first", "error");

    try {
      setLoading(true);
      const votingContract = new ethers.Contract(
        contractAddresses.voting,
        ABIS.SchellingVoting,
        signer
      );

      // Derive commitment hash using on-chain view function
      const commitment = await votingContract.commitmentFor(
        disputeId,
        currentAccount,
        Number(voteChoice),
        salt
      );

      const tx = await votingContract.commitVote(disputeId, commitment);
      await tx.wait(1);
      onAlert("Vote commitment submitted on-chain!", "success");
    } catch (err) {
      onAlert(err.message || "Vote commitment failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRevealVote = async () => {
    if (!signer) return onAlert("Connect wallet first", "error");
    if (!salt) return onAlert("Enter the exact salt used during commit phase", "error");

    try {
      setLoading(true);
      const votingContract = new ethers.Contract(
        contractAddresses.voting,
        ABIS.SchellingVoting,
        signer
      );

      const tx = await votingContract.revealVote(disputeId, Number(voteChoice), salt);
      await tx.wait(1);
      onAlert("Vote revealed successfully!", "success");
      await handleLookup();
    } catch (err) {
      onAlert(err.message || "Vote reveal failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!signer) return onAlert("Connect wallet first", "error");
    try {
      setLoading(true);
      const votingContract = new ethers.Contract(
        contractAddresses.voting,
        ABIS.SchellingVoting,
        signer
      );
      const tx = await votingContract.finalize(disputeId);
      await tx.wait(1);
      onAlert(`Dispute #${disputeId} finalized on-chain!`, "success");
      await handleLookup();
    } catch (err) {
      onAlert(err.message || "Finalize failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSettleBounty = async (bId) => {
    if (!signer) return onAlert("Connect wallet first", "error");
    try {
      setLoading(true);
      const bountyContract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        signer
      );
      const tx = await bountyContract.settle(bId);
      await tx.wait(1);
      onAlert(`Bounty #${bId} settled according to arbitration outcome!`, "success");
    } catch (err) {
      onAlert(err.message || "Settle failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="grid-2">
        {/* Lookup Card */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Arbitration Case Monitor</h2>
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="number"
              className="form-input"
              style={{ width: "120px" }}
              value={disputeId}
              onChange={(e) => setDisputeId(e.target.value)}
            />
            <button className="btn btn-outline" onClick={handleLookup} disabled={loading}>
              Lookup Dispute
            </button>
          </div>

          {disputeInfo ? (
            <div style={{ fontSize: "0.92rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Lifecycle Status:</strong>
                <span className="badge badge-info">{disputeInfo.statusText}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Final Outcome:</strong>
                <span className="badge badge-success">{disputeInfo.outcomeText}</span>
              </div>
              <div><strong>Associated Bounty:</strong> #{disputeInfo.bountyId}</div>
              <div><strong>Submission Hash:</strong> <code className="mono">{disputeInfo.submissionId.substring(0, 16)}...</code></div>

              {disputeInfo.jurors.length > 0 && (
                <div>
                  <strong>Selected Jurors ({disputeInfo.jurors.length}):</strong>
                  <ul style={{ paddingLeft: "20px", marginTop: "4px", fontSize: "0.82rem" }}>
                    {disputeInfo.jurors.map((j, i) => (
                      <li key={i} className="mono">{j}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Permissionless Finalize & Settle Buttons */}
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {disputeInfo.statusNum === 2 && (
                  <button className="btn btn-primary" onClick={handleFinalize} disabled={loading}>
                    Finalize Dispute (Permissionless)
                  </button>
                )}
                {disputeInfo.statusNum === 3 && disputeInfo.bountyId > 0 && (
                  <button className="btn btn-outline" onClick={() => handleSettleBounty(disputeInfo.bountyId)} disabled={loading}>
                    Settle Bounty #{disputeInfo.bountyId} with Outcome
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
              Enter a Dispute ID to inspect commit-reveal voting status and VRF juror selections.
            </div>
          )}
        </div>

        {/* Voting Panel */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Juror Commit-Reveal Voting</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.92rem" }}>
            Jurors cast blinded commitments in Phase 1, then reveal cleartext votes in Phase 2.
          </p>

          <div className="form-group">
            <label className="form-label">Vote Determination</label>
            <select
              className="form-input"
              value={voteChoice}
              onChange={(e) => setVoteChoice(e.target.value)}
            >
              <option value="1">REAL — Evidence is authentic and verified</option>
              <option value="2">FAKE — Evidence is fabricated or invalid</option>
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label">Cryptographic Salt (bytes32)</label>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--accent-cyan)", cursor: "pointer", fontSize: "0.8rem" }}
                onClick={generateSalt}
              >
                Generate Salt
              </button>
            </div>
            <input
              className="form-input mono"
              placeholder="0x..."
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCommitVote} disabled={loading}>
              Phase 1: Commit Vote
            </button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleRevealVote} disabled={loading}>
              Phase 2: Reveal Vote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
