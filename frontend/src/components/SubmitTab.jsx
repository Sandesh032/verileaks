import React, { useState } from "react";
import { ethers } from "ethers";
import { generateClientMerkleTree } from "../utils/merkle.js";
import { ABIS } from "../contracts/abis.js";

export function SubmitTab({ signer, contractAddresses, currentAccount, onAlert }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      onAlert("Please select an evidence file to submit.", "error");
      return;
    }
    if (!signer) {
      onAlert("Please connect your wallet first.", "error");
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      // Step 1: Client-Side Chunking & Merkle Tree Generation
      setStep("1/3 Generating client-side Merkle tree...");
      const fileBuffer = await file.arrayBuffer();
      const { rootHex, chunkCount } = await generateClientMerkleTree(fileBuffer);

      // Step 2: Privacy-Preserving Server-Side IPFS Upload
      setStep("2/3 Relaying evidence through Privacy Upload Proxy...");
      const formData = new FormData();
      formData.append("evidence", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Privacy upload failed (Status: ${response.status})`);
      }

      const uploadData = await response.json();
      const cid = uploadData.cid;

      // Step 3: On-Chain Submission Registration
      setStep("3/3 Confirming transaction on SubmissionRegistry...");
      const registryContract = new ethers.Contract(
        contractAddresses.registry,
        ABIS.SubmissionRegistry,
        signer
      );

      const tx = await registryContract.registerSubmission(cid, rootHex);
      const receipt = await tx.wait(1);

      // Extract submissionId from event or recalculate
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

      setResult({
        submissionId: submissionId || "Derived from on-chain event",
        merkleRoot: rootHex,
        ipfsCid: cid,
        chunkCount,
        txHash: receipt.hash
      });

      onAlert("Evidence successfully registered on-chain!", "success");
    } catch (err) {
      console.error(err);
      onAlert(err.message || "Failed to submit evidence", "error");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <div className="glass-panel">
        <h2 style={{ marginBottom: "16px" }}>Submit Confidential Evidence</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "0.95rem" }}>
          Evidence integrity is calculated client-side in 1 MiB chunks. Your upload is routed
          through our local memory-buffered proxy to shield your IP address and credentials.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Evidence Document (PDF, ZIP, JSON, Media)</label>
            <div className="dropzone" onClick={() => document.getElementById("fileInput").click()}>
              <input
                id="fileInput"
                type="file"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📁</div>
              {file ? (
                <div>
                  <strong style={{ color: "var(--accent-cyan)" }}>{file.name}</strong>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)" }}>
                  Click or drag and drop your evidence file here (Max 50 MB)
                </div>
              )}
            </div>
          </div>

          <div className="notice-card" style={{ fontSize: "0.85rem" }}>
            <strong>Privacy Note:</strong> Your wallet address (<code>{currentAccount || "Not Connected"}</code>)
            will be recorded as the submitter in the test registry. For maximal anonymity, connect a fresh, unfunded wallet
            funded exclusively via privacy pools or relayers.
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "14px" }}
            disabled={loading || !file}
          >
            {loading ? step : "Compute Merkle Root & Register on Blockchain"}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: "28px", borderTop: "1px solid var(--border-color)", paddingTop: "24px" }}>
            <h3 style={{ color: "var(--success)", marginBottom: "16px" }}>✅ Evidence Registered Successfully</h3>
            <div className="form-group">
              <label className="form-label">Submission ID (Keep for bounty tracking)</label>
              <input className="form-input mono" readOnly value={result.submissionId} />
            </div>
            <div className="form-group">
              <label className="form-label">Deterministic Merkle Root (32 bytes)</label>
              <input className="form-input mono" readOnly value={result.merkleRoot} />
            </div>
            <div className="form-group">
              <label className="form-label">IPFS Content Identifier (CID)</label>
              <input className="form-input mono" readOnly value={result.ipfsCid} />
            </div>
            <div className="form-group">
              <label className="form-label">Transaction Hash</label>
              <input className="form-input mono" readOnly value={result.txHash} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
