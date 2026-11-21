import React, { useState, useEffect } from "react";

const DEFAULT_NODES = [
  {
    id: "watchtower-node-1",
    name: "Watchtower 1 (Primary Active Executor)",
    roleDesc: "Primary transaction signer — executes finalize() & settle() immediately",
    url: "http://127.0.0.1:9101"
  },
  {
    id: "watchtower-node-2",
    name: "Watchtower 2 (Hot Standby Failover)",
    roleDesc: "Backup transaction signer — automatically takes over if Watchtower 1 crashes",
    url: "http://127.0.0.1:9102"
  },
  {
    id: "watchtower-node-3",
    name: "Watchtower 3 (Read-Only Audit Verifier)",
    roleDesc: "Zero-key independent auditor — verifies checkpoints & logs protocol compliance",
    url: "http://127.0.0.1:9103"
  }
];

export function WatchtowerTab() {
  const [nodesData, setNodesData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNodeStats = async () => {
    setRefreshing(true);
    const updated = [];
    let combinedAlerts = [];

    for (const node of DEFAULT_NODES) {
      try {
        const resHealth = await fetch(`${node.url}/health`, {
          signal: AbortSignal.timeout(1500)
        });
        const health = resHealth.ok ? await resHealth.json() : null;

        const resStatus = await fetch(`${node.url}/status`, {
          signal: AbortSignal.timeout(1500)
        });
        const status = resStatus.ok ? await resStatus.json() : null;

        const resAlerts = await fetch(`${node.url}/alerts`, {
          signal: AbortSignal.timeout(1500)
        });
        const nodeAlerts = resAlerts.ok ? await resAlerts.json() : [];

        combinedAlerts = [...combinedAlerts, ...nodeAlerts];

        const isCrashed = Boolean(health?.crashed || health?.status === "crashed");

        updated.push({
          ...node,
          online: !isCrashed,
          crashed: isCrashed,
          checkpoint: health?.checkpoint || 0,
          uptime: health?.uptime || 0,
          disputes: status?.disputes || 0,
          bounties: status?.bounties || 0,
          lastSync: health?.lastSyncTime || "N/A"
        });
      } catch (_) {
        updated.push({
          ...node,
          online: false,
          crashed: false,
          checkpoint: 0,
          uptime: 0,
          disputes: 0,
          bounties: 0,
          lastSync: "Offline / Unreachable"
        });
      }
    }

    combinedAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    setNodesData(updated);
    setAlerts(combinedAlerts.slice(0, 40));
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNodeStats();
    const interval = setInterval(fetchNodeStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleCrash = async (node) => {
    try {
      const endpoint = node.crashed ? "/simulate-recover" : "/simulate-crash";
      await fetch(`${node.url}${endpoint}`, { method: "POST" });
      await fetchNodeStats();
    } catch (err) {
      console.error("Could not toggle node crash state:", err);
    }
  };

  const actionAlerts = alerts.filter(
    (a) =>
      a.level === "ACTION" ||
      a.message.includes("Successfully executed") ||
      a.message.includes("SIMULATED NODE CRASH") ||
      a.message.includes("NODE RECOVERED") ||
      a.message.includes("[Preflight Check]")
  );

  return (
    <div>
      <div className="notice-card">
        <strong>🛡️ Watchtower Fault-Tolerance & Crash-Recovery Demo Guide:</strong>
        <p style={{ marginTop: "4px", fontSize: "0.9rem" }}>
          To demonstrate failover to your professor: before revealing the 3rd juror's vote in{" "}
          <strong>4. Arbitration & Voting</strong>, click{" "}
          <strong>"💥 Simulate Crash (Stop Node 1)"</strong> below. When you reveal the 3rd vote,{" "}
          <strong>Watchtower 2 (Hot Standby Failover)</strong> will automatically detect that Node 1
          is offline and execute <code>finalize()</code> and <code>settle()</code>! Then click{" "}
          <strong>"🔄 Recover Node 1 from Checkpoint"</strong> to watch Node 1 resume from its
          atomic checkpoint on disk and safely skip duplicate execution via its on-chain preflight
          check.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px"
        }}
      >
        <h2>Live 3-Node Watchtower Cluster Status</h2>
        <button className="btn btn-outline" onClick={fetchNodeStats} disabled={refreshing}>
          {refreshing ? "Polling..." : "Refresh Status"}
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: "28px" }}>
        {nodesData.map((node) => (
          <div
            key={node.id}
            className="glass-panel"
            style={{
              borderColor: node.crashed
                ? "var(--danger)"
                : node.online
                ? "var(--border-color)"
                : "var(--warning)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px"
              }}
            >
              <h3>{node.name}</h3>
              <span className={`badge ${node.online ? "badge-success" : "badge-danger"}`}>
                {node.crashed ? "💥 Crashed (Halted)" : node.online ? "🟢 Online" : "Offline"}
              </span>
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: "12px"
              }}
            >
              {node.roleDesc}
            </div>

            <div
              style={{
                fontSize: "0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginBottom: "14px"
              }}
            >
              <div>
                <strong>Persisted Block Checkpoint:</strong> #{node.checkpoint}
              </div>
              <div>
                <strong>Uptime:</strong> {node.uptime}s
              </div>
              <div>
                <strong>Monitored Disputes:</strong> {node.disputes}
              </div>
              <div>
                <strong>Monitored Bounties:</strong> {node.bounties}
              </div>
              <div>
                <strong>Last Sync:</strong>{" "}
                <span style={{ color: node.crashed ? "var(--danger)" : "inherit" }}>
                  {node.lastSync}
                </span>
              </div>
              <div>
                <strong>Endpoint:</strong> <code className="mono">{node.url}</code>
              </div>
            </div>

            {/* Fault Injection Controls: Crash / Recover */}
            <button
              type="button"
              className={node.crashed ? "btn btn-primary" : "btn btn-outline"}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: "0.82rem",
                borderColor: node.crashed ? "var(--success)" : "var(--danger)",
                color: node.crashed ? "#fff" : "#fca5a5"
              }}
              onClick={() => handleToggleCrash(node)}
            >
              {node.crashed
                ? `🔄 Recover ${node.id} & Resume from Checkpoint #${node.checkpoint}`
                : `💥 Simulate Crash (Stop ${node.id})`}
            </button>
          </div>
        ))}
      </div>

      <div className="glass-panel" style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "12px", color: "var(--accent-cyan)" }}>
          ⚡ Automated Settlement, Failover & Preflight Events
        </h3>
        {actionAlerts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {actionAlerts.map((al) => (
              <div
                key={al.id}
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-sm)",
                  background:
                    al.level === "ERROR"
                      ? "rgba(239, 68, 68, 0.14)"
                      : "rgba(99, 102, 241, 0.14)",
                  borderLeft: `4px solid ${
                    al.level === "ERROR" ? "var(--danger)" : "var(--primary)"
                  }`,
                  fontSize: "0.88rem"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: al.level === "ERROR" ? "#fca5a5" : "var(--accent-cyan)",
                    fontWeight: 700
                  }}
                >
                  <span className="mono">[{al.level}]</span>
                  <span>{new Date(al.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ marginTop: "4px", color: "#ffffff", fontWeight: 500 }}>
                  {al.message}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
            No automated transactions or fault events triggered yet. Complete the 3-Juror Commit &
            Reveal voting in <strong>4. Arbitration & Voting</strong> (or click{" "}
            <strong>Simulate Crash</strong> above) to watch automated failover in action!
          </div>
        )}
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: "16px" }}>
          Multi-Node Operational Log & Alert Stream (Nodes 1, 2 & 3)
        </h3>
        {alerts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {alerts.map((al) => (
              <div
                key={al.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(10, 14, 23, 0.6)",
                  borderLeft: `3px solid ${
                    al.level === "ACTION"
                      ? "var(--primary)"
                      : al.level === "ERROR"
                      ? "var(--danger)"
                      : al.level === "WARN"
                      ? "var(--warning)"
                      : "var(--accent-cyan)"
                  }`,
                  fontSize: "0.85rem"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "var(--text-muted)"
                  }}
                >
                  <span className="mono">[{al.level}]</span>
                  <span>{new Date(al.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ marginTop: "4px", color: "var(--text-main)" }}>{al.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>
            Start the watchtower simulation (<code>npm start</code>) to stream live events and
            actions.
          </div>
        )}
      </div>
    </div>
  );
}
