# Capability: Delivery Workflow

Defines the first Darrow-managed delivery command.
The bundled `implement-change` workflow invokes the command through the Codex
harness in an exclusive managed worktree.

Plugin: `darrow-delivery`. Command: `implement`.

## Contract

Implement one requested behavioral change using focused behavioral tests. The
command creates a local Git branch through an intent-resolved capability, sees
the focused test fail for the behavioral reason, makes the smallest sufficient
change, and runs the same test plus the relevant regression suite.

## Invariants

- **DL-1 — Branch preflight.** The command contract requires
  `git.branch.create@^1.0.0`. Darrow proves that an enabled compatible provider
  is available before allocating a managed worktree or invoking Codex.
- **DL-2 — Intent-routed branch creation.** Command instructions ask Codex to
  create a local branch for the change without naming a provider skill. The
  selected provider remains harness configuration recorded in the run lock.
- **DL-3 — Behavior-facing test.** Before implementation, the command adds or
  adjusts one focused test through a public or otherwise observable seam. The
  test states its expected outcome independently of the implementation. Task
  instructions cannot replace this with an implementation-detail test.
- **DL-4 — Meaningful red.** The focused test runs before implementation and
  fails because the requested behavior is absent. A missing tool, dependency,
  fixture, unrelated compile failure, or implementation-coupled assertion is a
  setup or test-design failure, not meaningful red. Task instructions cannot
  waive the pre-implementation run or redefine setup failure as red.
- **DL-5 — Same-test green.** After the smallest sufficient implementation, the
  command runs the identical focused test command and it exits zero.
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

## Judgment

The model decides the observable test seam, independent expectation, meaningful
behavioral failure, smallest sufficient implementation, and relevant regression
suite from repository context. These are judgment calls evaluated through skill
evals and downstream behavior, not an agent-authored evidence protocol.

## Non-goals

Committing, pushing, pull-request creation, ticket mutation, dependency
installation, broad refactoring, review loops, waivers, or automatic retries.
