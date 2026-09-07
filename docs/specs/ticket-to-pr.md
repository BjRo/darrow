# Task Recipe: Ticket to Pull Request

Darrow provides one explicitly invoked shortcut that turns one exact ticket
reference into the bounded delivery request a user would otherwise give
`adaptive-goal`: read and implement the ticket in the current repository on a
new branch, then open one verified pull request when the change is ready.

Plugin: `darrow-ticket-to-pr`  
Skill: `ticket-to-pr`

## Purpose

The recipe removes repetitive request wording. It owns only two things:

- the ticket-to-pull-request authority envelope; and
- one delegation to an available adaptive-goal capability.

Adaptive-goal owns ticket retrieval needed for preflight, readiness, capability
binding, route selection, the separate engineering owner, human-feedback
continuation, verification, review, publication execution, and completion.
The recipe is not another preflight or lifecycle layer.

## Invocation and input

The recipe starts only through explicit user invocation with exactly one ticket
ID or supplied ticket URL, for example:

```text
$ticket-to-pr <ticket>
```

Host-specific invocation syntax is a presentation detail. Ordinary requests to
read or implement a ticket, work on a branch, or open a pull request do not
activate this orchestration recipe implicitly.

The recipe accepts the exact reference as opaque input. It does not read the
ticket, validate its provider, derive a token, inspect the repository, choose a
branch name, or run readiness before delegation. A missing or ambiguous
reference produces one small request for an exact ID or URL and no delegation
or mutation.

Explicit user options such as a named base, linked worktree, or draft pull
request are preserved. The recipe never invents those choices.

## Delegated delivery request

The recipe invokes exactly one available capability whose advertised contract
is adaptive-goal orchestration. The explicit recipe invocation authorizes that
single delegation without requiring a second user invocation.

The delegated request preserves the exact ticket reference and directs the
adaptive goal to:

1. use the current repository and read exactly that ticket;
2. establish or reuse same-scope readiness before mutation;
3. implement the ready ticket while preserving existing user work;
4. create or reuse a new ticket-linked branch, or use a linked worktree only
   when explicitly requested;
5. run the applicable focused and final verification and any selected review;
6. create the intended Conventional Commit or commits;
7. push the branch without rewriting remote history; and
8. create or reuse exactly one pull request whose current content satisfies the
   ticket, ready for review unless draft was explicitly requested.

Verified publication includes owner-sourced repository, head/base, draft state
and intended commit evidence: both the remote branch and open PR head must equal
the commit for which final checks and selected review passed. An existing URL
alone is insufficient when local commits remain unpublished. Adaptive-goal binds
behaviorally compatible publication operations; the recipe chooses no command
or capability. Reuse authorizes a non-force content update, not PR metadata edits.

The request authorizes only those branch, commit, non-force push, and one-PR
effects. It excludes merge, auto-merge, deployment, release, ticket mutation,
reviewer assignment, labels, milestones, destructive Git operations, unrelated
changes, and any other external effect.

The recipe does not select workflow, risk, model, effort, route, readiness or
review policy, capability names, branch name, verification commands, or owner
protocol. It does not invoke ticket, readiness, Git, review, or forge
capabilities itself. Those are adaptive-goal preflight and owner concerns.

If no single unambiguous adaptive-goal capability is available, the recipe
stops without mutation and reports that the launch boundary is missing or
ambiguous.

## Main-thread feedback and completion

Ticket-to-PR remains in the main host thread as the caller of adaptive-goal. It
does not spawn an engineering agent itself. Once delegation begins,
adaptive-goal owns its one separate owner and every later continuation.

When that owner needs a human decision, adaptive-goal returns the question to
the main thread. The main thread shows it to the user and relays the user's
answer to the same retained owner. The ticket-to-PR recipe is not invoked again,
does not answer or rewrite the question, and does not replace the owner.

The recipe relays the adaptive-goal result without repository or forge
reinspection. Success requires the owner-sourced URL and evidence for exactly
one verified pull request. Preserve the complete URL and intended/published
commit evidence in the relay; a PR number alone does not satisfy completion.
A non-ready result, human-feedback request, or
blocker remains the adaptive goal's result and next action; the recipe adds no
retry, waiver, recovery, or status protocol.

## Invariants

1. **TPR-C1 — Explicit shortcut.** Only explicit Ticket-to-PR invocation starts
   the recipe; one exact ticket ID or URL is required.
2. **TPR-C2 — One delegation.** A valid invocation delegates exactly once to an
   advertised adaptive-goal capability and performs no delivery work first.
3. **TPR-C3 — Complete envelope.** Delegation preserves the exact reference,
   current repository, ready implementation outcome, new-branch intent,
   verification, intended commits, non-force push, exactly one verified pull
   request, explicit user options, and all publication exclusions.
4. **TPR-C4 — Adaptive ownership.** Adaptive-goal alone owns preflight,
   readiness, capability bindings, route and owner selection, implementation,
   review, publication execution, blockage, and completion.
5. **TPR-C5 — Main-thread human loop.** Questions reach the user through the
   main thread and answers return to the same adaptive owner without recipe
   reinvocation or a replacement owner.
6. **TPR-C6 — Preserved authority.** Delegation adds no effect beyond the
   explicitly authorized branch, commit, non-force push, and single pull
   request, and it preserves pre-existing work.
7. **TPR-C7 — Owner-sourced result.** The recipe relays completion, feedback, or
   blockage without post-goal inspection, repair, retry, or reconstruction.

## Packaging and evaluation

- **TPR-P1 — Independent plugin.** The plugin is self-contained and discovers
  optional capabilities only by host-advertised intent.
- **TPR-P2 — Dual-host semantics.** Claude Code and Codex expose the same input,
  authority, delegation, feedback, and completion behavior.
- **TPR-P3 — No runtime.** The plugin ships no controller, ledger, queue,
  lifecycle hooks, retry state, Git/forge implementation, or background work.

Behavior evals cover:

- direct explicit shortcut delegation using the harness-rendered invocation;
- missing or ambiguous ticket input before delegation;
- an unavailable or ambiguous adaptive-goal boundary with no fallback work;
- ordinary ticket or engineering intent that must not select the recipe;
- preservation of the complete authority envelope and explicit options;
- a material owner question answered through the main thread and relayed to the
  same owner; and
- owner-sourced completion or blockage with no recipe-owned reinspection.

Cross-host claims run on both native harnesses. Composition evals assert the
public boundary and repository outcome; adaptive-goal and capability suites own
their detailed readiness, routing, Git, review, publication, and retry cases.

## Non-goals

- Ticket-provider resolution, canonical-token handling, or branch naming.
- Recipe-owned readiness, repository preflight, workflow or risk selection.
- Direct implementation, verification, review, Git, or forge operations.
- A phase graph, lifecycle ledger, retry or waiver policy, recovery handoff,
  daemon, queue, scheduler, or durable workflow state.
- Merge, auto-merge, deployment, release, or tracker mutation.
