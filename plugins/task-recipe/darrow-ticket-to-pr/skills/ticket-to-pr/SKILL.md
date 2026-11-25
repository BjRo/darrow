---
name: ticket-to-pr
description: "Deliver one ticket through implement and one Adaptive Goal: new branch, one verified PR, green required CI."
disable-model-invocation: true
---

# Ticket to PR

1. **Intake.** Require explicit invocation and one exact ticket ID or URL.
   Otherwise ask which ticket and stop before discovery. Keep references opaque;
   implement reads authoritative content.
2. **Delegate.** Starting with the skill catalog, find one host-advertised
   approved-work implementation recipe through one Adaptive Goal owner, regardless
   of name. Read and follow its public interface in this main thread. This
   invocation authorizes explicit-only composition; skills need no same-named tool.
   Missing or ambiguous: return `Status: launch_required` and the gap without mutation.
   Native goal controls and orchestration-only providers cannot substitute.
3. **Request.** Pass the ticket, caller options and this authority envelope:
   - Read and implement in the current repository on a new ticket-linked branch.
     Follow the selected implementation recipe. Preserve approved intent, seams,
     same-scope readiness, required providers, TDD, independent Review and acceptance
     accounting. Preserve provider refusals without fallback.
   - Create intended Conventional Commits, push without force, open or reuse one
     verified PR. Worktree only if requested; preserve user work.
   - Complete only when remote branch and open PR head match the intended verified
     commit with green required CI. Pending, failed, unavailable, absent or stale
     checks leave completion blocked. Every post-publication handover, including
     blockers, includes the PR URL, published commit/CI evidence and limitations.
   - When the ticket or verification contract requires reviewer evidence, authorize
     one candidate-bound publication to that exact PR and commit. Partial,
     ambiguous, refused or changed-head results block completion and recovery.
   - Exclude merge, auto-merge, deployment, release, ticket mutation, reviewer
     assignment, labels, milestones, history rewriting, discarding/stashing user
     work, unrelated changes, generic comments, other-PR evidence, uncertain
     evidence retries and other external effects.
4. **Continue.** Pass options unchanged, including base, worktree, draft and
   repair/review limits. Reuse inherited seam confirmation and readiness.
   Adaptive Goal owns execution, CI, repairs and completion. Relay its questions,
   blockers and results under the same envelope. Feedback continues the same
   preflight or goal without reinvocation.

Delegate only: no recipe-owned preflight, overall-owner spawn, controller,
workflow, capability names, routes, repair policy, delivery or post-goal inspection.
Use advertised interfaces, never sibling paths. Standalone Verification is not required.
