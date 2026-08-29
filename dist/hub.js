import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
const pending = new Map();
const clients = new Set();
export function createPendingAction(input) {
    const action = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: "pending",
    };
    pending.set(action.id, action);
    broadcast({ event: "action_available", action });
    return action;
}
export function getPendingAction(id) {
    return pending.get(id);
}
export function updateActionStatus(id, status) {
    const action = pending.get(id);
    if (!action)
        return undefined;
    action.status = status;
    broadcast({ event: "action_updated", action });
    return action;
}
export function attachWebSocketServer(wss) {
    wss.on("connection", (ws) => {
        clients.add(ws);
        // Send current pending queue on connect so the phone app can render
        // any actions it missed while backgrounded.
        ws.send(JSON.stringify({
            event: "sync",
            pending: [...pending.values()].filter((a) => a.status === "pending"),
        }));
        ws.on("close", () => clients.delete(ws));
    });
}
function broadcast(payload) {
    const data = JSON.stringify(payload);
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN)
            client.send(data);
    }
}
