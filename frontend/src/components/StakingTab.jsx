import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ABIS } from "../contracts/abis.js";

export function StakingTab({ signer, provider, contractAddresses, currentAccount, onAlert }) {
  const [stakeAmount, setStakeAmount] = useState("1.0");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const [balances, setBalances] = useState({
    totalStaked: "0",
    userTotal: "0",
    userLocked: "0",
    userFree: "0"
  });

  const loadBalances = async () => {
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
        userLock = await stakingContract.lockedBalanceOf(currentAccount);
        userFr = await stakingContract.freeBalanceOf(currentAccount);
      }

      setBalances({
        totalStaked: ethers.formatEther(total),
        userTotal: ethers.formatEther(userTot),
        userLocked: ethers.formatEther(userLock),
        userFree: ethers.formatEther(userFr)
      });
    } catch (err) {
      console.warn("Could not load staking balances:", err);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [currentAccount, provider, contractAddresses.staking]);

  const handleStake = async (e) => {
    e.preventDefault();
    if (!signer) {
      onAlert("Please connect your wallet first.", "error");
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
      onAlert(`Successfully staked ${stakeAmount} ETH!`, "success");
      await loadBalances();
    } catch (err) {
      onAlert(err.message || "Staking failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (e) => {
    e.preventDefault();
    if (!signer) {
      onAlert("Please connect your wallet first.", "error");
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
      onAlert(`Successfully unstaked ${unstakeAmount} ETH!`, "success");
      setUnstakeAmount("");
      await loadBalances();
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
            Aggregate ETH staked in <code>TokenStaking.sol</code>
          </div>
        </div>

        <div className="glass-panel">
          <h3 style={{ color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase" }}>
            Your Staking Position
          </h3>
          <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--accent-cyan)" }}>
                {balances.userFree} ETH
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Free Stake (Withdrawable)</div>
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--warning)" }}>
                {balances.userLocked} ETH
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Locked in Active Disputes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Stake Form */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Stake ETH into Juror Pool</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.92rem" }}>
            Jurors must stake tokens to become eligible for random selection via Chainlink VRF.
          </p>

          <form onSubmit={handleStake}>
            <div className="form-group">
              <label className="form-label">Stake Amount (ETH)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                required
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Confirming..." : "Deposit Stake"}
            </button>
          </form>
        </div>

        {/* Unstake Form */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Withdraw Unlocked Stake</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.92rem" }}>
            You can unstake any portion of your free balance at any time.
          </p>

          <form onSubmit={handleUnstake}>
            <div className="form-group">
              <label className="form-label">Unstake Amount (Max: {balances.userFree} ETH)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balances.userFree}
                className="form-input"
                required
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-outline"
              style={{ width: "100%" }}
              disabled={loading || Number(balances.userFree) <= 0}
            >
              {loading ? "Confirming..." : "Withdraw Free Stake"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
