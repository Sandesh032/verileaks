import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, SUPPORTED_CHAINS } from "./contracts/config.js";
import { LandingTab } from "./components/LandingTab.jsx";
import { SubmitTab } from "./components/SubmitTab.jsx";
import { BountyTab } from "./components/BountyTab.jsx";
import { StakingTab } from "./components/StakingTab.jsx";
import { ArbitrationTab } from "./components/ArbitrationTab.jsx";
import { WatchtowerTab } from "./components/WatchtowerTab.jsx";

export const DEMO_WALLETS = [
  {
    id: "whistleblower",
    role: "🕵️ Whistleblower",
    shortRole: "Whistleblower",
    permissions: "Can submit evidence & withdraw released bounty payouts",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  },
  {
    id: "funder",
    role: "🏦 Bounty Funder",
    shortRole: "Bounty Funder",
    permissions: "Can deposit bounty escrow & challenge/open disputes",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
  },
  {
    id: "juror1",
    role: "⚖️ Juror 1",
    shortRole: "Juror 1",
    permissions: "Staked VRF Pool Member — Can vote & download evidence ONLY when selected by VRF",
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
  },
  {
    id: "juror2",
    role: "⚖️ Juror 2",
    shortRole: "Juror 2",
    permissions: "Staked VRF Pool Member — Can vote & download evidence ONLY when selected by VRF",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    privateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
  },
  {
    id: "juror3",
    role: "⚖️ Juror 3",
    shortRole: "Juror 3",
    permissions: "Staked VRF Pool Member — Can vote & download evidence ONLY when selected by VRF",
    address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    privateKey: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"
  },
  {
    id: "juror4",
    role: "⚖️ Juror 4",
    shortRole: "Juror 4",
    permissions: "Staked VRF Pool Member — Can vote & download evidence ONLY when selected by VRF",
    address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    privateKey: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"
  },
  {
    id: "juror5",
    role: "⚖️ Juror 5",
    shortRole: "Juror 5",
    permissions: "Staked VRF Pool Member — Can vote & download evidence ONLY when selected by VRF",
    address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    privateKey: "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"
  }
];

export function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedWalletId, setSelectedWalletId] = useState("funder");
  const [currentAccount, setCurrentAccount] = useState(DEMO_WALLETS[1].address);
  const [currentRoleLabel, setCurrentRoleLabel] = useState(DEMO_WALLETS[1].role);
  const [ethBalance, setEthBalance] = useState("100.000");
  const [chainId, setChainId] = useState(31337);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [alert, setAlert] = useState(null);

  // Shared cross-tab workflow state
  const [resetKey, setResetKey] = useState(0);
  const [latestSubmissionId, setLatestSubmissionId] = useState(
    "0x820f4d1a28d5e6ef73c8a70ff08f46adb9fc2c20effeacf694b9b7a80d7aee1c"
  );
  const [activeBountyId, setActiveBountyId] = useState("1");
  const [activeDisputeId, setActiveDisputeId] = useState("1");

  const triggerAlert = useCallback((message, type = "info") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  }, []);

  const refreshBalance = useCallback(async (rpcProvider, address) => {
    if (!rpcProvider || !address) return;
    try {
      const bal = await rpcProvider.getBalance(address);
      setEthBalance(Number(ethers.formatEther(bal)).toFixed(3));
    } catch (_) {}
  }, []);

  const selectDemoWallet = useCallback(
    async (walletId, existingProvider) => {
      const rpc =
        existingProvider ||
        provider ||
        new ethers.JsonRpcProvider(SUPPORTED_CHAINS[31337].rpcUrl);
      const found = DEMO_WALLETS.find((w) => w.id === walletId) || DEMO_WALLETS[0];
      const walletSigner = new ethers.Wallet(found.privateKey, rpc);

      setSelectedWalletId(found.id);
      setCurrentAccount(walletSigner.address);
      setCurrentRoleLabel(found.role);
      setChainId(31337);
      setProvider(rpc);
      setSigner(walletSigner);
      await refreshBalance(rpc, walletSigner.address);
    },
    [provider, refreshBalance]
  );

  useEffect(() => {
    const rpcProvider = new ethers.JsonRpcProvider(SUPPORTED_CHAINS[31337].rpcUrl);
    selectDemoWallet("funder", rpcProvider);

    rpcProvider
      .send("verileaks_getStateSummary", [])
      .then((summary) => {
        if (summary?.submissions?.length > 0) {
          const last = summary.submissions[summary.submissions.length - 1];
          setLatestSubmissionId(last.submissionId);
        }
      })
      .catch(() => {});
  }, []);

  const handleRoleChange = async (walletId) => {
    await selectDemoWallet(walletId);
    const found = DEMO_WALLETS.find((w) => w.id === walletId);
    if (found) {
      triggerAlert(
        `Switched active role to ${found.role} — ${found.permissions}`,
        "info"
      );
    }
  };

  const handleResetDemoData = async () => {
    if (!provider) return;
    try {
      await provider.send("verileaks_resetState", [false]);
      const summary = await provider.send("verileaks_getStateSummary", []);
      if (summary?.submissions?.length > 0) {
        setLatestSubmissionId(summary.submissions[summary.submissions.length - 1].submissionId);
      }
      setActiveBountyId("1");
      setActiveDisputeId("1");
      setResetKey((k) => k + 1);
      await selectDemoWallet(selectedWalletId || "whistleblower", provider);
      triggerAlert(
        "All testing data reset! Wallets restored to 100 ETH, Jurors restored to 2.0 ETH stake, and Bounties/Disputes cleared.",
        "success"
      );
    } catch (err) {
      triggerAlert("Failed to reset chain state: " + err.message, "error");
    }
  };

  const activeWalletMeta = DEMO_WALLETS.find((w) => w.id === selectedWalletId) || DEMO_WALLETS[0];
  const isSupportedNetwork = chainId ? Boolean(SUPPORTED_CHAINS[chainId]) : true;

  return (
    <div>
      {/* Top Navigation Bar */}
      <header className="navbar" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="brand-title">
            <span>🛡️ VeriLeaks</span>
          </div>
          <span className="brand-badge">RBAC Interactive Demo</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Network Status Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: isSupportedNetwork ? "var(--success)" : "var(--danger)"
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>
              {SUPPORTED_CHAINS[chainId]?.name || `Chain ${chainId}`}
            </span>
          </div>

          {/* Interactive Role / Wallet Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                fontWeight: 600
              }}
            >
              Active Role:
            </label>
            <select
              className="form-input"
              style={{
                padding: "6px 12px",
                fontSize: "0.85rem",
                width: "auto",
                minWidth: "250px",
                borderColor: "var(--primary)",
                background: "rgba(99, 102, 241, 0.12)"
              }}
              value={selectedWalletId}
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              {DEMO_WALLETS.map((w) => (
                <option key={w.id} value={w.id} style={{ background: "#111827", color: "#fff" }}>
                  {w.role} — {w.address.substring(0, 6)}...{w.address.substring(38)}
                </option>
              ))}
            </select>
          </div>

          {/* Active Address & Live Balance Badge */}
          {currentAccount && (
            <div
              className="mono"
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                padding: "6px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                fontSize: "0.82rem",
                color: "var(--success)",
                fontWeight: 600
              }}
              title={currentAccount}
            >
              {ethBalance} ETH
            </div>
          )}

          {/* One-Click Reset Testing Data Button */}
          <button
            className="btn btn-outline"
            style={{
              padding: "6px 12px",
              fontSize: "0.8rem",
              borderColor: "var(--warning)",
              color: "var(--warning)"
            }}
            onClick={handleResetDemoData}
            title="Clear all Bounties, Disputes, Votes and restore all Wallet & Juror balances"
          >
            🔄 Reset Demo Data
          </button>
        </div>
      </header>

      {/* Role Permissions Banner */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.9)",
          borderBottom: "1px solid var(--border-color)",
          padding: "8px 32px",
          fontSize: "0.82rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px"
        }}
      >
        <div>
          <span style={{ color: "var(--text-muted)" }}>Current Role Permissions: </span>
          <strong style={{ color: "var(--accent-cyan)" }}>{activeWalletMeta.role}</strong> —{" "}
          <span style={{ color: "#e2e8f0" }}>{activeWalletMeta.permissions}</span>
        </div>
        <div className="mono" style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
          Address: {currentAccount}
        </div>
      </div>

      {/* Tabs Menu */}
      <nav className="tabs-nav">
        {[
          { id: "overview", label: "Protocol Overview" },
          { id: "bounties", label: "1. Bounties & Escrow (Funder)" },
          { id: "submit", label: "2. Submit Evidence (Whistleblower)" },
          { id: "staking", label: "3. Juror Staking" },
          { id: "arbitration", label: "4. Arbitration & Voting" },
          { id: "watchtowers", label: "5. Watchtower Cluster" }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Alert Banner */}
      {alert && (
        <div style={{ padding: "0 32px", marginTop: "16px" }}>
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "var(--radius-md)",
              background:
                alert.type === "error"
                  ? "rgba(239, 68, 68, 0.2)"
                  : alert.type === "success"
                  ? "rgba(16, 185, 129, 0.2)"
                  : "rgba(99, 102, 241, 0.2)",
              border: `1px solid ${
                alert.type === "error"
                  ? "var(--danger)"
                  : alert.type === "success"
                  ? "var(--success)"
                  : "var(--primary)"
              }`,
              color: "#ffffff",
              fontSize: "0.9rem"
            }}
          >
            {alert.message}
          </div>
        </div>
      )}

      {/* Main Tab Views */}
      <main className="container" key={resetKey}>
        {activeTab === "overview" && <LandingTab onSelectTab={setActiveTab} />}
        {activeTab === "submit" && (
          <SubmitTab
            signer={signer}
            provider={provider}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            currentRoleLabel={currentRoleLabel}
            selectedWalletId={selectedWalletId}
            activeBountyId={activeBountyId}
            onSwitchRole={handleRoleChange}
            onSubmissionRegistered={(subId, bId) => {
              setLatestSubmissionId(subId);
              if (bId) setActiveBountyId(String(bId));
              refreshBalance(provider, currentAccount);
            }}
            onProceedToBounty={() => setActiveTab("bounties")}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "bounties" && (
          <BountyTab
            signer={signer}
            provider={provider}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            currentRoleLabel={currentRoleLabel}
            selectedWalletId={selectedWalletId}
            onSwitchRole={handleRoleChange}
            latestSubmissionId={latestSubmissionId}
            activeBountyId={activeBountyId}
            setActiveBountyId={setActiveBountyId}
            onDisputeCreated={(dId) => {
              setActiveDisputeId(String(dId));
              refreshBalance(provider, currentAccount);
            }}
            onGoToArbitration={(dId) => {
              if (dId) setActiveDisputeId(String(dId));
              setActiveTab("arbitration");
            }}
            onGoToSubmit={(bId) => {
              if (bId) setActiveBountyId(String(bId));
              handleRoleChange("whistleblower");
              setActiveTab("submit");
            }}
            onBalanceChange={() => refreshBalance(provider, currentAccount)}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "staking" && (
          <StakingTab
            signer={signer}
            provider={provider}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            currentRoleLabel={currentRoleLabel}
            selectedWalletId={selectedWalletId}
            onSwitchRole={handleRoleChange}
            onBalanceChange={() => refreshBalance(provider, currentAccount)}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "arbitration" && (
          <ArbitrationTab
            signer={signer}
            provider={provider}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            currentRoleLabel={currentRoleLabel}
            selectedWalletId={selectedWalletId}
            onSwitchRole={handleRoleChange}
            activeDisputeId={activeDisputeId}
            setActiveDisputeId={setActiveDisputeId}
            onGoToBounties={(bId) => {
              if (bId) setActiveBountyId(String(bId));
              setActiveTab("bounties");
            }}
            onGoToStaking={() => setActiveTab("staking")}
            onBalanceChange={() => refreshBalance(provider, currentAccount)}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "watchtowers" && <WatchtowerTab />}
      </main>
    </div>
  );
}
