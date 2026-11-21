import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ABIS } from "../contracts/abis.js";
import { generateClientMerkleTree } from "../utils/merkle.js";
import { decryptEvidenceBuffer } from "../utils/encryption.js";

const VOTING_STATUS = [
  "NONE",
  "CREATED (Awaiting VRF)",
  "ACTIVE (Commit / Reveal Open)",
  "FINALIZED (Stakes Slashed & Distributed)",
  "CANCELLED"
];
const OUTCOME_MAP = [
  "PENDING",
  "REAL (Evidence Valid — Whistleblower Wins)",
  "FAKE (Evidence Fraudulent — Funder Refunded)",
  "INCONCLUSIVE (Tie / Insufficient Reveals)"
];

const JUROR_PERSONAS = [
  {
    id: "juror1",
    name: "Juror 1",
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
  },
  {
    id: "juror2",
    name: "Juror 2",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
  },
  {
    id: "juror3",
    name: "Juror 3",
    address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9"
  },
  {
    id: "juror4",
    name: "Juror 4",
    address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"
  },
  {
    id: "juror5",
    name: "Juror 5",
    address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
  }
];

export function ArbitrationTab({
  signer,
  provider,
  contractAddresses,
  currentAccount,
  currentRoleLabel,
  selectedWalletId,
  onSwitchRole,
  activeDisputeId,
  setActiveDisputeId,
  onGoToBounties,
  onGoToStaking,
  onBalanceChange,
  onAlert
}) {
  const [disputeId, setDisputeId] = useState(activeDisputeId || "1");
  const [disputeInfo, setDisputeInfo] = useState(null);
  const [jurorTable, setJurorTable] = useState([]);
  const [allPoolRows, setAllPoolRows] = useState([]);
  const [knownDisputes, setKnownDisputes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Track which jurors have downloaded & verified the evidence file for a dispute
  // Key: `${disputeId}:${jurorAddressLower}` -> { fileName, textPreview, computedRoot, onChainRoot, integrityMatch, ipfsCid }
  const [verifiedEvidenceByJuror, setVerifiedEvidenceByJuror] = useState({});
  const [allWatchtowersDown, setAllWatchtowersDown] = useState(false);

  // Per-juror saved salts & vote choices
  const [savedVotes, setSavedVotes] = useState({});
  const [voteChoice, setVoteChoice] = useState("1"); // 1 = REAL, 2 = FAKE
  const [salt, setSalt] = useState("");

  const isWhistleblower = selectedWalletId === "whistleblower";

  const isJurorRole =
    selectedWalletId === "juror1" ||
    selectedWalletId === "juror2" ||
    selectedWalletId === "juror3" ||
    selectedWalletId === "juror4" ||
    selectedWalletId === "juror5";

  useEffect(() => {
    if (activeDisputeId) {
      setDisputeId(String(activeDisputeId));
    }
  }, [activeDisputeId]);

  const fetchDisputeDetails = useCallback(
    async (idToFetch, silent = false) => {
      if (!provider || !contractAddresses.voting) return;
      try {
        if (!silent) setLoading(true);
        const votingContract = new ethers.Contract(
          contractAddresses.voting,
          ABIS.SchellingVoting,
          provider
        );

        const summary = await provider.send("verileaks_getStateSummary", []);
        if (summary?.disputes) {
          setKnownDisputes(summary.disputes);
        }

        const res = await votingContract.resultOf(idToFetch);
        if (Number(res[0]) === 0) {
          setDisputeInfo(null);
          setJurorTable([]);
          setAllPoolRows([]);
          if (!silent) {
            onAlert(
              `Dispute #${idToFetch} does not exist yet. Go to "1. Bounties & Escrow", fund a bounty, submit evidence, and trigger VRF Jury Arbitration!`,
              "info"
            );
          }
          return;
        }

        let selectedJurors = [];
        try {
          selectedJurors = await votingContract.jurorsOf(idToFetch);
        } catch (_) {}

        const selectedSet = new Set(selectedJurors.map((a) => a.toLowerCase()));
        const voteDetailsMap = summary?.disputeVotes || {};
        const jurorStakeSummary = summary?.jurors || [];

        const selectedRows = [];
        const poolRows = JUROR_PERSONAS.map((persona, idx) => {
          const jLower = persona.address.toLowerCase();
          const isSelected = selectedSet.has(jLower);
          const vDetail = voteDetailsMap[`${idToFetch}:${jLower}`] || {
            selected: isSelected,
            committed: false,
            revealed: false,
            vote: 0,
            penaltyEth: "0.0",
            rewardEth: "0.0"
          };
          const sDetail = jurorStakeSummary.find(
            (s) => s.address.toLowerCase() === jLower
          ) || { totalStaked: "2.0", lockedStake: "0.0", freeStake: "2.0" };

          const rowObj = {
            ...persona,
            selectedIndex: isSelected
              ? selectedJurors.findIndex((a) => a.toLowerCase() === jLower) + 1
              : null,
            isSelected,
            ...vDetail,
            totalStaked: sDetail.totalStaked,
            lockedStake: sDetail.lockedStake,
            freeStake: sDetail.freeStake
          };
          if (isSelected) selectedRows.push(rowObj);
          return rowObj;
        });

        setJurorTable(selectedRows);
        setAllPoolRows(poolRows);
        setDisputeInfo({
          disputeId: String(idToFetch),
          statusNum: Number(res[0]),
          statusText: VOTING_STATUS[Number(res[0])] || "UNKNOWN",
          outcomeNum: Number(res[1]),
          outcomeText: OUTCOME_MAP[Number(res[1])] || "NONE",
          creator: res[2],
          bountyId: Number(res[3]),
          submissionId: res[4],
          jurors: selectedJurors
        });
      } catch (err) {
        if (!silent) {
          onAlert(`Failed to lookup Dispute #${idToFetch}: ${err.message}`, "error");
        }
        setDisputeInfo(null);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [provider, contractAddresses.voting, onAlert]
  );

  useEffect(() => {
    fetchDisputeDetails(disputeId, true);
  }, [fetchDisputeDetails, disputeId, currentAccount]);

  useEffect(() => {
    const interval = setInterval(async () => {
      fetchDisputeDetails(disputeId, true);
      // Check if both active/standby executor watchtowers (9101 and 9102) are crashed/offline
      try {
        const [r1, r2] = await Promise.all([
          fetch("http://127.0.0.1:9101/health", { signal: AbortSignal.timeout(800) })
            .then((r) => r.json())
            .catch(() => ({ crashed: true })),
          fetch("http://127.0.0.1:9102/health", { signal: AbortSignal.timeout(800) })
            .then((r) => r.json())
            .catch(() => ({ crashed: true }))
        ]);
        setAllWatchtowersDown(Boolean(r1?.crashed && r2?.crashed));
      } catch (_) {}
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchDisputeDetails, disputeId]);

  // Restore saved salt & vote choice when switching between jurors
  // Default the 3rd selected VRF juror to FAKE (2) so the user can easily test the 25% minority slashing scenario!
  useEffect(() => {
    if (!currentAccount) return;
    const key = `${disputeId}:${currentAccount.toLowerCase()}`;
    if (savedVotes[key]) {
      setVoteChoice(savedVotes[key].voteChoice);
      setSalt(savedVotes[key].salt);
    } else {
      const selIdx = jurorTable.findIndex(
        (r) => r.address.toLowerCase() === currentAccount.toLowerCase()
      );
      const defaultVote = selIdx === 2 ? "2" : "1";
      const deterministicSalt = ethers.keccak256(
        ethers.toUtf8Bytes(`verileaks_demo_salt_dispute_${disputeId}_${currentAccount.toLowerCase()}`)
      );
      setVoteChoice(defaultVote);
      setSalt(deterministicSalt);
    }
  }, [currentAccount, disputeId, savedVotes, jurorTable]);

  const activeJurorRow = jurorTable.find(
    (r) => r.address.toLowerCase() === currentAccount?.toLowerCase()
  );
  const isSelectedVrfJuror = Boolean(activeJurorRow);
  const evidenceVerificationKey = `${disputeId}:${(currentAccount || "").toLowerCase()}`;
  const activeJurorEvidence = verifiedEvidenceByJuror[evidenceVerificationKey] || null;

  const generateSalt = () => {
    const randomBytes = ethers.hexlify(ethers.randomBytes(32));
    setSalt(randomBytes);
    if (currentAccount) {
      const key = `${disputeId}:${currentAccount.toLowerCase()}`;
      setSavedVotes((prev) => ({
        ...prev,
        [key]: { voteChoice, salt: randomBytes }
      }));
    }
    onAlert("Generated new 32-byte cryptographic salt (auto-saved for Reveal Phase)!", "info");
  };

  // Step 1 for Selected VRF Jurors: Download Encrypted .enc File, Decrypt Client-Side (AES-256-GCM) & Verify Merkle Root
  const handleDownloadAndVerifyEvidence = async () => {
    if (!provider || !currentAccount) return;
    if (!isSelectedVrfJuror) {
      onAlert(
        `Access Denied: ${currentRoleLabel} was NOT selected by Chainlink VRF for Dispute #${disputeId}! Only the 3 selected jurors can download or decrypt the evidence file.`,
        "error"
      );
      return;
    }

    try {
      setLoading(true);
      const res = await provider.send("verileaks_downloadEvidence", [
        Number(disputeId),
        currentAccount
      ]);
      if (!res || !res.authorized) {
        onAlert(res?.error || "Unauthorized to download or decrypt evidence for this dispute.", "error");
        return;
      }

      // Decrypt the AES-256-GCM ciphertext client-side in the juror's browser!
      const decryptedBytes = await decryptEvidenceBuffer(
        res.ciphertextBase64,
        res.aesKeyHex,
        res.ivHex
      );

      let textPreview = "";
      try {
        textPreview = new TextDecoder("utf-8", { fatal: false }).decode(
          decryptedBytes.slice(0, 2048)
        );
      } catch (_) {}

      // Trigger real browser download of the decrypted file so the juror can inspect it locally
      const blob = new Blob([decryptedBytes], {
        type: res.mimeType || "application/octet-stream"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName || `dispute_${disputeId}_decrypted_evidence.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Recompute 1 MiB SHA-256 Merkle root client-side on the decrypted file bytes
      const { rootHex, chunkCount } = await generateClientMerkleTree(decryptedBytes.buffer);
      const onChainRoot = res.merkleRoot || rootHex;
      const integrityMatch = rootHex.toLowerCase() === onChainRoot.toLowerCase();

      setVerifiedEvidenceByJuror((prev) => ({
        ...prev,
        [evidenceVerificationKey]: {
          fileName: res.fileName,
          encryptedFileName: res.encryptedFileName || `${res.fileName}.enc`,
          algorithm: res.algorithm || "AES-256-GCM",
          ivHex: res.ivHex,
          ciphertextPreviewHex: res.ciphertextPreviewHex,
          fileSize: decryptedBytes.byteLength,
          chunkCount,
          ipfsCid: res.ipfsCid,
          textPreview,
          computedRoot: rootHex,
          onChainRoot,
          integrityMatch
        }
      }));

      onAlert(
        `Encrypted "${res.encryptedFileName}" downloaded, decrypted client-side with AES-256-GCM, and Merkle root verified (${
          integrityMatch ? "✅ 100% Authentic Match" : "❌ Hash Mismatch"
        })! Voting is now unlocked for ${currentRoleLabel}.`,
        "success"
      );
    } catch (err) {
      onAlert(err.message || "Failed to download, decrypt, and verify evidence", "error");
    } finally {
      setLoading(false);
    }
  };

  // Phase progression counts
  const committedCount = jurorTable.filter((r) => r.committed).length;
  const revealedCount = jurorTable.filter((r) => r.revealed).length;
  const allCommitted = jurorTable.length > 0 && committedCount === jurorTable.length;
  const allRevealed = jurorTable.length > 0 && revealedCount === jurorTable.length;

  const handleCommitVote = async () => {
    if (!isSelectedVrfJuror) {
      return onAlert(
        `Unauthorized: ${currentRoleLabel} was NOT selected by Chainlink VRF for Dispute #${disputeId}! Only the 3 selected jurors can vote.`,
        "error"
      );
    }
    if (!activeJurorEvidence) {
      return onAlert(
        "Step 1 Required: Please download and verify the confidential evidence file first before casting your vote!",
        "error"
      );
    }
    if (!salt) return onAlert("Generate or enter a 32-byte salt first", "error");

    try {
      setLoading(true);
      const votingContract = new ethers.Contract(
        contractAddresses.voting,
        ABIS.SchellingVoting,
        signer
      );

      const commitment = await votingContract.commitmentFor(
        disputeId,
        currentAccount,
        Number(voteChoice),
        salt
      );

      const tx = await votingContract.commitVote(disputeId, commitment);
      await tx.wait(1);

      const key = `${disputeId}:${currentAccount.toLowerCase()}`;
      setSavedVotes((prev) => ({
        ...prev,
        [key]: { voteChoice, salt }
      }));

      await fetchDisputeDetails(disputeId, true);
      onAlert(
        `Committed blinded vote hash (${commitment.substring(0, 12)}...) for ${currentRoleLabel}!`,
        "success"
      );
    } catch (err) {
      onAlert(err.message || "Vote commitment failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRevealVote = async () => {
    if (!isSelectedVrfJuror) {
      return onAlert(
        `Unauthorized: ${currentRoleLabel} was NOT selected by Chainlink VRF for Dispute #${disputeId}!`,
        "error"
      );
    }
    if (!allCommitted) {
      return onAlert(
        `Phase Restricted: All 3 VRF-selected jurors must complete Phase 1 (Commit) before Phase 2 (Reveal) opens! (${committedCount}/3 committed)`,
        "error"
      );
    }
    if (!salt) return onAlert("Enter the salt used during commit phase", "error");

    try {
      setLoading(true);
      const votingContract = new ethers.Contract(
        contractAddresses.voting,
        ABIS.SchellingVoting,
        signer
      );

      const tx = await votingContract.revealVote(disputeId, Number(voteChoice), salt);
      await tx.wait(1);
      await fetchDisputeDetails(disputeId, true);
      onAlert(
        `Revealed cleartext vote (${Number(voteChoice) === 1 ? "REAL" : "FAKE"}) for ${currentRoleLabel}!`,
        "success"
      );
    } catch (err) {
      onAlert(err.message || "Vote reveal failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Emergency Permissionless Self-Settlement Fallback when ALL Watchtower Executors are crashed/offline
  const handleEmergencySelfSettlement = async () => {
    if (!signer || !disputeInfo) return;
    if (!isWhistleblower && !isSelectedVrfJuror) {
      return onAlert(
        "Emergency Self-Settlement can only be triggered by the Whistleblower or a VRF-Selected Juror!",
        "error"
      );
    }
    try {
      setLoading(true);
      const votingContract = new ethers.Contract(
        contractAddresses.voting,
        ABIS.SchellingVoting,
        signer
      );
      const bountyContract = new ethers.Contract(
        contractAddresses.arbitratedBounty,
        ABIS.ArbitratedBounty,
        signer
      );

      const finTx = await votingContract.finalize(disputeId);
      await finTx.wait(1);

      if (disputeInfo.bountyId > 0) {
        const setTx = await bountyContract.settle(disputeInfo.bountyId);
        await setTx.wait(1);
      }

      await fetchDisputeDetails(disputeId, true);
      if (onBalanceChange) onBalanceChange();
      onAlert(
        `Emergency Permissionless Settlement executed by ${currentRoleLabel}! Dispute #${disputeId} finalized, stakes settled, and Bounty #${disputeInfo.bountyId} credited to winner.`,
        "success"
      );
    } catch (err) {
      onAlert(err.message || "Emergency settlement failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 5-Juror Pool Role Switcher Bar showing VRF Selection Status */}
      <div
        className="glass-panel"
        style={{
          marginBottom: "24px",
          padding: "16px 22px"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "12px"
          }}
        >
          <div>
            <strong style={{ color: "#ffffff", fontSize: "1rem" }}>
              5-Juror Pool Switcher (Chainlink VRF Selects 3 Random Jurors per Dispute):
            </strong>
            <div style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Only the <strong style={{ color: "var(--success)" }}>3 VRF-Selected Jurors (✅)</strong>{" "}
              can download the evidence file and vote. The{" "}
              <strong style={{ color: "var(--danger)" }}>2 Unselected Jurors (🚫)</strong> are
              strictly blocked from accessing the file or voting.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {JUROR_PERSONAS.map((jp) => {
            const isCurr = selectedWalletId === jp.id;
            const isSelectedOnCase = jurorTable.some(
              (r) => r.address.toLowerCase() === jp.address.toLowerCase()
            );
            const selIdx = jurorTable.findIndex(
              (r) => r.address.toLowerCase() === jp.address.toLowerCase()
            );
            return (
              <button
                key={jp.id}
                type="button"
                className={isCurr ? "btn btn-primary" : "btn btn-outline"}
                style={{
                  padding: "8px 14px",
                  fontSize: "0.82rem",
                  borderColor: isSelectedOnCase ? "var(--success)" : "rgba(239, 68, 68, 0.45)",
                  opacity: isSelectedOnCase || isCurr ? 1 : 0.75
                }}
                onClick={() => onSwitchRole && onSwitchRole(jp.id)}
              >
                ⚖️ {jp.name}{" "}
                {disputeInfo ? (
                  isSelectedOnCase ? (
                    <span
                      style={{
                        marginLeft: "6px",
                        color: isCurr ? "#fff" : "var(--success)",
                        fontWeight: 700
                      }}
                    >
                      ✅ VRF Selected {selIdx === 2 ? "(Test FAKE Vote)" : ""}
                    </span>
                  ) : (
                    <span
                      style={{
                        marginLeft: "6px",
                        color: isCurr ? "#ffd1d1" : "var(--danger)",
                        fontWeight: 600
                      }}
                    >
                      🚫 Not Selected
                    </span>
                  )
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: "24px" }}>
        {/* Left: Arbitration Case Monitor & Evidence Download / Verification */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "10px" }}>Arbitration Case & Evidence Verifier</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginBottom: "12px" }}>
            Inspect VRF jury selection, download the confidential evidence file (restricted to the 3
            selected jurors), and verify its SHA-256 Merkle root.
          </p>

          {knownDisputes.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
              {knownDisputes.map((kd) => (
                <button
                  key={kd.disputeId}
                  type="button"
                  className={
                    String(disputeId) === String(kd.disputeId) ? "btn btn-primary" : "btn btn-outline"
                  }
                  style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                  onClick={() => {
                    setDisputeId(String(kd.disputeId));
                    if (setActiveDisputeId) setActiveDisputeId(String(kd.disputeId));
                    fetchDisputeDetails(kd.disputeId, false);
                  }}
                >
                  Dispute #{kd.disputeId} (Bounty #{kd.bountyId} —{" "}
                  {kd.status === 2 ? "ACTIVE" : kd.status === 3 ? "FINALIZED" : "OPEN"})
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <input
              type="number"
              min="1"
              className="form-input"
              style={{ width: "120px" }}
              value={disputeId}
              onChange={(e) => {
                setDisputeId(e.target.value);
                if (setActiveDisputeId) setActiveDisputeId(e.target.value);
              }}
            />
            <button
              className="btn btn-outline"
              onClick={() => fetchDisputeDetails(disputeId, false)}
              disabled={loading}
            >
              Lookup Dispute
            </button>
          </div>

          {disputeInfo ? (
            <div style={{ fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Lifecycle Status:</strong>
                <span className="badge badge-info">{disputeInfo.statusText}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Phase Progress:</strong>
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                  Committed: {committedCount}/3 | Revealed: {revealedCount}/3
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Schelling Verdict:</strong>
                <span
                  className={`badge ${
                    disputeInfo.outcomeNum === 1
                      ? "badge-success"
                      : disputeInfo.outcomeNum === 2
                      ? "badge-danger"
                      : "badge-warning"
                  }`}
                >
                  {disputeInfo.outcomeText}
                </span>
              </div>
              <div>
                <strong>Associated Bounty:</strong> Bounty #{disputeInfo.bountyId}
              </div>
              <div>
                <strong>Anchored Submission ID:</strong>{" "}
                <code className="mono">{disputeInfo.submissionId.substring(0, 22)}...</code>
              </div>

              {/* Confidential Evidence Gated Download Box */}
              <div
                style={{
                  marginTop: "10px",
                  padding: "14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(10, 14, 23, 0.65)",
                  border: `1px solid ${
                    isSelectedVrfJuror ? "var(--accent-cyan)" : "rgba(239, 68, 68, 0.5)"
                  }`
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px"
                  }}
                >
                  <strong>🔐 Step 1: Encrypted Evidence Download & AES-256-GCM Decryption</strong>
                  <span
                    className={`badge ${isSelectedVrfJuror ? "badge-success" : "badge-danger"}`}
                  >
                    {isSelectedVrfJuror ? "✅ VRF Key Unsealed" : "🔒 Key & File Denied"}
                  </span>
                </div>

                {!isSelectedVrfJuror ? (
                  <div style={{ fontSize: "0.83rem", color: "#fca5a5" }}>
                    🚫 <strong>Unauthorized Wallet ({currentRoleLabel}):</strong> This account was{" "}
                    <strong>NOT</strong> selected among the 3 random Chainlink VRF jurors for
                    Dispute #{disputeInfo.disputeId}. Unselected jurors and non-jurors cannot
                    download the encrypted <code>.enc</code> payload or unseal the{" "}
                    <code>AES-256-GCM</code> decryption key.
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", marginBottom: "10px" }}>
                      As one of the 3 VRF-selected jurors, your address is authorized to fetch the
                      encrypted <code>.enc</code> payload from IPFS, unseal the{" "}
                      <code>AES-256-GCM</code> key envelope, decrypt the file client-side in your
                      browser, and verify its SHA-256 Merkle root.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "10px" }}
                      onClick={handleDownloadAndVerifyEvidence}
                      disabled={loading}
                    >
                      {activeJurorEvidence
                        ? `✅ Re-Download & Decrypt Evidence (${activeJurorEvidence.fileName})`
                        : "⬇️ Step 1: Download .enc File, Decrypt Client-Side (AES-256-GCM) & Verify Merkle Root"}
                    </button>

                    {activeJurorEvidence && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "10px 12px",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(16, 185, 129, 0.08)",
                          border: "1px solid var(--success)",
                          fontSize: "0.82rem"
                        }}
                      >
                        <div style={{ color: "var(--success)", fontWeight: 700, marginBottom: "6px" }}>
                          ✅ AES-256-GCM Decryption & Merkle Integrity Verified (0 Bytes Tampered)
                        </div>
                        <div>
                          <strong>Encrypted IPFS Payload:</strong>{" "}
                          <code>{activeJurorEvidence.encryptedFileName}</code> →{" "}
                          <strong>Decrypted File:</strong> <code>{activeJurorEvidence.fileName}</code>{" "}
                          ({activeJurorEvidence.fileSize} bytes)
                        </div>
                        <div>
                          <strong>Cipher & IV:</strong> <code>{activeJurorEvidence.algorithm}</code>{" "}
                          (IV: <code className="mono">{activeJurorEvidence.ivHex}</code>)
                        </div>
                        <div>
                          <strong>Computed SHA-256 Merkle Root:</strong>{" "}
                          <code className="mono">
                            {activeJurorEvidence.computedRoot.substring(0, 24)}...
                          </code>
                        </div>
                        <div>
                          <strong>On-Chain Registry Merkle Root:</strong>{" "}
                          <code className="mono">
                            {activeJurorEvidence.onChainRoot.substring(0, 24)}...
                          </code>
                        </div>
                        {activeJurorEvidence.textPreview && (
                          <pre
                            className="mono"
                            style={{
                              marginTop: "8px",
                              padding: "8px",
                              background: "rgba(0,0,0,0.4)",
                              borderRadius: "4px",
                              fontSize: "0.76rem",
                              whiteSpace: "pre-wrap",
                              maxHeight: "110px",
                              overflowY: "auto",
                              color: "#e2e8f0"
                            }}
                          >
                            {activeJurorEvidence.textPreview}
                          </pre>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Automated Watchtower Status & Emergency Fallback Controls */}
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {disputeInfo.statusNum === 2 && allRevealed && !allWatchtowersDown && (
                  <div
                    className="notice-card"
                    style={{
                      marginBottom: 0,
                      borderColor: "var(--accent-cyan)",
                      color: "var(--accent-cyan)",
                      fontSize: "0.85rem"
                    }}
                  >
                    ⚡ <strong>All 3 VRF Jurors Revealed!</strong> Watchtower Cluster is
                    automatically executing <code>SchellingVoting.finalize({disputeInfo.disputeId})</code>{" "}
                    and <code>ArbitratedBounty.settle({disputeInfo.bountyId})</code>...
                  </div>
                )}

                {disputeInfo.statusNum === 2 && allRevealed && allWatchtowersDown && (
                  <div
                    className="notice-card"
                    style={{
                      marginBottom: 0,
                      borderColor: "var(--danger)",
                      background: "rgba(239, 68, 68, 0.12)",
                      fontSize: "0.85rem"
                    }}
                  >
                    <strong style={{ color: "var(--danger)" }}>
                      🚨 All Automated Watchtower Executors Are Offline (Crashed)!
                    </strong>
                    <div style={{ marginTop: "6px", color: "#e2e8f0" }}>
                      Both Primary Watchtower 1 and Standby Watchtower 2 are currently crashed.
                      However, the protocol <strong>never stalls</strong> and the Funder{" "}
                      <strong>cannot steal the refund</strong> while a dispute is active: because{" "}
                      <code>finalize()</code> and <code>settle()</code> are permissionless and
                      deterministic on-chain, either a Watchtower can be recovered in Tab 5{" "}
                      <strong>OR</strong> the <strong>Whistleblower / Selected Juror</strong> can
                      execute emergency self-settlement directly below:
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: "100%", marginTop: "10px", padding: "11px" }}
                      onClick={handleEmergencySelfSettlement}
                      disabled={loading || (!isWhistleblower && !isSelectedVrfJuror)}
                    >
                      {!isWhistleblower && !isSelectedVrfJuror
                        ? "🔒 Switch to Whistleblower or a Selected VRF Juror for Emergency Settlement"
                        : `🚨 Emergency Fallback: Execute Permissionless Finalize & Settle (${currentRoleLabel})`}
                    </button>
                  </div>
                )}

                {disputeInfo.statusNum === 3 && (
                  <>
                    <div
                      className="notice-card"
                      style={{
                        marginBottom: 0,
                        borderColor: "var(--success)",
                        background: "rgba(16, 185, 129, 0.08)",
                        fontSize: "0.85rem"
                      }}
                    >
                      ✅ <strong>Automatically Executed by Watchtower Node 1:</strong>
                      <div style={{ marginTop: "4px", color: "#e2e8f0" }}>
                        • <code>SchellingVoting.finalize(#{disputeInfo.disputeId})</code> executed —
                        dissenting selected juror slashed <strong>25% (-0.250 ETH)</strong> and
                        honest majority jurors rewarded!
                        <br />• <code>ArbitratedBounty.settle(#{disputeInfo.bountyId})</code>{" "}
                        executed — escrow payout automatically credited!
                      </div>
                    </div>

                    {disputeInfo.bountyId > 0 && onGoToBounties && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: "12px" }}
                        onClick={() => onGoToBounties(disputeInfo.bountyId)}
                      >
                        💰 Go to Bounty #{disputeInfo.bountyId} to Withdraw Payout →
                      </button>
                    )}

                    {onGoToStaking && (
                      <button className="btn btn-outline" onClick={onGoToStaking}>
                        📊 View All 5 Jurors Staking & Slashing Ledger →
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "36px 0" }}>
              No active dispute found at ID #{disputeId}. Go to{" "}
              <strong>1. Bounties & Escrow</strong>, fund a bounty, submit evidence in{" "}
              <strong>2. Submit Evidence</strong>, and click{" "}
              <strong>"Challenge / Verify Evidence via Chainlink VRF Jury"</strong>!
            </div>
          )}
        </div>

        {/* Right: Juror Commit-Reveal Voting Panel (Strictly Restricted to the 3 VRF-Selected Jurors) */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "8px" }}>Step 2 & 3: Juror Commit-Reveal Voting</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "16px", fontSize: "0.9rem" }}>
            Active Role:{" "}
            <strong style={{ color: "var(--accent-cyan)" }}>{currentRoleLabel}</strong>
            {activeJurorRow ? (
              <span style={{ marginLeft: "8px", color: "var(--success)" }}>
                (✅ VRF-Selected Juror #{activeJurorRow.selectedIndex} of 3)
              </span>
            ) : (
              <span style={{ marginLeft: "8px", color: "var(--danger)" }}>
                (🚫 Not Selected for This Case)
              </span>
            )}
          </p>

          {/* Role / VRF Selection Lock Notice */}
          {!isSelectedVrfJuror && (
            <div
              className="notice-card"
              style={{
                borderColor: "var(--danger)",
                background: "rgba(239, 68, 68, 0.12)",
                marginBottom: "16px"
              }}
            >
              <strong style={{ color: "var(--danger)" }}>
                🔒 Action Blocked for {currentRoleLabel}
              </strong>
              <div style={{ fontSize: "0.84rem", marginTop: "4px" }}>
                {isJurorRole
                  ? `${currentRoleLabel} is one of the 2 unselected jurors in the 5-juror pool for Dispute #${disputeId}. Only the 3 jurors randomly drawn by Chainlink VRF (marked with ✅ above) have authorization to download the evidence or vote on this case.`
                  : `Only the 3 VRF-selected jurors for Dispute #${disputeId} can inspect the evidence and cast votes.`}
              </div>
            </div>
          )}

          {/* Evidence Inspection Gate Notice for Selected VRF Jurors */}
          {isSelectedVrfJuror && !activeJurorEvidence && !activeJurorRow?.committed && (
            <div
              className="notice-card"
              style={{
                borderColor: "var(--warning)",
                background: "rgba(245, 158, 11, 0.1)",
                marginBottom: "16px"
              }}
            >
              <strong style={{ color: "var(--warning)" }}>
                ⚠️ Step 1 Required Before Voting: Inspect Evidence First
              </strong>
              <div style={{ fontSize: "0.84rem", marginTop: "4px" }}>
                Jurors cannot vote blindly! Click{" "}
                <strong>"⬇️ Step 1: Download Confidential Evidence & Verify Merkle Root"</strong> on
                the left panel to inspect the document and verify its cryptographic hash before
                committing your vote.
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Vote Determination (Based on Evidence Verification)</label>
            <select
              className="form-input"
              value={voteChoice}
              disabled={!isSelectedVrfJuror || !activeJurorEvidence || activeJurorRow?.committed}
              onChange={(e) => {
                setVoteChoice(e.target.value);
                if (currentAccount) {
                  const key = `${disputeId}:${currentAccount.toLowerCase()}`;
                  setSavedVotes((prev) => ({
                    ...prev,
                    [key]: { voteChoice: e.target.value, salt }
                  }));
                }
              }}
            >
              <option value="1" style={{ background: "#111827", color: "#fff" }}>
                REAL (1) — Evidence Merkle root & content verified authentic
              </option>
              <option value="2" style={{ background: "#111827", color: "#fff" }}>
                FAKE (2) — Vote against evidence (Use on 1 selected juror to test 25% Slashing)
              </option>
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label">Cryptographic Salt (bytes32)</label>
              {isSelectedVrfJuror && activeJurorEvidence && !activeJurorRow?.committed && (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent-cyan)",
                    cursor: "pointer",
                    fontSize: "0.8rem"
                  }}
                  onClick={generateSalt}
                >
                  Regenerate Random Salt
                </button>
              )}
            </div>
            <input
              className="form-input mono"
              placeholder="0x..."
              value={salt}
              disabled={!isSelectedVrfJuror || !activeJurorEvidence || activeJurorRow?.committed}
              onChange={(e) => setSalt(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px" }}
              onClick={handleCommitVote}
              disabled={
                loading ||
                !isSelectedVrfJuror ||
                !activeJurorEvidence ||
                !disputeInfo ||
                disputeInfo.statusNum !== 2 ||
                activeJurorRow?.committed
              }
            >
              {!isSelectedVrfJuror
                ? `🔒 Unauthorized — ${currentRoleLabel} Not Selected by VRF for Dispute #${disputeId}`
                : !activeJurorEvidence && !activeJurorRow?.committed
                ? "🔒 Locked — Complete Step 1 (Download & Verify Evidence) First"
                : activeJurorRow?.committed
                ? "✅ Step 2 Complete: Salted Vote Hash Committed"
                : "Step 2 (Phase 1): Commit Salted Vote Hash"}
            </button>

            <button
              className="btn btn-outline"
              style={{
                width: "100%",
                padding: "12px",
                borderColor:
                  allCommitted && isSelectedVrfJuror ? "var(--accent-cyan)" : "var(--border-color)",
                color: allCommitted && isSelectedVrfJuror ? "#fff" : "var(--text-muted)"
              }}
              onClick={handleRevealVote}
              disabled={
                loading ||
                !isSelectedVrfJuror ||
                !disputeInfo ||
                disputeInfo.statusNum !== 2 ||
                !allCommitted ||
                activeJurorRow?.revealed
              }
            >
              {!isSelectedVrfJuror
                ? `🔒 Unauthorized — ${currentRoleLabel} Not Selected by VRF for Dispute #${disputeId}`
                : activeJurorRow?.revealed
                ? "✅ Step 3 Complete: Cleartext Vote Revealed"
                : !allCommitted
                ? `🔒 Step 3 (Reveal) Locked — Waiting for All 3 Selected Jurors to Commit (${committedCount}/3)`
                : "Step 3 (Phase 2): Reveal Cleartext Vote & Salt"}
            </button>
          </div>
        </div>
      </div>

      {/* Live 5-Juror Pool Status & Schelling Slashing Outcome Table */}
      {allPoolRows.length > 0 && (
        <div className="glass-panel">
          <h3 style={{ marginBottom: "14px" }}>
            5-Juror Pool VRF Selection, Commit-Reveal & Slashing Breakdown (Dispute #{disputeId})
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    textAlign: "left",
                    color: "var(--text-muted)"
                  }}
                >
                  <th style={{ padding: "10px 8px" }}>Juror Pool Member</th>
                  <th style={{ padding: "10px 8px" }}>Chainlink VRF Status</th>
                  <th style={{ padding: "10px 8px" }}>Evidence Verified</th>
                  <th style={{ padding: "10px 8px" }}>Phase 1: Commit</th>
                  <th style={{ padding: "10px 8px" }}>Phase 2: Revealed Vote</th>
                  <th style={{ padding: "10px 8px" }}>Slashed Penalty</th>
                  <th style={{ padding: "10px 8px" }}>Majority Reward</th>
                  <th style={{ padding: "10px 8px" }}>Resulting Total Stake</th>
                </tr>
              </thead>
              <tbody>
                {allPoolRows.map((r) => {
                  const isActive = currentAccount?.toLowerCase() === r.address.toLowerCase();
                  const pen = Number(r.penaltyEth || 0);
                  const rew = Number(r.rewardEth || 0);
                  const hasVerifiedFile = Boolean(
                    verifiedEvidenceByJuror[`${disputeId}:${r.address.toLowerCase()}`]
                  );
                  return (
                    <tr
                      key={r.address}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        background: isActive ? "rgba(99, 102, 241, 0.12)" : "transparent",
                        opacity: r.isSelected ? 1 : 0.65
                      }}
                    >
                      <td style={{ padding: "12px 8px", fontWeight: 600 }}>
                        {r.name}{" "}
                        <span
                          className="mono"
                          style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                        >
                          ({r.address.substring(0, 6)}...{r.address.substring(38)})
                        </span>{" "}
                        {isActive && <span className="badge badge-info">Active Role</span>}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {r.isSelected ? (
                          <span className="badge badge-success">
                            ✅ VRF Selected (1.0 ETH Locked)
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            🚫 Not Selected (No Access)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {!r.isSelected ? (
                          <span style={{ color: "var(--text-muted)" }}>🔒 Blocked</span>
                        ) : hasVerifiedFile || r.committed ? (
                          <span style={{ color: "var(--success)" }}>✅ Downloaded & Verified</span>
                        ) : (
                          <span style={{ color: "var(--warning)" }}>⏳ Not Downloaded Yet</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {!r.isSelected ? (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        ) : r.committed ? (
                          <span style={{ color: "var(--success)" }}>✅ Committed</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>⏳ Pending</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", fontWeight: 700 }}>
                        {!r.isSelected ? (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        ) : !r.revealed ? (
                          <span style={{ color: "var(--text-muted)" }}>🔒 Hidden</span>
                        ) : r.vote === 1 ? (
                          <span style={{ color: "var(--success)" }}>REAL (Authentic)</span>
                        ) : (
                          <span style={{ color: "var(--danger)" }}>FAKE (Dissenting)</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "12px 8px",
                          fontWeight: 700,
                          color: pen > 0 ? "var(--danger)" : "var(--text-muted)"
                        }}
                      >
                        {!r.isSelected
                          ? "—"
                          : pen > 0
                          ? `-${pen.toFixed(3)} ETH (25% Slashed)`
                          : "0.000 ETH"}
                      </td>
                      <td
                        style={{
                          padding: "12px 8px",
                          fontWeight: 700,
                          color: rew > 0 ? "var(--success)" : "var(--text-muted)"
                        }}
                      >
                        {!r.isSelected ? "—" : rew > 0 ? `+${rew.toFixed(3)} ETH` : "0.000 ETH"}
                      </td>
                      <td style={{ padding: "12px 8px", fontWeight: 700 }}>
                        {Number(r.totalStaked).toFixed(3)} ETH
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
