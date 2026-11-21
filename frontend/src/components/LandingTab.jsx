import React from "react";

export function LandingTab({ onSelectTab }) {
  return (
    <div>
      <div className="glass-panel" style={{ marginBottom: "32px", textAlign: "center", padding: "48px 24px" }}>
        <h1 style={{ fontSize: "2.4rem", marginBottom: "16px" }}>
          Decentralized Whistleblower Evidence Bounty Protocol
        </h1>
        <p style={{ maxWidth: "780px", margin: "0 auto 24px", color: "var(--text-muted)", fontSize: "1.1rem" }}>
          VeriLeaks combines client-side Merkle tree verification, zero-knowledge credentials,
          Chainlink VRF randomized arbitration, and trustless HTLC bounty escrow on Arbitrum.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={() => onSelectTab("submit")}>
            Submit Evidence Anonymously
          </button>
          <button className="btn btn-outline" onClick={() => onSelectTab("bounties")}>
            Explore Bounties
          </button>
        </div>
      </div>

      <div className="notice-card">
        <strong>🔐 End-to-End Privacy & Client-Side AES-256-GCM Encryption Architecture:</strong>
        <p style={{ marginTop: "6px" }}>
          All evidence files uploaded via this application are hashed into a 1 MiB SHA-256 Merkle
          tree and <strong>encrypted client-side in your browser using AES-256-GCM</strong> (WebCrypto
          API) before leaving your device. The local Privacy Upload Proxy (<code>127.0.0.1:3000</code>)
          and IPFS only ever receive encrypted <code>.enc</code> ciphertext, and the decryption key
          envelope is sealed exclusively for the <strong>3 randomly selected Chainlink VRF Jurors</strong>{" "}
          assigned to arbitrate the case.
        </p>
      </div>

      <div className="grid-2">
        <div className="glass-panel">
          <h3 style={{ marginBottom: "12px", color: "var(--accent-cyan)" }}>1. Cryptographic Evidence Integrity</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Evidence files are split into standard 1 MiB chunks with domain-separated SHA-256 leaf and node hashing.
            The resulting Merkle Root and IPFS CID are anchored immutably on-chain via <code>SubmissionRegistry.sol</code>.
          </p>
        </div>

        <div className="glass-panel">
          <h3 style={{ marginBottom: "12px", color: "var(--primary)" }}>2. Trustless Bounty Escrow (HTLC)</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Funders deposit bounties held securely under <code>ArbitratedBounty.sol</code> and <code>HTLC.sol</code>.
            Whistleblowers receive payouts upon verification, while funders retain guaranteed time-locked refund rights if disputes fail.
          </p>
        </div>

        <div className="glass-panel">
          <h3 style={{ marginBottom: "12px", color: "var(--warning)" }}>3. Schelling Point Arbitration</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Disputed submissions undergo commit-reveal voting evaluated by jurors selected via Chainlink VRF v2.5.
            Dishonest and non-revealing jurors are economically slashed, redistributing penalties to the honest consensus cohort.
          </p>
        </div>

        <div className="glass-panel">
          <h3 style={{ marginBottom: "12px", color: "var(--success)" }}>4. Automated Watchtower Network</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            A distributed network of independent watchtower nodes monitors mempools and deadlines,
            automatically executing permissionless contract finalizations and bounty settlements without human bottleneck.
          </p>
        </div>
      </div>
    </div>
  );
}
