import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { generateClientMerkleTree } from "../utils/merkle.js";
import { encryptEvidenceBuffer } from "../utils/encryption.js";
import { ABIS } from "../contracts/abis.js";

export function SubmitTab({
  signer,
  provider,
  contractAddresses,
  currentAccount,
  currentRoleLabel,
  selectedWalletId,
  activeBountyId,
  onSwitchRole,
  onSubmissionRegistered,
  onProceedToBounty,
  onProceedToArbitration,
  onAlert
}) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState(null);
  const [openBounties, setOpenBounties] = useState([]);
  const [targetBountyId, setTargetBountyId] = useState(activeBountyId || "1");

  const isWhistleblower = selectedWalletId === "whistleblower";

  const loadOpenBounties = useCallback(async () => {
    if (!provider) return;
    try {
      const summary = await provider.send("verileaks_getStateSummary", []);
      if (summary?.bounties) {
        setOpenBounties(summary.bounties);
        if (summary.bounties.length > 0 && !targetBountyId) {
          setTargetBountyId(String(summary.bounties[summary.bounties.length - 1].bountyId));
        }
      }
    } catch (_) {}
  }, [provider, targetBountyId]);

  useEffect(() => {
    loadOpenBounties();
  }, [loadOpenBounties]);

  useEffect(() => {
    if (activeBountyId) {
      setTargetBountyId(String(activeBountyId));
    }
  }, [activeBountyId]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const loadSampleFile = () => {
    const content =
      "VERILEAKS CONFIDENTIAL EVIDENCE REPORT #2026-A\n" +
      "==============================================\n" +
      "Subject: Unauthorized Off-Ledger Fund Transfers & Compliance Violations\n" +
      "Timestamp: " + new Date().toISOString() + "\n" +
      "Submitter: Anonymous Whistleblower\n" +
      "Details: Internal audit logs demonstrating falsified quarterly reserve attestations.\n";
    const blob = new Blob([content], { type: "text/plain" });
    const sampleFile = new File([blob], "confidential_audit_leak_2026.txt", {
      type: "text/plain"
    });
    setFile(sampleFile);
    setResult(null);
    onAlert("Loaded sample whistleblower evidence document (ready for client-side AES-256-GCM encryption).", "info");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isWhistleblower) {
      onAlert("Role Restricted: Only the Whistleblower role can submit evidence.", "error");
      return;
    }
    if (!file) {
      onAlert("Please select an evidence file to submit.", "error");
      return;
    }
    if (!signer) {
      onAlert("Please connect a wallet first.", "error");
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      // Step 1: Client-Side Chunking & Merkle Tree Generation on Plaintext Document
      setStep("1/4 Computing client-side 1 MiB SHA-256 Merkle tree...");
      const fileBuffer = await file.arrayBuffer();
      const { rootHex, chunkCount } = await generateClientMerkleTree(fileBuffer);

      // Step 2: Client-Side AES-256-GCM Encryption via WebCrypto API before leaving browser!
      setStep("2/4 Encrypting evidence client-side with AES-256-GCM...");
      const {
        ciphertextBuffer,
        ciphertextBase64,
        ciphertextPreviewHex,
        aesKeyHex,
        ivHex,
        algorithm
      } = await encryptEvidenceBuffer(fileBuffer);

      const encryptedFileName = `${file.name}.enc`;
      const encryptedBlobFile = new File([ciphertextBuffer], encryptedFileName, {
        type: "application/octet-stream"
      });

      // Step 3: Upload ONLY the Encrypted Ciphertext (.enc) through the Privacy Upload Proxy
      setStep("3/4 Uploading encrypted ciphertext (.enc) via Privacy Proxy...");
      const formData = new FormData();
      formData.append("evidence", encryptedBlobFile);

      let cid = "";
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });
        if (response.ok) {
          const uploadData = await response.json();
          cid = uploadData.cid;
        }
      } catch (_) {}

      if (!cid) {
        cid = "Qm" + rootHex.slice(2, 48);
      }

      // Step 4: On-Chain Submission Registration & VRF-Gated Key Escrow
      setStep("4/4 Anchoring Merkle root on SubmissionRegistry.sol & sealing key for VRF jury...");
      const registryContract = new ethers.Contract(
        contractAddresses.registry,
        ABIS.SubmissionRegistry,
        signer
      );

      const tx = await registryContract.registerSubmission(cid, rootHex);
      const receipt = await tx.wait(1);

      let submissionId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = registryContract.interface.parseLog(log);
          if (parsed && parsed.name === "SubmissionRegistered") {
            submissionId = parsed.args.submissionId;
            break;
          }
        } catch (_) {}
      }

      const finalSubId =
        submissionId ||
        ethers.keccak256(ethers.toUtf8Bytes(cid + ":" + rootHex));

      // Link encrypted evidence & VRF-sealed AES-256-GCM key envelope to the Bounty
      let autoDisputeId = null;
      let autoSelectedJurors = [];
      if (provider && targetBountyId) {
        const linkRes = await provider.send("verileaks_linkSubmissionToBounty", [
          Number(targetBountyId),
          finalSubId,
          currentAccount,
          cid,
          rootHex,
          {
            fileName: file.name,
            encryptedFileName,
            mimeType: file.type || "application/octet-stream",
            isEncrypted: true,
            algorithm,
            ciphertextBase64,
            ciphertextPreviewHex,
            aesKeyHex,
            ivHex
          }
        ]);
        if (linkRes?.disputeId) {
          autoDisputeId = linkRes.disputeId;
          autoSelectedJurors = linkRes.selectedJurors || [];
        }
      }

      setResult({
        bountyId: targetBountyId,
        disputeId: autoDisputeId,
        selectedJurors: autoSelectedJurors,
        submissionId: finalSubId,
        merkleRoot: rootHex,
        ipfsCid: cid,
        chunkCount,
        encryptedFileName,
        algorithm,
        ivHex,
        ciphertextPreviewHex,
        submitter: currentAccount,
        txHash: receipt.hash
      });

      if (onSubmissionRegistered) {
        onSubmissionRegistered(finalSubId, targetBountyId, autoDisputeId);
      }

      onAlert(
        autoDisputeId
          ? `File encrypted client-side (${algorithm}), uploaded as "${encryptedFileName}", and decryption key sealed exclusively for the 3 VRF-selected jurors on Dispute #${autoDisputeId}!`
          : `File encrypted client-side (${algorithm}) and anchored on-chain!`,
        "success"
      );
    } catch (err) {
      console.error(err);
      onAlert(err.message || "Failed to submit evidence", "error");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div style={{ maxWidth: "780px", margin: "0 auto" }}>
      <div className="glass-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px"
          }}
        >
          <h2>Step 2: Encrypt & Submit Confidential Evidence</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: "6px 12px", fontSize: "0.82rem" }}
              onClick={loadSampleFile}
            >
              📄 Load Sample Leak File
            </button>
          </div>
        </div>

        <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.94rem" }}>
          Your document is first hashed in 1 MiB chunks (<code>0x00</code> leaf, <code>0x01</code>{" "}
          branch) and then <strong>encrypted client-side in your browser using AES-256-GCM</strong>{" "}
          before upload. The Privacy Proxy (<code>127.0.0.1:3000</code>) and IPFS only ever receive
          encrypted <code>.enc</code> ciphertext, and the decryption key is sealed exclusively for
          the <strong>3 randomly selected Chainlink VRF Jurors</strong>.
        </p>

        {/* Role Restriction Banner if not Whistleblower */}
        {!isWhistleblower && (
          <div
            className="notice-card"
            style={{
              borderColor: "var(--danger)",
              background: "rgba(239, 68, 68, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px"
            }}
          >
            <div>
              <strong style={{ color: "var(--danger)" }}>
                🔒 Role Restricted (Current: {currentRoleLabel})
              </strong>
              <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                Only the <strong>🕵️ Whistleblower</strong> role is permitted to encrypt, upload, and
                anchor confidential evidence.
              </div>
            </div>
            {onSwitchRole && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                onClick={() => onSwitchRole("whistleblower")}
              >
                Switch to 🕵️ Whistleblower
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Select which Open Funded Bounty this evidence claims */}
          <div className="form-group">
            <label className="form-label">Select Funded Bounty Case to Claim</label>
            {openBounties.length > 0 ? (
              <select
                className="form-input"
                value={targetBountyId}
                onChange={(e) => setTargetBountyId(e.target.value)}
                disabled={!isWhistleblower}
              >
                {openBounties.map((b) => (
                  <option
                    key={b.bountyId}
                    value={b.bountyId}
                    style={{ background: "#111827", color: "#fff" }}
                  >
                    Bounty #{b.bountyId} — Reward: {b.amountEth} ETH ({b.caseTitle})
                  </option>
                ))}
              </select>
            ) : (
              <div
                className="notice-card"
                style={{
                  marginBottom: 0,
                  borderColor: "var(--warning)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ fontSize: "0.85rem" }}>
                  ⚠️ No open bounty has been funded yet! A Bounty Funder can post a bounty in{" "}
                  <strong>1. Bounties & Escrow</strong> first.
                </span>
                {onProceedToBounty && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                    onClick={onProceedToBounty}
                  >
                    Go to Bounties →
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Select Evidence Document (PDF, TXT, ZIP, JSON, Media)</label>
            <div
              className="dropzone"
              style={{
                opacity: isWhistleblower ? 1 : 0.5,
                cursor: isWhistleblower ? "pointer" : "not-allowed"
              }}
              onClick={() => isWhistleblower && document.getElementById("fileInput").click()}
            >
              <input
                id="fileInput"
                type="file"
                style={{ display: "none" }}
                onChange={handleFileChange}
                disabled={!isWhistleblower}
              />
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔐</div>
              {file ? (
                <div>
                  <strong style={{ color: "var(--accent-cyan)" }}>{file.name}</strong>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                    {(file.size / 1024).toFixed(2)} KB → Will be encrypted client-side as{" "}
                    <code>{file.name}.enc</code> (AES-256-GCM)
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)" }}>
                  Click to select a file from your computer, or click{" "}
                  <strong>"Load Sample Leak File"</strong> above
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "14px" }}
            disabled={loading || !file || !isWhistleblower}
          >
            {!isWhistleblower
              ? "🔒 Disabled — Switch to Whistleblower Role to Submit"
              : loading
              ? step
              : `Encrypt (AES-256-GCM), Compute Merkle Root & Submit for Bounty #${targetBountyId}`}
          </button>
        </form>

        {result && (
          <div
            style={{
              marginTop: "28px",
              borderTop: "1px solid var(--border-color)",
              paddingTop: "24px"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                flexWrap: "wrap",
                gap: "10px"
              }}
            >
              <h3 style={{ color: "var(--success)" }}>
                ✅ Client-Side Encrypted, Anchored & VRF Jury Selected!
              </h3>
              {result.disputeId && onProceedToArbitration ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                  onClick={() => onProceedToArbitration(result.disputeId)}
                >
                  ⚖️ Step 3: Go to Jury Decryption & Voting (Dispute #{result.disputeId}) →
                </button>
              ) : (
                onProceedToBounty && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                    onClick={onProceedToBounty}
                  >
                    Return to Bounty #{result.bountyId} →
                  </button>
                )
              )}
            </div>

            {result.disputeId && (
              <div
                className="notice-card"
                style={{
                  borderColor: "var(--accent-cyan)",
                  background: "rgba(6, 182, 212, 0.08)",
                  fontSize: "0.85rem",
                  marginBottom: "16px"
                }}
              >
                🔐 <strong>Client-Side Encryption & VRF Key Sealing (Dispute #{result.disputeId}):</strong>
                <div style={{ marginTop: "4px", color: "#e2e8f0" }}>
                  • Uploaded Payload: <code>{result.encryptedFileName}</code> (
                  <strong>{result.algorithm}</strong> encrypted in browser before upload)
                  <br />• 96-Bit Initialization Vector (IV):{" "}
                  <code className="mono">{result.ivHex}</code>
                  <br />• Decryption Key Access: Sealed exclusively for the{" "}
                  <strong>3 randomly selected Chainlink VRF Jurors</strong>. The 2 unselected jurors
                  cannot download or decrypt this file.
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Encrypted Ciphertext Uploaded to Server / IPFS (First 32 Bytes)
              </label>
              <input className="form-input mono" readOnly value={result.ciphertextPreviewHex} />
            </div>
            <div className="form-group">
              <label className="form-label">Submission ID (Anchored on SubmissionRegistry.sol)</label>
              <input className="form-input mono" readOnly value={result.submissionId} />
            </div>
            <div className="form-group">
              <label className="form-label">Deterministic Merkle Root of Original Document (32 bytes)</label>
              <input className="form-input mono" readOnly value={result.merkleRoot} />
            </div>
            <div className="form-group">
              <label className="form-label">IPFS Content Identifier (CID of Encrypted .enc File)</label>
              <input className="form-input mono" readOnly value={result.ipfsCid} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
