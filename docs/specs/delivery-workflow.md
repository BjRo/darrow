# Capability: Delivery Workflow

Defines the first Darrow-managed delivery command and its evidence boundary.
The bundled `implement-change` workflow invokes the command through the Codex
harness in an exclusive managed worktree.

Plugin: `darrow-delivery`. Command: `implement`.

## Contract

Implement one requested behavioral change using red/green TDD. The command
creates a local Git branch through an intent-resolved capability, proves a
meaningful failing test before implementation, makes the smallest sufficient
change, and proves the same test plus the relevant regression suite pass.

## Invariants

- **DL-1 — Branch preflight.** The command contract requires
  `git.branch.create@^1.0.0`. Darrow proves that an enabled compatible provider
  is available before allocating a managed worktree or invoking Codex.
- **DL-2 — Intent-routed branch creation.** Command instructions ask Codex to
  create a local branch for the change without naming a provider skill. The
  selected provider remains harness configuration recorded in the run lock.
- **DL-3 — Meaningful red.** Before implementation, the command adds or adjusts
  a focused test that specifies the requested behavior and runs it. A missing
  tool, dependency, fixture, or unrelated compile failure is not red evidence.
  The test must exit nonzero for the expected behavioral reason.
- **DL-4 — Same-test green.** After the smallest sufficient implementation, the
  command runs the identical focused test command and it exits zero.
- **DL-5 — Regression green.** The command identifies and runs the relevant
  regression suite after the focused test is green. It exits zero.
- **DL-6 — Ordered immutable evidence.** Red, green, and regression observations
  are recorded in that order under the attempt's immutable artifact directory.
  Each record includes the command, exit status, start and finish timestamps,
  stdout and stderr content references, and a workspace digest. Later attempts
  never replace earlier evidence.
- **DL-6a — Runtime-authenticated capture.** During a managed command, the
  evidence helper delegates through workspace-local file IPC to a runtime-owned
  broker. The broker enforces the red → green → regression state machine,
  executes the exact argv inside a non-networked workspace-write sandbox, and
  HMAC-attests the observation outside the model workspace with a key never
  exposed to the model subprocess. Hand-authored, repeated, or altered phase
  files cannot satisfy completion. The command opts into this behavior through
  its snapshotted `delivery-tdd` execution protocol metadata; adapters do not
  impose it on unrelated commands. Non-macOS capture uses only the locked Codex
  executable and locked sandbox-profile selector; if the route cannot provide
  that executor, compilation refuses before workspace allocation instead of
  consulting current `PATH` or environment fallbacks.
- **DL-7 — Evidence enforcement.** The command's bundled script validates the
  evidence document and refuses completion when phases are missing, reordered,
  use different focused commands, have invalid exit semantics, reference
  missing output, or record a workspace digest that is not a SHA-256 value.
  Exit 126/127 is rejected before red metadata is persisted.
- **DL-8 — Bounded local effects.** The command may create one local branch and
  modify and test the managed worktree. It does not commit, push, open a pull
  request, mutate a ticket, or install dependencies.
- **DL-9 — No silent model substitution.** The initial profile requests Codex,
  provider `openai`, model `gpt-5.6-sol`, and high reasoning effort. It inherits
  native Codex permission configuration. Unavailability waits for an explicit
  amendment; no fallback model is selected.
- **DL-10 — Typed result.** Success returns the branch, changed paths, summary,
  and validated red/green/regression evidence. Failure returns a normalized
  category and preserves all observed events and content references.

## Judgment

Codex decides the focused test, expected behavioral failure, smallest sufficient
implementation, and relevant regression suite from repository context. The
script validates the ordered evidence mechanics; it does not judge whether a
test meaningfully specifies the user's behavior.

## Non-goals

Committing, pushing, pull-request creation, ticket mutation, dependency
installation, broad refactoring, review loops, waivers, or automatic retries.
