import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, SUPPORTED_CHAINS } from "./contracts/config.js";
import { LandingTab } from "./components/LandingTab.jsx";
import { SubmitTab } from "./components/SubmitTab.jsx";
import { BountyTab } from "./components/BountyTab.jsx";
import { StakingTab } from "./components/StakingTab.jsx";
import { ArbitrationTab } from "./components/ArbitrationTab.jsx";
import { WatchtowerTab } from "./components/WatchtowerTab.jsx";

export function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [currentAccount, setCurrentAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [alert, setAlert] = useState(null);

  // Initialize read-only provider initially
  useEffect(() => {
    const fallbackProvider = new ethers.JsonRpcProvider(
      SUPPORTED_CHAINS[31337].rpcUrl
    );
    setProvider(fallbackProvider);

    // Auto-detect existing wallet
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
        if (accounts && accounts.length > 0) {
          connectWallet();
        }
      }).catch(() => {});

      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          connectWallet();
        } else {
          disconnectWallet();
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      triggerAlert("No Web3 wallet detected. Please install MetaMask.", "error");
      return;
    }
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const activeSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      setCurrentAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setProvider(browserProvider);
      setSigner(activeSigner);
      triggerAlert(`Connected wallet: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`, "success");
    } catch (err) {
      triggerAlert(err.message || "Failed to connect wallet", "error");
    }
  };

  const disconnectWallet = () => {
    setCurrentAccount(null);
    setSigner(null);
    const fallbackProvider = new ethers.JsonRpcProvider(SUPPORTED_CHAINS[31337].rpcUrl);
    setProvider(fallbackProvider);
  };

  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) return;
    const hexChainId = "0x" + targetChainId.toString(16);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }]
      });
    } catch (err) {
      triggerAlert(`Could not switch network: ${err.message}`, "error");
    }
  };

  const triggerAlert = (message, type = "info") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const isSupportedNetwork = chainId ? Boolean(SUPPORTED_CHAINS[chainId]) : true;

  return (
    <div>
      {/* Top Navigation Bar */}
      <header className="navbar">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="brand-title">
            <span>🛡️ VeriLeaks</span>
          </div>
          <span className="brand-badge">Phase 3 DApp</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {chainId && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: isSupportedNetwork ? "var(--success)" : "var(--danger)"
                }}
              />
              <span style={{ color: "var(--text-muted)" }}>
                {SUPPORTED_CHAINS[chainId]?.name || `Unsupported Chain (${chainId})`}
              </span>
              {!isSupportedNetwork && (
                <button
                  className="btn btn-outline"
                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  onClick={() => switchNetwork(421614)}
                >
                  Switch to Sepolia
                </button>
              )}
            </div>
          )}

          {currentAccount ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div
                className="mono"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  padding: "8px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  fontSize: "0.88rem"
                }}
              >
                {currentAccount.substring(0, 6)}...{currentAccount.substring(38)}
              </div>
              <button className="btn btn-outline" onClick={disconnectWallet}>
                Disconnect
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Tabs Menu */}
      <nav className="tabs-nav">
        {[
          { id: "overview", label: "Protocol Overview" },
          { id: "submit", label: "Submit Evidence" },
          { id: "bounties", label: "Bounties & Escrow" },
          { id: "staking", label: "Juror Staking" },
          { id: "arbitration", label: "Arbitration & Voting" },
          { id: "watchtowers", label: "Watchtower Cluster" }
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
      <main className="container">
        {activeTab === "overview" && <LandingTab onSelectTab={setActiveTab} />}
        {activeTab === "submit" && (
          <SubmitTab
            signer={signer}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "bounties" && (
          <BountyTab
            signer={signer}
            provider={provider}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "staking" && (
          <StakingTab
            signer={signer}
            provider={provider}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "arbitration" && (
          <ArbitrationTab
            signer={signer}
            provider={provider}
            contractAddresses={CONTRACT_ADDRESSES}
            currentAccount={currentAccount}
            onAlert={triggerAlert}
          />
        )}
        {activeTab === "watchtowers" && <WatchtowerTab />}
      </main>
    </div>
  );
}
