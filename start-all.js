import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);

// 1. Free any stale processes occupying ports 8545, 3000, 5173, 5174, 9101, 9102, 9103
const targetPorts = [8545, 3000, 5173, 5174, 9101, 9102, 9103];
try {
  const netstatOut = execSync("netstat -ano -p tcp", { encoding: "utf8" });
  const pidsToKill = new Set();
  for (const line of netstatOut.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;
    const parts = line.trim().split(/\s+/);
    const localAddr = parts[1] || "";
    const pid = Number(parts[parts.length - 1]);
    for (const port of targetPorts) {
      if (localAddr.endsWith(`:${port}`) && pid && pid !== process.pid) {
        pidsToKill.add(pid);
      }
    }
  }
  for (const pid of pidsToKill) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      console.log(`Freed stale process PID ${pid}`);
    } catch (_) {}
  }
} catch (_) {}

// 2. Clean stale watchtower checkpoints so they sync fresh with the live RPC
try {
  const wtDir = path.join(rootDir, ".data", "watchtowers");
  if (fs.existsSync(wtDir)) {
    fs.rmSync(wtDir, { recursive: true, force: true });
  }
} catch (_) {}

const procs = [];

function startService(name, cmd, args, cwd = rootDir) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  child.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`));
  procs.push(child);
  return child;
}

// 3. Start Stateful VeriLeaks EVM JSON-RPC on 127.0.0.1:8545
startService("RPC-8545", process.execPath, [path.join(rootDir, "mock-rpc.js")], rootDir);

// 4. Start Privacy Upload Proxy on 127.0.0.1:3000
startService("PROXY-3000", process.execPath, ["src/server.js"], rootDir);

// 5. Start 3-Node Watchtower Cluster on 127.0.0.1:9101-9103
setTimeout(() => {
  startService("WATCHTOWER", process.execPath, ["src/watchtower/cli.js", "--cluster"], rootDir);
}, 1000);

// 6. Start Vite Frontend on http://127.0.0.1:5173
startService(
  "FRONTEND-5173",
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
  path.join(rootDir, "frontend")
);

process.on("SIGINT", () => {
  for (const p of procs) {
    try {
      p.kill();
    } catch (_) {}
  }
  process.exit(0);
});
