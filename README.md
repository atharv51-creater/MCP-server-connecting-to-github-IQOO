# AgentBridge MCP Server

Bridges GitHub webhooks + an AI coding agent's git actions to a mobile app,
via phone-issued approve/commit/push/pull commands.

## Setup

npm install
cp .env.example .env   # then edit ALLOWED_REPO_ROOT to point at your repo's parent dir
npm run build
npm start

## Endpoints

- POST /webhooks/github  — point your GitHub repo webhook here (same secret as .env)
- POST /action           — phone app calls this on Approve/Reject tap: { actionId, decision }
- GET  /health           — liveness check
- ALL  /mcp              — MCP endpoint for the AI agent (Claude Code, etc.) to call tools:
                            git_status, get_diff, request_commit, request_push, request_pull
- WS   /ws                — phone app connects here to receive live action notifications

## Important: ALLOWED_REPO_ROOT

The server refuses to run git commands outside this directory (path-traversal
guard, tested). Set it to the folder that CONTAINS your demo repo, and pass
the repo's folder name as `repoPath` in tool calls / webhook payloads.

## Tested end-to-end (see conversation log)

- Real git status/diff/commit/push/pull against a live repo
- Path-escape rejection
- GitHub webhook HMAC signature verification (forged + valid cases)
- Full loop: MCP tool call -> phone WebSocket notification -> phone
  approves via /action -> real `git push` lands on the remote
