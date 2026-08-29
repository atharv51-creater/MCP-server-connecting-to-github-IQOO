import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gitStatus, gitDiff, gitCommit, gitPush, gitPull } from "./gitOps.js";
import { createPendingAction, updateActionStatus, getPendingAction } from "./hub.js";
export function buildMcpServer() {
    const server = new McpServer({
        name: "agentbridge",
        version: "1.0.0",
    });
    server.tool("git_status", "Get the current git status of the working repo", { repoPath: z.string().default(".") }, async ({ repoPath }) => ({
        content: [{ type: "text", text: JSON.stringify(await gitStatus(repoPath)) }],
    }));
    server.tool("get_diff", "Get the current diff (staged or unstaged) so the agent or phone user can review before acting", { repoPath: z.string().default("."), staged: z.boolean().default(false) }, async ({ repoPath, staged }) => ({
        content: [{ type: "text", text: await gitDiff(repoPath, staged) }],
    }));
    // Rather than executing commit/push/pull immediately when the AI
    // agent calls the tool, we queue it as a pending action and notify
    // the phone — the phone's tap (or voice command) is what actually
    // triggers execution via /action. This keeps a human decision in
    // the loop for every state-changing git operation.
    server.tool("request_commit", "Ask for approval to commit the current changes. Sends an actionable notification to the phone.", { repoPath: z.string().default("."), message: z.string() }, async ({ repoPath, message }) => {
        const action = createPendingAction({
            type: "commit",
            repoPath,
            message,
            source: "ai_agent",
        });
        return { content: [{ type: "text", text: `Queued commit for phone approval: ${action.id}` }] };
    });
    server.tool("request_push", "Ask for approval to push committed changes. Sends an actionable notification to the phone.", { repoPath: z.string().default(".") }, async ({ repoPath }) => {
        const action = createPendingAction({
            type: "push",
            repoPath,
            source: "ai_agent",
        });
        return { content: [{ type: "text", text: `Queued push for phone approval: ${action.id}` }] };
    });
    server.tool("request_pull", "Ask for approval to pull latest changes. Sends an actionable notification to the phone.", { repoPath: z.string().default(".") }, async ({ repoPath }) => {
        const action = createPendingAction({
            type: "pull",
            repoPath,
            source: "ai_agent",
        });
        return { content: [{ type: "text", text: `Queued pull for phone approval: ${action.id}` }] };
    });
    server.tool("execute_approved_action", "Execute a pending action after the phone approved it (internal — called by the /action HTTP relay, not typically by the agent directly)", { actionId: z.string() }, async ({ actionId }) => {
        const action = getPendingAction(actionId);
        if (!action)
            return { content: [{ type: "text", text: "Action not found" }], isError: true };
        try {
            let result;
            if (action.type === "commit")
                result = await gitCommit(action.repoPath, action.message || "Update via AgentBridge");
            if (action.type === "push")
                result = await gitPush(action.repoPath);
            if (action.type === "pull")
                result = await gitPull(action.repoPath);
            updateActionStatus(actionId, "executed");
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }
        catch (err) {
            updateActionStatus(actionId, "failed");
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    return server;
}
