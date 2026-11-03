---
name: ticket-to-pr
description: Start only for explicit invocation of the ticket-to-pr recipe or its authorized grant-bound unattended entry. Never select for ordinary ticket reading, implementation, branch work, feedback, or pull-request requests, even when they describe the same delivery outcome. This explicit shortcut delegates one ticket to Adaptive Goal with a new branch, TDD, one PR and green required CI.
disable-model-invocation: true
---

# Ticket to PR

Expand this explicit shortcut into one Adaptive Goal request in this thread.
Require explicit recipe invocation or the authorized unattended entry. Ordinary
engineering intent and later feedback do not start this recipe.

Before discovering Adaptive Goal, require one exact ticket ID or URL. For missing
or competing references, ask the user which ticket to use and end the response.
Treat the chosen reference as opaque; Adaptive Goal reads it.
For an authorized unattended entry, first read [unattended.md](references/unattended.md).

Find one host-advertised Adaptive Goal orchestration capability, starting with
the skill catalog, regardless of its name. For a skill, read its complete
instructions and follow them here; otherwise use its advertised interface in
this thread. Pass this request, preserving the ticket and every caller option:

> Read ticket `<ticket>` in the current repository and implement it on a new
> ticket-linked branch using TDD. Verify the change, create the intended
> Conventional Commit or commits, push without force, and open or reuse one
> verified PR. Hand over with required CI checks green on its final commit.
> Use a linked worktree only if requested. Preserve existing user work.
>
> Every handover after publication, including a CI blocker, must include the PR
> URL and published commit/CI evidence. Completion requires its open head and
> remote branch to match the intended verified commit, and passing required CI.
> Pending, failed, unavailable, absent or stale checks do not establish green CI;
> report the limitation when it cannot be established.

The invocation authorizes reading that ticket, branch preparation, scoped
implementation and verification, commits, non-force push and one PR. When the
ticket or verification contract requires reviewer-facing evidence, it also
authorizes one candidate-bound evidence publication to that exact PR and commit;
partial, ambiguous, refused or changed-head results block completion and recovery.
Pass these limits with the request: no merge, auto-merge, deployment, release,
ticket mutation, reviewer assignment, labels, milestones, history rewriting,
discarding or stashing user work, unrelated changes, generic comments, evidence
on another PR, uncertain evidence retries, or other external effects.

Caller options override defaults and pass through unchanged, including base,
worktree, draft state and repair/review limits. Add no workflow, capability names,
routes or repair policy. Adaptive Goal and its bound capabilities own execution,
CI observation, repairs and completion.

If no single compatible orchestrator is available, return `Status: launch_required`
and identify the missing or ambiguous boundary without mutation. A native goal
control alone is not that capability; a listed skill needs no same-named tool.

For a skill, the handoff is reading and following it in this main thread.
Do not spawn an overall owner or perform recipe-owned preflight or delivery.
Relay its question, blocker or completion with the PR URL and commit/CI evidence.
Later feedback continues that same Adaptive Goal preflight or goal; do not
reinvoke the recipe or add another inspection, retry or controller.
