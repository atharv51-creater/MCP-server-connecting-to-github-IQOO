import { simpleGit } from "simple-git";
import path from "node:path";
// Resolve and guard the repo path so a phone-issued command can't
// point the server at an arbitrary filesystem location.
const ALLOWED_REPO_ROOT = process.env.ALLOWED_REPO_ROOT || process.cwd();
function resolveRepo(repoPath) {
    const resolved = path.resolve(ALLOWED_REPO_ROOT, repoPath || ".");
    if (!resolved.startsWith(path.resolve(ALLOWED_REPO_ROOT))) {
        throw new Error("Repo path escapes the allowed root — rejected.");
    }
    return simpleGit(resolved);
}
export async function gitStatus(repoPath) {
    const git = resolveRepo(repoPath);
    const status = await git.status();
    return {
        branch: status.current,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        notAdded: status.not_added,
    };
}
export async function gitDiff(repoPath, staged = false) {
    const git = resolveRepo(repoPath);
    const diff = staged ? await git.diff(["--staged"]) : await git.diff();
    return diff || "(no changes)";
}
export async function gitCommit(repoPath, message) {
    const git = resolveRepo(repoPath);
    await git.add(["-A"]);
    const result = await git.commit(message);
    return {
        commitHash: result.commit,
        summary: result.summary,
    };
}
export async function gitPush(repoPath, remote = "origin", branch) {
    const git = resolveRepo(repoPath);
    const currentBranch = branch || (await git.status()).current || "main";
    const result = await git.push(remote, currentBranch);
    return { remote, branch: currentBranch, result };
}
export async function gitPull(repoPath, remote = "origin", branch) {
    const git = resolveRepo(repoPath);
    const currentBranch = branch || (await git.status()).current || "main";
    const result = await git.pull(remote, currentBranch);
    return { remote, branch: currentBranch, summary: result.summary };
}
