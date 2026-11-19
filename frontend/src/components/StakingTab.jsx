import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ABIS } from "../contracts/abis.js";

const JUROR_ROLES = [
  { id: "juror1", label: "Juror 1", address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" },
  { id: "juror2", label: "Juror 2", address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" },
  { id: "juror3", label: "Juror 3", address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9" },
  { id: "juror4", label: "Juror 4", address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955" },
  { id: "juror5", label: "Juror 5", address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f" }
];

export function StakingTab({
  signer,
  provider,
  contractAddresses,
  currentAccount,
  currentRoleLabel,
  selectedWalletId,
  onSwitchRole,
  onBalanceChange,
  onAlert
}) {
  const [stakeAmount, setStakeAmount] = useState("1.0");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const [balances, setBalances] = useState({
    totalStaked: "0",
    userTotal: "0",
    userLocked: "0",
    userFree: "0"
  });
  const [jurorPool, setJurorPool] = useState([]);

  const isJuror =
    selectedWalletId === "juror1" ||
    selectedWalletId === "juror2" ||
    selectedWalletId === "juror3" ||
    selectedWalletId === "juror4" ||
    selectedWalletId === "juror5";

  const loadBalances = useCallback(async () => {
    if (!provider || !contractAddresses.staking) return;
    try {
      const stakingContract = new ethers.Contract(
        contractAddresses.staking,
        ABIS.TokenStaking,
        provider
      );

      const total = await stakingContract.totalStaked();

      let userTot = 0n;
      let userLock = 0n;
      let userFr = 0n;

      if (currentAccount) {
        userTot = await stakingContract.balanceOf(currentAccount);
        userLock = await stakingContract.lockedOf(currentAccount);
        userFr = await stakingContract.freeBalanceOf(currentAccount);
      }

      setBalances({
        totalStaked: ethers.formatEther(total),
        userTotal: ethers.formatEther(userTot),
        userLocked: ethers.formatEther(userLock),
        userFree: ethers.formatEther(userFr)
      });

      const summary = await provider.send("verileaks_getStateSummary", []);
      if (summary?.jurors) {
        setJurorPool(summary.jurors);
      }
    } catch (err) {
      console.warn("Could not load staking balances:", err);
    }
  }, [provider, contractAddresses.staking, currentAccount]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const handleStake = async (e) => {
    e.preventDefault();
    if (!isJuror) {
      onAlert("Role Restricted: Only Juror roles can stake ETH into the VRF Juror Pool.", "error");
      return;
    }
    if (!signer) {
      onAlert("Please connect a wallet first.", "error");
      return;
    }
    try {
      setLoading(true);
      const contract = new ethers.Contract(
        contractAddresses.staking,
        ABIS.TokenStaking,
        signer
      );
      const tx = await contract.stake({ value: ethers.parseEther(stakeAmount) });
      await tx.wait(1);
      onAlert(`Successfully staked ${stakeAmount} ETH for ${currentRoleLabel}!`, "success");
      await loadBalances();
      if (onBalanceChange) onBalanceChange();
    } catch (err) {
      onAlert(err.message || "Staking failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (e) => {
    e.preventDefault();
    if (!isJuror) {
      onAlert("Role Restricted: Only Juror roles can withdraw staked ETH.", "error");
      return;
    }
    if (!signer) {
      onAlert("Please connect a wallet first.", "error");
      return;
    }
    try {
      setLoading(true);
      const contract = new ethers.Contract(
        contractAddresses.staking,
        ABIS.TokenStaking,
        signer
      );
      const tx = await contract.unstake(ethers.parseEther(unstakeAmount));
      await tx.wait(1);
      onAlert(`Successfully unstaked ${unstakeAmount} ETH to ${currentRoleLabel}!`, "success");
      setUnstakeAmount("");
      await loadBalances();
      if (onBalanceChange) onBalanceChange();
    } catch (err) {
      onAlert(err.message || "Unstaking failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Overview Cards */}
      <div className="grid-2" style={{ marginBottom: "24px" }}>
        <div className="glass-panel">
          <h3 style={{ color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase" }}>
            Protocol Global Stake
          </h3>
          <div style={{ fontSize: "2rem", fontWeight: "800", color: "#ffffff", marginTop: "8px" }}>
            {balances.totalStaked} ETH
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
            Aggregate ETH staked across all jurors in <code>TokenStaking.sol</code>
          </div>
        </div>

        <div className="glass-panel">
          <h3 style={{ color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase" }}>
            Active Role Stake ({currentRoleLabel})
          </h3>
          <div style={{ display: "flex", gap: "24px", marginTop: "8px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#ffffff" }}>
                {balances.userTotal} ETH
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total Stake</div>
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--accent-cyan)" }}>
                {balances.userFree} ETH
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Free (Withdrawable)</div>
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--warning)" }}>
                {balances.userLocked} ETH
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Locked in Disputes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live 3-Juror Pool & Slashing Comparison Table */}
      <div className="glass-panel" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "8px"
          }}
        >
          <h2>VRF Juror Pool — Live Staking & Slashing Ledger</h2>
          <button
            className="btn btn-outline"
            style={{ padding: "6px 12px", fontSize: "0.82rem" }}
            onClick={loadBalances}
          >
            Refresh Balances
          </button>
        </div>

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
                <th style={{ padding: "10px 8px" }}>Juror Persona</th>
                <th style={{ padding: "10px 8px" }}>Address</th>
                <th style={{ padding: "10px 8px" }}>Initial Stake</th>
                <th style={{ padding: "10px 8px" }}>Locked in Dispute</th>
                <th style={{ padding: "10px 8px" }}>Free Stake</th>
                <th style={{ padding: "10px 8px" }}>Current Total</th>
                <th style={{ padding: "10px 8px" }}>Net Penalty / Reward</th>
                <th style={{ padding: "10px 8px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {jurorPool.map((j, idx) => {
                const roleInfo = JUROR_ROLES[idx] || {
                  id: `juror${idx + 1}`,
                  label: `Juror ${idx + 1}`
                };
                const isSelected = currentAccount?.toLowerCase() === j.address.toLowerCase();
                const diff = Number(j.netDiffEth);
                return (
                  <tr
                    key={j.address}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: isSelected ? "rgba(99, 102, 241, 0.1)" : "transparent"
                    }}
                  >
                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>
                      {roleInfo.label}{" "}
                      {isSelected && <span className="badge badge-info">Active Role</span>}
                    </td>
                    <td style={{ padding: "12px 8px" }} className="mono">
                      {j.address.substring(0, 8)}...{j.address.substring(36)}
                    </td>
                    <td style={{ padding: "12px 8px" }}>2.000 ETH</td>
                    <td
                      style={{
                        padding: "12px 8px",
                        color: Number(j.lockedStake) > 0 ? "var(--warning)" : "var(--text-muted)"
                      }}
                    >
                      {Number(j.lockedStake).toFixed(3)} ETH
                    </td>
                    <td style={{ padding: "12px 8px", color: "var(--accent-cyan)" }}>
                      {Number(j.freeStake).toFixed(3)} ETH
                    </td>
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>
                      {Number(j.totalStaked).toFixed(3)} ETH
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        fontWeight: 700,
                        color:
                          diff > 0
                            ? "var(--success)"
                            : diff < 0
                            ? "var(--danger)"
                            : "var(--text-muted)"
                      }}
                    >
                      {diff > 0
                        ? `+${diff.toFixed(3)} ETH (Reward)`
                        : diff < 0
                        ? `${diff.toFixed(3)} ETH (Slashed)`
                        : "0.000 ETH"}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      {onSwitchRole && !isSelected && (
                        <button
                          className="btn btn-outline"
                          style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                          onClick={() => onSwitchRole(roleInfo.id)}
                        >
                          Switch Role
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Restriction Notice for Non-Jurors */}
      {!isJuror && (
        <div
          className="notice-card"
          style={{
            borderColor: "var(--danger)",
            background: "rgba(239, 68, 68, 0.1)",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div>
            <strong style={{ color: "var(--danger)" }}>
              🔒 Conflict-of-Interest Role Restriction (Current: {currentRoleLabel})
            </strong>
            <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>
              Whistleblowers, Bounty Funders, and Watchtowers cannot stake in the Juror Pool. Only
              Semaphore-verified Juror accounts (<strong>Juror 1, Juror 2, Juror 3</strong>) can
              deposit or withdraw stake.
            </div>
          </div>
          {onSwitchRole && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "8px 14px", fontSize: "0.82rem" }}
              onClick={() => onSwitchRole("juror1")}
            >
              Switch to ⚖️ Juror 1
            </button>
          )}
        </div>
      )}

      <div className="grid-2">
        {/* Stake Form */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Stake ETH into Juror Pool</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.92rem" }}>
            Jurors must stake ETH in <code>TokenStaking.sol</code> to back their Schelling votes.
            Each active dispute locks <code>1.0 ETH</code> per selected juror.
          </p>

          <form onSubmit={handleStake}>
            <div className="form-group">
              <label className="form-label">Stake Amount (ETH)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                className="form-input"
                required
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                disabled={!isJuror}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading || !isJuror}
            >
              {!isJuror
                ? "🔒 Disabled — Only Juror Roles Can Stake"
                : loading
                ? "Confirming..."
                : `Deposit ${stakeAmount} ETH Stake (${currentRoleLabel})`}
            </button>
          </form>
        </div>

        {/* Unstake Form */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Withdraw Unlocked Stake</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.92rem" }}>
            Jurors can withdraw any portion of their unlocked free stake (including earned consensus
            rewards) at any time. Locked stake in active disputes cannot be withdrawn.
          </p>

          <form onSubmit={handleUnstake}>
            <div className="form-group">
              <label className="form-label">
                Unstake Amount (Max Free: {balances.userFree} ETH)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balances.userFree}
                className="form-input"
                required
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                disabled={!isJuror}
              />
            </div>
            <button
              type="submit"
              className="btn btn-outline"
              style={{ width: "100%" }}
              disabled={loading || !isJuror || Number(balances.userFree) <= 0}
            >
              {!isJuror
                ? "🔒 Disabled — Only Juror Roles Can Unstake"
                : loading
                ? "Confirming..."
                : "Withdraw Free Stake to Wallet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
