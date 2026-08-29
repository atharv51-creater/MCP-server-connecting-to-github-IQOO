import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";

export type PendingAction = {
  id: string;
  type: "commit" | "push" | "pull" | "approve_change";
  repoPath: string;
  message?: string;
  source: "github_webhook" | "ai_agent";
  createdAt: string;
  status: "pending" | "executed" | "rejected" | "failed";
};

const pending = new Map<string, PendingAction>();
const clients = new Set<WebSocket>();

export function createPendingAction(input: Omit<PendingAction, "id" | "createdAt" | "status">) {
  const action: PendingAction = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  pending.set(action.id, action);
  broadcast({ event: "action_available", action });
  return action;
}

export function getPendingAction(id: string) {
  return pending.get(id);
}

export function updateActionStatus(id: string, status: PendingAction["status"]) {
  const action = pending.get(id);
  if (!action) return undefined;
  action.status = status;
  broadcast({ event: "action_updated", action });
  return action;
}

export function attachWebSocketServer(wss: WebSocketServer) {
  wss.on("connection", (ws) => {
    clients.add(ws);
    // Send current pending queue on connect so the phone app can render
    // any actions it missed while backgrounded.
    ws.send(
      JSON.stringify({
        event: "sync",
        pending: [...pending.values()].filter((a) => a.status === "pending"),
      })
    );
    ws.on("close", () => clients.delete(ws));
  });
}

function broadcast(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}
