---
name: ticket-to-pr
description: "Deliver one ticket as a pull request with green required CI."
disable-model-invocation: true
---

# Ticket to PR

Require one exact ticket ID or URL. Ask which ticket if the reference is missing
or ambiguous.

Follow the host-advertised Adaptive Goal skill (`darrow-adaptive-goal:adaptive-goal`)
in this thread. If no single compatible skill is available, report
`Status: launch_required` and the gap before mutation. Pass the exact ticket
reference and caller options unchanged. This invocation authorizes that handoff
and only the effects below.

1. Read the authoritative ticket.
2. Implement it on a new ticket-linked branch in the current repository using
   Adaptive Goal's defaults. Preserve user work. Apply principles-first reasoning
   during implementation. For behavior changes and bug fixes, use red/green TDD
   at a stable public seam.
3. After verification, create Conventional Commits, push without force, and open
   or reuse one verified PR. When the ticket or verification contract requires
   reviewer evidence, publish it once to that exact PR and commit under the
   evidence publisher's stop rules.
4. Finish only when the remote branch and open PR head match the intended
   verified commit and required CI passes on that commit. Report the PR URL,
   commit SHA and CI evidence after publication, including any blockers.

Continue questions, feedback and blockers in the same preflight or goal.
