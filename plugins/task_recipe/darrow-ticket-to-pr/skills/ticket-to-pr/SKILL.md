---
name: ticket-to-pr
description: Deliver one authoritative ticket in the current repository as exactly one verified pull request. Use only when the user explicitly invokes ticket-to-pr; do not select it for ordinary ticket discussion, implementation, or pull-request requests.
disable-model-invocation: true
---

# Ticket to pull request

Deliver one authoritative ticket as exactly one verified, review-ready pull
request. Start only through explicit `/ticket-to-pr` or `$ticket-to-pr`
invocation.

## Bundled mechanics

Run the four repeatable, read-only mechanics through the bundled helper with
Bash. In commands below, `<skill-dir>` is the directory containing this file:

```sh
helper=<skill-dir>/../../bin/ticket-to-pr

bash "$helper" inspect-repository --repo <path> --base <ref> [--ticket-key <stable-key>]
bash "$helper" validate-launch --record <path> --adaptive-goal-children <count> --observed-children <count> --observed-route '<harness>|<provider>|<model>|<effort>' --observed-applied-by <value> --observed-boundary <value>
bash "$helper" verify-delivery --repo <path> --base <ref> --base-oid <oid> --branch <name> --head <oid> --remote <name> --remote-branch <name> [--preservation-record <inspection-path>]...
bash "$helper" render-result --ticket <id> --outcome <token> [evidence and durable-state options] [--launch-record <path> | --unvalidated-launch-record <path>]
```

Use the exact stable ticket key as the optional inspection query; do not derive
one from a URL or title. Save inspection output when later verification must
prove an original checkout unchanged. Save adaptive-goal's returned v4 block
byte-for-byte in a temporary file before launch validation or result rendering.
Do not recreate either record from expected values.

The helper reports facts and refuses mechanically invalid input. It never
decides authority, dirty-work ownership, ticket fulfillment, review outcome,
historical classification, publication authority, semantic outcome, or next
action. Make those decisions here from authoritative evidence. Never treat a
helper success as an acceptance or review judgment.

## Sequence

1. Resolve exactly one authoritative ticket or supplied specification.
2. Choose the deliberate base, inspect the current repository with the helper,
   and read applicable `AGENTS.md` and `CLAUDE.md` instructions.
3. Classify pre-existing work ownership and reconstruct ticket-correlated
   durable state from the reported candidates plus available forge evidence.
4. Return read-only only when authoritative input establishes a historical
   terminal boundary. Otherwise, if intake and repository safety pass, invoke
   and await exactly one compatible `adaptive-goal` skill.
5. Preserve and validate its v4 launch record against host-observed route and
   child facts. Let its one native goal owner perform every authorized delivery
   mutation.
6. After it returns, verify local delivery with the helper and independently
   judge ticket acceptance, review, and pull-request shape from current
   evidence without replaying mutations.
7. Classify one outcome and pass those already-classified facts to
   `render-result` for the terminal response. This rendering step is mandatory
   on every path, including prelaunch and historical terminal returns.

Except for the explicit prelaunch and historical paths below, a safe,
authoritative request always reaches step 4. The recipe parent does not replace
adaptive-goal with direct implementation, a readiness judgment, a generic goal
tool, or a generic subagent.

## 1. Resolve authoritative intake

Use authoritative ticket content supplied for this invocation. Otherwise
invoke one available capability whose public intent is to retrieve one exact
ticket without mutation. A stable identifier alone and a list-only capability
are not ticket content. When repository instructions declare an exact matching
read contract, invoke it rather than substituting a backend command.

Require one identifier, desired outcome, description, and observable acceptance
criteria; retain the canonical link when available. Do not choose among
alternative tickets, invent tracker precedence, combine contradictory sources,
or fetch through a hard-coded backend.

If no ticket was supplied, begin with:
`Missing input: exactly one ticket reference or one authoritative supplied specification is required.`
For missing, ambiguous, contradictory, or unreadable intake, select
`Outcome: stopped`, name the smallest required clarification, render the result,
and stop before repository or publication mutation. No launch record exists on
this path.

## 2. Establish repository safety and durable state

Use the current repository; never search for or clone another. Choose the
deliberate base from authoritative input and repository policy, then run
`inspect-repository`. The helper reports absolute primary/current worktree
paths, base and HEAD facts, remotes, worktrees, path classes, conflicts,
fingerprints, and lexical ticket candidates. It does not decide what belongs to
the ticket.

Read both present instruction entrypoints. Classify every staged, unstaged,
untracked, and conflicted path:

- Unrelated or ambiguous work is a terminal `stopped` result. Name the paths,
  say the work is preserved, and do not launch, branch, edit, stage, commit,
  push, publish, stash, reset, or switch.
- Ticket-owned work may continue only when authoritative ticket or repository
  evidence makes ownership unambiguous. Preserve it in the delegated contract.
- An explicitly requested linked worktree is the sole exception. Invoke only
  the exact compatible worktree contract declared by repository instructions,
  retain the original inspection record, and require `verify-delivery` to prove
  that checkout's branch, HEAD, index, status, and file-content fingerprints
  are unchanged.

Use the helper's candidates only as search evidence. Contextually determine
whether any branch, commit, remote branch, or pull request is unambiguously
correlated. Reuse correlated durable state; never create a private ledger or a
duplicate branch or proposal.

When authoritative invocation input establishes a prior terminal
classification or says the adaptive native goal already completed the exact
current content, reconstruct that boundary read-only before loading
adaptive-goal. Verify current repository, forge, acceptance, and review facts,
then preserve the historical outcome classification. Do not finish interrupted
work, reopen completed implementation, or recast historical `pr_created` as
`pr_existing`. Stale or partial state with unfinished delivery is not
historical terminal evidence and proceeds to adaptive-goal. A read-only
historical return still runs `render-result`; read-only does not permit
hand-written terminal output.

## 3. Delegate one bounded delivery

With authoritative intake and a safe repository, invoke and await exactly one
available skill named `adaptive-goal` whose public intent is to compile a
bounded engineering request and activate a proportionate host-native goal.
Invoke it in this recipe parent. Do not spawn a generic agent before or beside
it, imitate its preflight, or invoke it twice.

Give it:

- the complete authoritative ticket returned by intake and the fact that it
  was already retrieved;
- the exact repository, deliberate base and base object, inspection facts,
  correlated durable state, preserved work, and known adjacent exclusions;
- authority for one distinct descendant task branch, intended coherent
  commits, one non-force push, and exactly one review-ready pull request; and
- applicable repository checks, publication requirements, and prohibited
  effects.

Keep ticket authority selection, contradictory-input handling, dirty-work
ownership, historical classification, and the decision to delegate in this
parent. Adaptive-goal owns decision-gating, implementation, recovery,
verification, proportional review selection, and completion. Its native goal
owner requests branch creation, coherent commits, independent review when
selected, and publication through their host-visible compatible capability
intents. Exact compatible contracts declared by repository instructions
implement those intents.

Branch and commit mutation remain with their Git capabilities. Push,
pull-request creation or recovery, duplicate-proposal inspection, title and
template validation, and ready-versus-draft behavior remain with the compatible
create-PR capability. Do not duplicate those mechanics in this recipe or its
helper. The deliberate base is immutable delivery input and must never be
renamed, deleted, reset, or force-moved.

Map adaptive-goal's `decision-gated` preflight to `stopped` with its smallest
missing decision. Map an unavailable capability, failed preflight, unsupported
route, or unreconciled launch to `blocked`. Delegation adds no authority.

Capture adaptive-goal's complete v4 launch record verbatim. Run
`validate-launch` with the host-observed adaptive-goal invocation count, native
child count, effective route, applied-by value, and launch boundary. The
adaptive-goal count must be exactly one; same-thread and host-API boundaries
have zero native children, while a verified native-subagent or nested-session
boundary has one. A prelaunch `launch_required` record has zero native children;
an unverified Claude native-subagent record may instead retain its one observed
child while reporting `launch_required`. A validation refusal is `blocked`;
never repair, rewrite, or synthesize the preserved record. After validation,
map `workflow=decision-gated` to `stopped`; any other `route_verified=false` or
`launch_boundary=launch_required` record is an unreconciled launch and remains
`blocked`.

If validation refused because the returned record itself is malformed or
incomplete, preserve that unchanged file and render the terminal `blocked`
result with `--unvalidated-launch-record` instead of `--launch-record`. This
opaque evidence path is only for a validation refusal; never use it to bypass
validation of a record that could be parsed.

After launch, the native goal is the sole writer for branch, commit, push, and
proposal state. When it returns, remain on its checkout and branch. The recipe
parent performs only the read-only verification and rendering below; it never
replays a failed or ambiguous mutation.

## 4. Verify current delivery

Treat the goal's report as a claim. Run `verify-delivery` with the deliberate
base and recorded base object, expected task branch and HEAD, selected remote
and remote branch, plus every required original-checkout inspection record.
This proves the deterministic local boundary: base preservation, distinct
descendant branch, commits ahead, exact HEAD, matching remote-tracking ref,
clean checkout, no in-progress Git operation, and supplied preservation
evidence.

Then judge the non-mechanical gates yourself from current evidence:

- the committed diff contains only coherent ticket work and fulfills the
  ticket's observable acceptance criteria;
- applicable repository checks pass on that exact content;
- any adaptively or explicitly selected independent review covers that exact
  content and has no blocking findings; and
- exactly one correlated open pull request has the deliberate base, expected
  head, compliant title, ticket-referencing template body, and requested
  ready-versus-draft state.

Unknown, stale, inconclusive, or content-invalidated checks and reviews do not
prove success. An unavailable or blocking required review is `blocked`. Routine
review may be omitted only when adaptive policy, repository policy, and user
intent permit it. Forge ambiguity is `blocked`; the parent never retries a
creation call. Any authorized recovery remains with the same native goal owner
and the compatible create-PR capability.

## 5. Classify and render one result

Select exactly one literal outcome:

- `pr_created` — this delivery created one currently verified proposal;
- `pr_existing` — the correlated proposal pre-existed this delivery and now
  verifies;
- `stopped` — intake or decision-gated preflight needs authority or a decision;
- `blocked` — a capability, route, permission, repository condition, review,
  push, proposal, or verification gate prevented completion; or
- `interrupted` — the user, explicit budget, or host ended execution.

Outcome and next-action selection are semantic judgments. Supply them to
`render-result`; do not ask the helper to infer either. For success, pass the
current verification result, review result, and pull-request URL. For every
non-success, pass the exact reason and smallest useful next action. Pass all
known durable branch, commit, remote-branch, proposal, and preservation facts.

Pass `--launch-record` whenever adaptive-goal ran, including blocked or
interrupted returns, except that a record whose structure caused validation to
refuse is passed unchanged as `--unvalidated-launch-record`. Omit both only for
a prelaunch or authoritative historical path where no invocation occurred. The
renderer emits exact ticket and outcome evidence lines, durable-state lines,
and the preserved record before the recipe parent's terminal lines when one
exists. An unvalidated record is enclosed by explicit refusal markers and its
SHA-256 digest. Return the renderer's stdout without rewriting it.

## Boundaries

- Do not invent ticket, capability, route, review, repository, or forge facts.
- Do not discard, reset, stash, absorb, or overwrite user work.
- Do not create duplicate branches or pull requests, bypass hooks, force-push,
  rewrite history, or introduce a private phase engine or ledger.
- Do not fetch tickets through a hard-coded backend, invoke adaptive-goal from
  the helper, or let the helper mutate Git or forge state.
- Do not merge, enable auto-merge, deploy, release, mutate tickets, assign
  reviewers, or apply labels or milestones.
- Do not create a worktree unless the user explicitly requested one.
- Do not substitute direct commands or similarly named tools for an available
  declared compatible capability contract.

Complete when exactly one verified pull request exists, or one honest terminal
result preserves durable state and precisely explains why delivery stopped.
