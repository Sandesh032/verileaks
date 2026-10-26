import React, { useState, useEffect } from "react";

const DEFAULT_NODES = [
  { id: "watchtower-node-1", name: "Watchtower 1 (Active)", url: "http://127.0.0.1:9101" },
  { id: "watchtower-node-2", name: "Watchtower 2 (Standby)", url: "http://127.0.0.1:9102" },
  { id: "watchtower-node-3", name: "Watchtower 3 (Audit)", url: "http://127.0.0.1:9103" }
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
        const resHealth = await fetch(`${node.url}/health`, { signal: AbortSignal.timeout(1500) });
        const health = resHealth.ok ? await resHealth.json() : null;

        const resStatus = await fetch(`${node.url}/status`, { signal: AbortSignal.timeout(1500) });
        const status = resStatus.ok ? await resStatus.json() : null;

        const resAlerts = await fetch(`${node.url}/alerts`, { signal: AbortSignal.timeout(1500) });
        const nodeAlerts = resAlerts.ok ? await resAlerts.json() : [];

        combinedAlerts = [...combinedAlerts, ...nodeAlerts];

        updated.push({
          ...node,
          online: true,
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
          checkpoint: 0,
          uptime: 0,
          disputes: 0,
          bounties: 0,
          lastSync: "Offline / Standby"
        });
      }
    }

    setNodesData(updated);
    setAlerts(combinedAlerts.slice(0, 20));
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNodeStats();
    const interval = setInterval(fetchNodeStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="notice-card">
        <strong>🛡️ Watchtower Network Architecture:</strong>
        <p style={{ marginTop: "4px" }}>
          Watchtower nodes independently index contract logs, detect expiration boundaries,
          and execute permissionless triggers (<code>finalize</code>, <code>settle</code>, <code>refund</code>).
          Running multiple instances on a development machine simulates node concurrency and recovery, but does not constitute geographic decentralization.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2>Live Watchtower Cluster Status</h2>
        <button className="btn btn-outline" onClick={fetchNodeStats} disabled={refreshing}>
          {refreshing ? "Polling..." : "Refresh Status"}
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: "32px" }}>
        {nodesData.map((node) => (
          <div key={node.id} className="glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3>{node.name}</h3>
              <span className={`badge ${node.online ? "badge-success" : "badge-danger"}`}>
                {node.online ? "Online" : "Offline"}
              </span>
            </div>

            <div style={{ fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div><strong>Block Checkpoint:</strong> {node.checkpoint}</div>
              <div><strong>Uptime:</strong> {node.uptime}s</div>
              <div><strong>Monitored Disputes:</strong> {node.disputes}</div>
              <div><strong>Monitored Bounties:</strong> {node.bounties}</div>
              <div><strong>Last Sync:</strong> {node.lastSync}</div>
              <div><strong>Endpoint:</strong> <code className="mono">{node.url}</code></div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: "16px" }}>Operational Log & Alert Stream</h3>
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
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                  <span className="mono">[{al.level}]</span>
                  <span>{new Date(al.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ marginTop: "4px", color: "var(--text-main)" }}>{al.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>
            Start the watchtower simulation (<code>npm run watchtower:cluster</code>) to stream live events and actions.
          </div>
        )}
      </div>
    </div>
  );
}
