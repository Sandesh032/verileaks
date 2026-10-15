import express from "express";
import multer from "multer";
import { createPinataProviderFromEnv } from "./storage/PinataStorageProvider.js";
import { MockStorageProvider } from "./storage/MockStorageProvider.js";

// Load .env if present
try {
  const { config } = await import("dotenv");
  config();
} catch (_) {}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

let storageProvider;
try {
  storageProvider = createPinataProviderFromEnv();
  console.log("Starting server with REAL Pinata IPFS provider");
} catch (err) {
  console.warn("Pinata credentials missing, falling back to MockStorageProvider");
  storageProvider = new MockStorageProvider();
}

app.post("/api/upload", upload.single("evidence"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: "No evidence file provided or file is empty." });
    }

    // Do NOT log req.file.buffer, IP addresses (which might be the Tor exit node or internal proxy),
    // or any other sensitive metadata.
    // console.log("Received upload request");

    const cid = await storageProvider.upload(req.file.buffer, req.file.originalname || "evidence");
    
    return res.status(200).json({ cid });
  } catch (err) {
    // Only log generic error message on the server
    console.error("Upload failed internally.");
    
    // Do NOT leak Pinata API keys or internal stack traces to the client
    return res.status(500).json({ error: "Internal server error during upload." });
  }
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const ok = await storageProvider.healthCheck();
    if (ok) {
      res.status(200).json({ status: "ok" });
    } else {
      res.status(503).json({ status: "degraded", error: "Storage provider health check failed" });
    }
  } catch (err) {
    res.status(500).json({ status: "error" });
  }
});

const PORT = process.env.PORT || 3000;
// Bind to 127.0.0.1 exclusively so it is only accessible via the local Tor proxy
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server listening on 127.0.0.1:${PORT}`);
  });
}

export { app };
