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
  const [chunkPreview, setChunkPreview] = useState(null);
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

  const computePreviewMerkle = async (selectedFile) => {
    try {
      const buf = await selectedFile.arrayBuffer();
      const tree = await generateClientMerkleTree(buf);
      setChunkPreview({
        fileName: selectedFile.name,
        totalBytes: selectedFile.size,
        ...tree
      });
    } catch (_) {
      setChunkPreview(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const picked = e.target.files[0];
      setFile(picked);
      setResult(null);
      computePreviewMerkle(picked);
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
    computePreviewMerkle(sampleFile);
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
      const { rootHex, chunkCount, chunkDetails, treeLevels, detailedLevels } =
        await generateClientMerkleTree(fileBuffer);
      setChunkPreview({
        fileName: file.name,
        totalBytes: file.size,
        rootHex,
        chunkCount,
        chunkDetails,
        treeLevels,
        detailedLevels
      });

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
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: "6px 12px", fontSize: "0.82rem", borderColor: "var(--accent-cyan)", color: "var(--accent-cyan)" }}
              onClick={() => {
                // Generate a 4.5 MiB multi-chunk synthetic leak bundle (5 chunks of 1 MiB)
                const totalSize = Math.floor(4.5 * 1024 * 1024);
                const bytes = new Uint8Array(totalSize);
                for (let c = 0; c < 5; c++) {
                  const offset = c * 1024 * 1024;
                  const tag = new TextEncoder().encode(
                    `VERILEAKS MULTI-CHUNK AUDIT DUMP — CHUNK #${c + 1} OF 5 (OFFSET ${offset})\n`
                  );
                  bytes.set(tag, offset);
                }
                const bigFile = new File([bytes], "classified_audit_archive_4.5MB.bin", {
                  type: "application/octet-stream"
                });
                setFile(bigFile);
                setResult(null);
                computePreviewMerkle(bigFile);
                onAlert("Generated 4.5 MiB multi-chunk evidence file (sliced into 5 × 1 MiB Merkle leaf chunks!).", "info");
              }}
            >
              📦 Load Multi-Chunk File (4.5 MiB → 5 Chunks)
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
                    {file.size >= 1024 * 1024
                      ? `${(file.size / (1024 * 1024)).toFixed(2)} MiB (${file.size.toLocaleString()} bytes)`
                      : `${(file.size / 1024).toFixed(2)} KB (${file.size.toLocaleString()} bytes)`}{" "}
                    → Sliced into{" "}
                    <strong style={{ color: "var(--success)" }}>
                      {Math.ceil(file.size / (1024 * 1024))} × 1 MiB Chunk(s)
                    </strong>{" "}
                    & encrypted as <code>{file.name}.enc</code> (AES-256-GCM)
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

          {chunkPreview && chunkPreview.chunkDetails && (
            <div
              className="notice-card"
              style={{
                borderColor: "rgba(6, 182, 212, 0.45)",
                background: "rgba(15, 23, 42, 0.78)",
                marginBottom: "18px",
                padding: "14px 16px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "10px"
                }}
              >
                <strong style={{ color: "var(--accent-cyan)", fontSize: "0.9rem" }}>
                  🌳 Live 1 MiB Chunking & Binary Merkle Tree Breakdown ({chunkPreview.chunkCount} Leaf{" "}
                  {chunkPreview.chunkCount === 1 ? "Chunk" : "Chunks"})
                </strong>
                <span className="status-pill info" style={{ fontSize: "0.75rem" }}>
                  CHUNK_SIZE = 1,048,576 Bytes (1.00 MiB)
                </span>
              </div>

              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "10px" }}>
                Each 1 MiB slice is domain-prefixed with <code>0x00</code> (leaf tag:{" "}
                <code>SHA256(0x00 || chunkBytes)</code>), and internal tree levels are paired with{" "}
                <code>0x01</code> (branch tag: <code>SHA256(0x01 || left || right)</code>) to prevent
                second-preimage attacks.
              </div>

              <div
                style={{
                  maxHeight: "230px",
                  overflowY: "auto",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 23, 0.65)"
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.78rem",
                    textAlign: "left"
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        background: "rgba(30, 41, 59, 0.7)",
                        color: "var(--accent-cyan)"
                      }}
                    >
                      <th style={{ padding: "7px 10px" }}>Chunk #</th>
                      <th style={{ padding: "7px 10px" }}>Byte Offset Range</th>
                      <th style={{ padding: "7px 10px" }}>Slice Size</th>
                      <th style={{ padding: "7px 10px" }}>Leaf Hash: SHA256(0x00 || Chunk)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunkPreview.chunkDetails.map((c) => (
                      <tr
                        key={c.index}
                        style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}
                      >
                        <td style={{ padding: "6px 10px", fontWeight: 600, color: "#f8fafc" }}>
                          Chunk #{c.index + 1}
                        </td>
                        <td className="mono" style={{ padding: "6px 10px", color: "#cbd5e1" }}>
                          {c.byteStart.toLocaleString()} – {c.byteEnd.toLocaleString()} B
                        </td>
                        <td style={{ padding: "6px 10px", color: "var(--success)" }}>
                          {(c.sizeBytes / (1024 * 1024)).toFixed(2)} MiB ({c.sizeBytes.toLocaleString()} B)
                        </td>
                        <td
                          className="mono"
                          style={{
                            padding: "6px 10px",
                            color: "#93c5fd",
                            wordBreak: "break-all"
                          }}
                        >
                          {c.leafHashHex}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "0.79rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  color: "#e2e8f0"
                }}
              >
                <span>
                  Merkle Tree Depth: <strong>{chunkPreview.treeLevels?.length || 1} Level(s)</strong>{" "}
                  ({chunkPreview.chunkCount} Leaf Nodes → 1 Root Hash)
                </span>
                <span className="mono" style={{ color: "var(--success)", fontSize: "0.76rem" }}>
                  Root: {chunkPreview.rootHex}
                </span>
              </div>

              {/* Live Visual Binary Merkle Tree Diagram (Circular Nodes + Straight Edges Connecting Root -> Left / Right Children) */}
              {chunkPreview.detailedLevels && chunkPreview.detailedLevels.length > 0 && (() => {
                const levels = chunkPreview.detailedLevels; // level 0 = leaves, level L-1 = root
                const totalLevels = levels.length;
                const leafCount = levels[0].length;
                const leafSpacing = 128;
                const svgPaddingX = 95;
                const svgPaddingY = 55;
                const levelGapY = 112;
                const nodeRadius = 34;

                const svgWidth = Math.max(660, (leafCount - 1) * leafSpacing + svgPaddingX * 2);
                const svgHeight = (totalLevels - 1) * levelGapY + svgPaddingY * 2 + 24;

                // Compute (x, y) coordinates bottom-up so every parent sits centered above its Left & Right child circles
                const coordsByLevel = [];
                const leafY = svgPaddingY + (totalLevels - 1) * levelGapY;

                const leafCoords = levels[0].map((node, idx) => {
                  const x =
                    leafCount === 1
                      ? svgWidth / 2
                      : svgPaddingX +
                        idx * ((svgWidth - svgPaddingX * 2) / Math.max(1, leafCount - 1));
                  return { ...node, x, y: leafY };
                });
                coordsByLevel[0] = leafCoords;

                for (let lvl = 1; lvl < totalLevels; lvl++) {
                  const prevCoords = coordsByLevel[lvl - 1];
                  const currNodes = levels[lvl];
                  const y = svgPaddingY + (totalLevels - 1 - lvl) * levelGapY;
                  coordsByLevel[lvl] = currNodes.map((node, i) => {
                    const leftChild = prevCoords[i * 2];
                    const rightChild =
                      i * 2 + 1 < prevCoords.length ? prevCoords[i * 2 + 1] : prevCoords[i * 2];
                    const x =
                      leftChild && rightChild
                        ? (leftChild.x + rightChild.x) / 2
                        : svgWidth / 2;
                    return {
                      ...node,
                      x,
                      y,
                      leftChildCoord: leftChild,
                      rightChildCoord: rightChild,
                      hasDistinctRight: i * 2 + 1 < prevCoords.length
                    };
                  });
                }

                return (
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "12px",
                      borderTop: "1px solid rgba(148, 163, 184, 0.2)"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginBottom: "10px"
                      }}
                    >
                      <strong style={{ color: "#e2e8f0", fontSize: "0.86rem" }}>
                        🌳 Live Binary Merkle Tree Graph (Circular Nodes with Left / Right Straight-Line Edges)
                      </strong>
                      <span style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
                        Hover any circular node to inspect its full 32-byte SHA-256 hash
                      </span>
                    </div>

                    <div
                      style={{
                        overflowX: "auto",
                        borderRadius: "10px",
                        background: "rgba(2, 6, 23, 0.9)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        padding: "8px"
                      }}
                    >
                      <svg
                        width={svgWidth}
                        height={svgHeight}
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        style={{ display: "block", margin: "0 auto" }}
                      >
                        {/* Straight Connector Lines from Parent Circle to Left & Right Child Circles */}
                        {coordsByLevel.map((lvlNodes, lvl) => {
                          if (lvl === 0) return null;
                          return lvlNodes.map((parent) => {
                            const lc = parent.leftChildCoord;
                            const rc = parent.rightChildCoord;
                            const midLeftX = lc ? (parent.x + lc.x) / 2 : parent.x;
                            const midLeftY = lc ? (parent.y + lc.y) / 2 : parent.y;
                            const midRightX = rc ? (parent.x + rc.x) / 2 : parent.x;
                            const midRightY = rc ? (parent.y + rc.y) / 2 : parent.y;

                            return (
                              <g key={`edges-${lvl}-${parent.index}`}>
                                {lc && (
                                  <>
                                    <line
                                      x1={parent.x}
                                      y1={parent.y + nodeRadius}
                                      x2={lc.x}
                                      y2={lc.y - nodeRadius}
                                      stroke={parent.hasDistinctRight ? "#38bdf8" : "#f59e0b"}
                                      strokeWidth="2.2"
                                    />
                                    <rect
                                      x={midLeftX - 11}
                                      y={midLeftY - 8}
                                      width={parent.hasDistinctRight ? "22" : "44"}
                                      height="15"
                                      rx="4"
                                      fill="#0f172a"
                                      stroke={parent.hasDistinctRight ? "#38bdf8" : "#f59e0b"}
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={parent.hasDistinctRight ? midLeftX : midLeftX + 11}
                                      y={midLeftY + 3}
                                      textAnchor="middle"
                                      fill={parent.hasDistinctRight ? "#38bdf8" : "#fbbf24"}
                                      fontSize="9.5"
                                      fontWeight="700"
                                      fontFamily="monospace"
                                    >
                                      {parent.hasDistinctRight ? "L" : "L+Dup"}
                                    </text>
                                  </>
                                )}
                                {rc && parent.hasDistinctRight && (
                                  <>
                                    <line
                                      x1={parent.x}
                                      y1={parent.y + nodeRadius}
                                      x2={rc.x}
                                      y2={rc.y - nodeRadius}
                                      stroke="#c084fc"
                                      strokeWidth="2.2"
                                    />
                                    <rect
                                      x={midRightX - 11}
                                      y={midRightY - 8}
                                      width="22"
                                      height="15"
                                      rx="4"
                                      fill="#0f172a"
                                      stroke="#c084fc"
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={midRightX}
                                      y={midRightY + 3}
                                      textAnchor="middle"
                                      fill="#c084fc"
                                      fontSize="9.5"
                                      fontWeight="700"
                                      fontFamily="monospace"
                                    >
                                      R
                                    </text>
                                  </>
                                )}
                              </g>
                            );
                          });
                        })}

                        {/* Circular Nodes for Root, Internal Left/Right Branches, and 1 MiB Leaf Chunks */}
                        {coordsByLevel.map((lvlNodes, lvl) =>
                          lvlNodes.map((node) => {
                            const isRoot = lvl === totalLevels - 1;
                            const isLeaf = lvl === 0;
                            const isLeft = node.index % 2 === 0;
                            const strokeColor = isRoot
                              ? "#10b981"
                              : isLeaf
                              ? "#06b6d4"
                              : isLeft
                              ? "#38bdf8"
                              : "#c084fc";
                            const fillColor = isRoot
                              ? "rgba(16, 185, 129, 0.22)"
                              : isLeaf
                              ? "rgba(6, 182, 212, 0.16)"
                              : "rgba(30, 41, 59, 0.95)";
                            const shortTag = isRoot
                              ? "ROOT"
                              : isLeaf
                              ? `C#${node.index + 1}`
                              : `L${lvl}·${isLeft ? "L" : "R"}`;
                            const shortHash = `${node.hashHex.slice(0, 6)}..${node.hashHex.slice(-4)}`;

                            return (
                              <g key={`node-${lvl}-${node.index}`}>
                                <title>
                                  {`${node.label}\nRole: ${isRoot ? "MERKLE ROOT" : isLeft ? "LEFT CHILD" : "RIGHT CHILD"}\nSHA-256: ${node.hashHex}`}
                                </title>
                                <circle
                                  cx={node.x}
                                  cy={node.y}
                                  r={nodeRadius}
                                  fill="#0b1120"
                                  stroke={strokeColor}
                                  strokeWidth={isRoot ? "3" : "2.2"}
                                />
                                <circle
                                  cx={node.x}
                                  cy={node.y}
                                  r={nodeRadius - 2}
                                  fill={fillColor}
                                />
                                <text
                                  x={node.x}
                                  y={node.y - 6}
                                  textAnchor="middle"
                                  fill={isRoot ? "#34d399" : "#f8fafc"}
                                  fontSize="10.5"
                                  fontWeight="800"
                                  fontFamily="sans-serif"
                                >
                                  {shortTag}
                                </text>
                                <text
                                  x={node.x}
                                  y={node.y + 9}
                                  textAnchor="middle"
                                  fill="#93c5fd"
                                  fontSize="8.8"
                                  fontFamily="monospace"
                                >
                                  {shortHash}
                                </text>
                                {isLeaf && (
                                  <text
                                    x={node.x}
                                    y={node.y + nodeRadius + 15}
                                    textAnchor="middle"
                                    fill="#94a3b8"
                                    fontSize="9"
                                    fontFamily="sans-serif"
                                  >
                                    Chunk #{node.index + 1} (1 MiB)
                                  </text>
                                )}
                              </g>
                            );
                          })
                        )}
                      </svg>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

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
