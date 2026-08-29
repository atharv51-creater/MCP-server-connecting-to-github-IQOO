import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { webhooks } from "./githubWebhook.js";
import { buildMcpServer } from "./mcpTools.js";
import { attachWebSocketServer, getPendingAction, updateActionStatus } from "./hub.js";
import { gitCommit, gitPush, gitPull } from "./gitOps.js";

const app = express();

// IMPORTANT: the GitHub webhook route needs the raw, unparsed request
// body to verify the HMAC signature — it must be registered with its
// own express.raw() BEFORE the global express.json() middleware below,
// otherwise json() consumes the stream first and signature checks will
// always fail against an empty body.
app.post("/webhooks/github", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    await webhooks.verifyAndReceive({
      id: req.headers["x-github-delivery"] as string,
      name: req.headers["x-github-event"] as any,
      signature: req.headers["x-hub-signature-256"] as string,
      payload: req.body.toString(),
    });
    res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook verification failed:", err);
    res.status(400).send("invalid signature");
  }
});

app.use(express.json());

// --- Phone action relay ---
// The mobile app POSTs here when the user taps Commit/Push/Pull/Approve/Reject
// on a notification (or issues the equivalent voice command).
app.post("/action", async (req, res) => {
  const { actionId, decision } = req.body as { actionId: string; decision: "approve" | "reject" };
  const action = getPendingAction(actionId);
  if (!action) return res.status(404).json({ error: "action not found" });

  if (decision === "reject") {
    updateActionStatus(actionId, "rejected");
    return res.json({ status: "rejected" });
  }

  try {
    let result: unknown;
    if (action.type === "commit") result = await gitCommit(action.repoPath, action.message || "Update via AgentBridge");
    if (action.type === "push") result = await gitPush(action.repoPath);
    if (action.type === "pull") result = await gitPull(action.repoPath);
    updateActionStatus(actionId, "executed");
    res.json({ status: "executed", result });
  } catch (err) {
    updateActionStatus(actionId, "failed");
    res.status(500).json({ status: "failed", error: String(err) });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// --- MCP server over HTTP, for the AI agent (e.g. Claude Code) to call ---
// A fresh McpServer + transport is built per request: the SDK's Server
// only supports one active transport connection at a time, so reusing a
// single module-level instance across concurrent/successive requests
// throws ("Already connected to a transport") and crashes the process.
// This is stateless HTTP mode (sessionIdGenerator: undefined) — cheap to
// rebuild since buildMcpServer() just registers tool handlers.
app.all("/mcp", async (req, res) => {
  const mcpServer = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    mcpServer.close();
  });
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request handling failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal MCP error" });
  }
});

// --- HTTP + WebSocket server (WS for pushing live events to the phone) ---
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
attachWebSocketServer(wss);

// Safety net for the demo: log and survive instead of the whole process
// dying mid-pitch on an unexpected error.
process.on("uncaughtException", (err) => console.error("Uncaught exception (server stayed up):", err));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection (server stayed up):", err));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`AgentBridge MCP server listening on :${PORT}`);
  console.log(`  GitHub webhook: POST /webhooks/github`);
  console.log(`  Phone action relay: POST /action`);
  console.log(`  Phone WebSocket: ws://<host>:${PORT}/ws`);
  console.log(`  MCP endpoint (for AI agent): /mcp`);
});
