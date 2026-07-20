# Capability: Delivery Workflow

Defines the first Darrow-managed delivery workflow. The bundled
`implement-change` workflow invokes an implementation command followed by a
fresh-context verification-and-repair command in the same exclusive workspace.
Both steps use the workflow's locked route unless a role-bound workflow selects
different routes explicitly.

Plugin: `darrow-delivery`. Commands: `implement` and `verify-and-repair`.

## Contract

Implement one requested behavioral change using focused behavioral tests, then
give the resulting workspace to a new agent invocation that reviews the change
for material correctness, repairs material issues it finds, and independently
verifies the final result. The implementation command creates a local Git branch
through an intent-resolved capability, sees the focused test fail for the
behavioral reason, makes the smallest sufficient change, and runs the same test
plus the relevant regression suite. The verification command retains the branch
and commit boundary it received.

## Invariants

- **DL-1 — Branch preflight.** The command contract requires
  `git.branch.create@^1.0.0`. Darrow proves that an enabled compatible provider
  is available before allocating a managed worktree or invoking Codex.
- **DL-2 — Intent-routed branch creation.** Command instructions ask Codex to
  create a local branch for the change without naming a provider skill. The
  selected provider remains harness configuration recorded in the run lock.
- **DL-3 — Behavior-facing test.** Before implementation, the command uses an
  existing focused test when it covers the requested behavior; otherwise it
  adds or adjusts one.
- **DL-4 — Meaningful red.** The focused test runs before implementation and
  fails because the requested behavior is absent. An unrelated failure does not
  establish red.
- **DL-5 — Focused green.** After the smallest sufficient implementation, the
  focused behavioral test passes.
- **DL-6 — Regression green.** The command identifies and runs the relevant
  regression suite after the focused test is green. It exits zero.
- **DL-7 — Bounded local effects.** The command may create one local branch and
  modify and test the managed worktree. It does not commit, push, open a pull
  request, mutate a ticket, or install dependencies. This is a command
  behavioral boundary, not an audit or security claim; native harness
  permissions own tool isolation.
- **DL-8 — No silent model substitution.** The initial profile requests Codex,
  provider `openai`, model `gpt-5.6-sol`, and high reasoning effort. It inherits
  native Codex permission configuration. Unavailability waits for an explicit
  amendment; no fallback model is selected.
- **DL-9 — Typed result.** Success returns the branch, changed paths, and a
  concise implementation summary. Failure returns a normalized category and
  preserves the native transcript when available.
- **DL-10 — Fresh verification context.** `verify-and-repair` runs as a distinct
  command invocation after `implement`; it does not resume or reuse the
  implementation command's native session. It receives the original requested
  behavior and inspects the current workspace and diff.
- **DL-11 — Material review.** Verification looks for behavior, boundary,
  regression, compatibility, security, and maintainability defects that could
  affect the requested outcome. It does not manufacture work from style
  preferences, broad refactoring opportunities, or unrelated pre-existing
  defects.
- **DL-12 — Targeted repair.** The verification command repairs material issues
  it finds when that can be done safely inside the requested change. It leaves
  unrelated code alone and reports material issues it cannot resolve.
- **DL-13 — Independent verification.** After any repair, the command runs the
  smallest checks that exercise each material concern plus the relevant
  regression suite. It distinguishes checks that determine the verdict from
  diagnostic attempts whose failure is caused by a demonstrated pre-existing
  problem or runner incompatibility. A diagnostic is nested under the
  successful verdict check that covers the same material concern and states why
  it is non-blocking. It reports `verified: true` only when at least one verdict
  check ran, every verdict check passed, and no material issue remains
  unresolved.
- **DL-14 — Preserved Git boundary.** Verification may modify and test the
  existing working tree. It does not create or switch branches, change local
  branch refs, alter the index state it received, create commits, push, open a
  pull request, mutate a ticket, or install dependencies. A bundled guard
  records the incoming active branch, HEAD, and index tree and rejects a changed
  boundary while returning compact absolute changed paths. It ignores unrelated
  branch refs that may advance concurrently in other worktrees and excludes the
  runtime-owned `.darrow-attempts/` tree from implementation changes. This is a
  command postcondition, not a security or process-isolation boundary.
- **DL-15 — Typed verification result.** The command returns `verified`, a
  concise summary, material findings and their resolution state, changed paths,
  and every attempted verification command with a stable ID and exit status.
  Verdict checks are top-level; `diagnosticChecks` structurally nests each
  non-blocking attempted command under the successful check that covers its
  concern and explains why it does not invalidate the verdict. The workflow
  treats a false verdict as an unsatisfied bounded outcome rather than successful
  delivery.
- **DL-16 — Product workflow.** The bundled `implement-change` workflow runs
  `implement` and then `verify-and-repair` in dependency order. The same locked
  harness route is used for both steps by default, so the additional fresh
  perspective can be evaluated independently from cross-model routing.

## Judgment

The model decides the focused test, meaningful behavioral failure, smallest
sufficient implementation, material review findings, safe repairs, and relevant
verification and regression suites from repository context. These are judgment
calls evaluated through skill evals and downstream behavior, not an
agent-authored evidence protocol.

## Non-goals

Committing, pushing, pull-request creation, ticket mutation, dependency
installation, broad refactoring, cross-model routing by default, or unattended
automatic retries after an unsatisfied verification verdict.
