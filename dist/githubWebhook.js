import { Webhooks } from "@octokit/webhooks";
import { createPendingAction } from "./hub.js";
const webhooks = new Webhooks({
    secret: process.env.GITHUB_WEBHOOK_SECRET || "dev-secret-change-me",
});
// Push event: agent or teammate pushed commits upstream — just a
// heads-up notification, no action required.
webhooks.on("push", async ({ payload }) => {
    createPendingAction({
        type: "push",
        repoPath: ".",
        message: `New push to ${payload.ref} by ${payload.pusher?.name}: ${payload.head_commit?.message ?? "(no message)"}`,
        source: "github_webhook",
    });
});
// Pull request opened / synchronized — surface as an approve/reject
// action the phone can act on.
webhooks.on(["pull_request.opened", "pull_request.synchronize"], async ({ payload }) => {
    createPendingAction({
        type: "approve_change",
        repoPath: ".",
        message: `PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
        source: "github_webhook",
    });
});
// CI run finished — notify pass/fail so the phone can decide whether
// to pull the fix or re-run.
webhooks.on("workflow_run.completed", async ({ payload }) => {
    createPendingAction({
        type: "pull",
        repoPath: ".",
        message: `CI ${payload.workflow_run.conclusion} for ${payload.workflow_run.name}`,
        source: "github_webhook",
    });
});
export { webhooks };
